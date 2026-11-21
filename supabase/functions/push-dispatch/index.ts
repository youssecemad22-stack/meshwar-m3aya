// push-dispatch: receives row events from the push_dispatch() DB trigger (via
// pg_net) and delivers web push notifications to the recipient's devices.
// Auth: shared x-hook-secret header (stored in private app_config table + env).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:youssecemad22@gmail.com';
const HOOK_SECRET = Deno.env.get('HOOK_SECRET') ?? '';
const sb = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);
if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function bookingParties(bookingId: number) {
  const { data: b } = await sb.from('bookings').select('passenger_id, ride_id').eq('id', bookingId).maybeSingle();
  if (!b) return null;
  const { data: r } = await sb.from('rides').select('driver_id').eq('id', b.ride_id).maybeSingle();
  return { passenger: b.passenger_id as string, driver: r?.driver_id as string | null };
}

async function rideDriver(rideId: number) {
  const { data: r } = await sb.from('rides').select('driver_id').eq('id', rideId).maybeSingle();
  return (r?.driver_id as string) ?? null;
}

// Returns the recipients and the notification copy, or null to skip.
async function plan(p: any): Promise<{ ids: string[]; title: string; body: string; tag: string } | null> {
  const title = 'مشوار معايا';
  const price = p.price != null ? ` · ${p.price} جنيه` : '';
  if (p.kind === 'message') {
    const parties = await bookingParties(p.booking_id);
    if (!parties || !parties.driver) return null;
    const to = p.sender === parties.driver ? parties.passenger : parties.driver;
    if (!to || to === p.sender) return null;
    const snippet = String(p.body ?? '').slice(0, 90);
    return { ids: [to], title, body: snippet ? `رسالة جديدة: ${snippet}` : 'رسالة جديدة في الشات', tag: `chat-${p.booking_id}` };
  }
  if (p.kind === 'booking_new') {
    const driver = await rideDriver(p.ride_id);
    if (!driver || driver === p.actor) return null;
    const body = p.status === 'accepted' ? `مقعد اتحجز في مشوارك${price}` : `طلب حجز جديد على مشوارك${price}`;
    return { ids: [driver], title, body, tag: `booking-${p.booking_id}` };
  }
  if (p.kind === 'booking_update') {
    if (p.arrived && p.passenger !== p.actor) {
      return { ids: [p.passenger], title, body: 'السواق وصل لنقطتك', tag: `booking-${p.booking_id}` };
    }
    const parties = await bookingParties(p.booking_id);
    if (!parties || !parties.driver) return null;
    if (p.status === 'accepted' && p.old_status === 'countered') {
      if (parties.driver === p.actor) return null;
      return { ids: [parties.driver], title, body: `الراكب قبل سعرك${price}`, tag: `booking-${p.booking_id}` };
    }
    if (p.status === 'accepted') {
      if (parties.passenger === p.actor) return null;
      return { ids: [parties.passenger], title, body: `السواق وافق على عرضك${price}`, tag: `booking-${p.booking_id}` };
    }
    if (p.status === 'countered') {
      if (parties.passenger === p.actor) return null;
      return { ids: [parties.passenger], title, body: `السواق رد بسعر${price || ''}`, tag: `booking-${p.booking_id}` };
    }
    if (p.status === 'onboard') {
      if (parties.passenger === p.actor) return null;
      return { ids: [parties.passenger], title, body: 'السواق أكد إنك ركبت. رحلة سعيدة', tag: `booking-${p.booking_id}` };
    }
    if (p.status === 'cancelled') {
      const ids = [parties.driver, parties.passenger].filter((id) => id && id !== p.actor) as string[];
      if (!ids.length) return null;
      return { ids, title, body: 'اتلغى الحجز في مشوارك', tag: `booking-${p.booking_id}` };
    }
    return null;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ ok: true });
    if (!HOOK_SECRET || req.headers.get('x-hook-secret') !== HOOK_SECRET) return json({ error: 'unauthorized' }, 401);
    const payload = await req.json();
    const job = await plan(payload);
    if (!job || !job.ids.length) return json({ sent: 0 });
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', job.ids);
    if (error) return json({ error: error.message }, 500);
    let sent = 0;
    const gone: number[] = [];
    const message = JSON.stringify({ title: job.title, body: job.body, tag: job.tag, url: './' });
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
          { TTL: 3600 },
        );
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.id);
      }
    }
    if (gone.length) await sb.from('push_subscriptions').delete().in('id', gone);
    return json({ sent, pruned: gone.length });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
