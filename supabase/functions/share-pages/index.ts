// share-pages: fired by the rides table trigger (share_page_dispatch) via
// pg_net. Regenerates the static share card for one ride on GitHub Pages
// (share/<id>/index.html) through the GitHub Contents API.
// Auth: shared x-hook-secret header (app_config + HOOK_SECRET env secret).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const APP = 'https://youssecemad22-stack.github.io/meshwar-m3aya/';
const COVER = APP + 'og-cover.png';
const GH_REPO = 'youssecemad22-stack/meshwar-m3aya';
const HOOK_SECRET = Deno.env.get('HOOK_SECRET') ?? '';
const GITHUB_PAT = Deno.env.get('GITHUB_PAT') ?? '';

// Catalog fallbacks mirroring app.js; DB points/custom_points override them.
const ROUTES = ["الصحراوي المباشر", "الدائري ← محور 26 يوليو", "محور عمرو بن العاص", "كمال عامر / أحمد عرابي", "وصلة دهشور"];
let PTS: string[] = ["ميدان الجيزة", "المساحة", "مدكور", "الطالبية", "المطبعة", "العريش", "ترسا", "المريوطية", "اللبيني", "المنصورية", "ميدان الرماية", "أول الصحراوي", "المتحف الكبير"];
let OFF: number[] = [0, 6, 10, 14, 18, 21, 22, 25, 27, 30, 32, 34, 36];
let DROP: string[] = ["الحي الأول", "الحي الثاني", "الحي الثالث", "الحي الرابع", "الحي الخامس", "الحي السادس", "الحي السابع", "الحي الثامن", "أركان بلازا", "بارك ستريت", "جاليريا 40", "ويست أرينا", "دندي مول", "هايبر وان", "أمريكانا بلازا", "مول العرب", "مول مصر", "بيفرلي هيلز", "ويستاون", "أليجريا", "زيد ويست", "مستشفى الشيخ زايد التخصصي", "مسجد السليمانية", "نادي الجزيرة", "الحديقة الكندية", "جامعة النيل", "وصلة دهشور", "ميدان جهينة", "ميدان الحصري"];
const AREA_NAMES = ["وسط البلد", "ميدان التحرير", "العتبة", "الأزبكية", "عابدين", "الدرب الأحمر", "الجمالية", "الحسين", "الأزهر", "باب الشعرية", "بولاق أبو العلا", "حي الظاهر", "الفجالة", "رمسيس", "محطة رمسيس", "شبرا", "شبرا مصر", "روض الفرج", "حي الساحل", "الزيتون", "حدائق القبة", "القبة", "الوايلي", "العباسية", "الألف مسكن", "مصر الجديدة", "ألماظة", "مدينة نصر", "مكرم عبيد", "عباس العقاد", "النزهة", "عين شمس", "المطرية", "المرج", "مدينة السلام", "التجمع الأول", "التجمع الثالث", "التجمع الخامس", "القاهرة الجديدة", "الرحاب", "مدينتي", "مدينة الشروق", "مدينة بدر", "العاصمة الإدارية الجديدة", "الزمالك", "جاردن سيتي", "المنيل", "الروضة", "مصر القديمة", "السيدة زينب", "القلعة", "الخليفة", "المقطم", "المعادي", "دجلة المعادي", "زهراء المعادي", "المعادي الجديدة", "ثكنات المعادي", "طرة", "حلوان", "المعصرة", "مدينة 15 مايو", "التبين", "البساتين", "دار السلام", "القطامية", "الأميرية", "منشية ناصر", "الدراسة", "الجامعة الأمريكية بالقاهرة", "الجامعة الألمانية بالقاهرة", "جامعة عين شمس", "جامعة الأزهر", "جامعة حلوان", "مستشفى قصر العيني", "مطار القاهرة الدولي", "سيتي ستارز", "كايرو فيستيفال سيتي", "حديقة الأزهر", "خان الخليلي", "المتحف المصري", "برج القاهرة", "الهرم", "فيصل", "العمرانية", "بولاق الدكرور", "الدقي", "المهندسين", "العجوزة", "إمبابة", "الوراق", "المنيرة", "الكيت كات", "أرض اللواء", "ساقية مكي", "ميدان لبنان", "ميدان سفنكس", "نزلة السمان", "أهرامات الجيزة", "سقارة", "البدرشين", "الحوامدية", "الصف", "العياط", "أطفيح", "أوسيم", "كرداسة", "أبو رواش", "منشأة القناطر", "الواحات البحرية", "مدينة 6 أكتوبر", "الشيخ زايد", "الحي المتميز", "حدائق الأهرام", "حدائق أكتوبر", "دريم لاند", "بالم هيلز أكتوبر", "ماونتن فيو أكتوبر", "كفر طهرمس", "البراجيل", "ناهيا", "جامعة القاهرة", "حديقة الأورمان", "حديقة الحيوان بالجيزة", "مطار سفنكس", "محطة الجيزة"];

const GENERIC_TITLE = 'مشوار معايا | مشاركة مشاوير الهرم والشيخ زايد';
const GENERIC_DESC = 'احجز مقعدك مع سواق من منطقتك، أو انشر مشوارك وقسّم التكلفة.';
const ENDED_DESC = 'المشوار ده خلص أو اتلغى. افتح التطبيق وشوف المشاوير المتاحة.';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// Same time math as app.js tm(): add offset minutes to an "h:mm" clock.
function tm(t: unknown, off: number): string {
  const parts = String(t || '7:30').split(':').map(Number);
  let h = parts[0] || 0, m = (parts[1] || 0) + (off || 0);
  h += Math.floor(m / 60);
  m = ((m % 60) + 60) % 60;
  return h + ':' + String(m).padStart(2, '0');
}

function page(title: string, desc: string, target: string): string {
  return '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
    + '<title>' + esc(title) + '</title>\n'
    + '<meta property="og:type" content="website">\n'
    + '<meta property="og:site_name" content="مشوار معايا">\n'
    + '<meta property="og:title" content="' + esc(title) + '">\n'
    + '<meta property="og:description" content="' + esc(desc) + '">\n'
    + '<meta property="og:image" content="' + COVER + '">\n'
    + '<meta property="og:url" content="' + esc(target) + '">\n'
    + '<meta name="twitter:card" content="summary_large_image">\n'
    + '<meta http-equiv="refresh" content="0;url=' + esc(target) + '">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B4F4A;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}a{color:#A9F2D2}</style>\n'
    + '</head>\n<body>\n<div>\n<h1>' + esc(title) + '</h1>\n<p>' + esc(desc) + '</p>\n'
    + '<p><a href="' + esc(target) + '">افتح المشوار في تطبيق مشوار معايا</a></p>\n</div>\n'
    + '<script>location.replace(' + JSON.stringify(target) + ');</scr' + 'ipt>\n</body>\n</html>';
}


function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (!HOOK_SECRET || req.headers.get('x-hook-secret') !== HOOK_SECRET) return json({ error: 'unauthorized' }, 401);
  if (!GITHUB_PAT) return json({ error: 'missing GITHUB_PAT' }, 500);
  let rideId = 0;
  try { rideId = Number((await req.json()).ride_id) || 0; } catch (_) { /* ignore */ }
  if (!rideId) return json({ error: 'ride_id required' }, 400);

  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  let title = GENERIC_TITLE, desc = ENDED_DESC, target = APP;

  try {
    const [{ data: base }, { data: cps }] = await Promise.all([
      sb.from('points').select('kind,id,name,off_minutes'),
      sb.from('custom_points').select('id,name,off_minutes'),
    ]);
    if (base && base.length) {
      PTS = []; OFF = []; DROP = [];
      base.forEach((p: { kind: string; id: number; name: string; off_minutes: number | null }) => {
        if (p.kind === 'pickup') { PTS[p.id] = p.name; OFF[p.id] = p.off_minutes || 0; }
        else DROP[p.id] = p.name;
      });
    }
    AREA_NAMES.forEach((n: string, k: number) => { PTS[100 + k] = n; OFF[100 + k] = 0; DROP[29 + k] = n; });
    (cps || []).forEach((c: { id: number; name: string; off_minutes: number | null }) => { PTS[c.id] = c.name; OFF[c.id] = c.off_minutes || 0; });

    const { data: r } = await sb.from('rides').select('*').eq('id', rideId).maybeSingle();
    if (r && (r.status === 'open' || r.status === 'active')) {
      const pts: number[] = Array.isArray(r.pts) ? r.pts : [];
      const route = ROUTES[r.route] || '';
      const chain = pts
        .filter(i => PTS[i])
        .map(i => PTS[i] + ' ' + ((r.tt && r.tt[i]) || tm(r.t, (OFF[i] || 0) - (OFF[pts[0]] || 0))))
        .join(' ← ');
      const drop = DROP[r.dr || 0] || '';
      title = (route ? 'مشوار ' + route : 'مشوار معايا') + ' · ' + r.price + ' جنيه';
      desc = (chain ? chain + (drop ? ' ← ' + drop : '') + '. ' : '')
        + r.price + ' جنيه للمقعد، متبقي ' + r.left + ' مقاعد. من تطبيق مشوار معايا.';
      target = APP + '?ride=' + rideId;
    }
  } catch (_) { /* fall back to the ended card */ }

  const html = page(title, desc, target);
  const path = 'share/' + rideId + '/index.html';
  const gh = { Authorization: 'Bearer ' + GITHUB_PAT, 'User-Agent': 'meshwar-share-pages', Accept: 'application/vnd.github+json' };

  const cur = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + path + '?ref=main', { headers: gh });
  let sha: string | undefined;
  if (cur.ok) {
    const existing = await cur.json();
    sha = existing.sha;
    if ((existing.content || '').replace(/\n/g, '') === b64(html)) return json({ ok: true, changed: false });
  }

  const put = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + path, {
    method: 'PUT',
    headers: { ...gh, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Share card for ride ' + rideId, content: b64(html), branch: 'main', ...(sha ? { sha } : {}) }),
  });
  return json({ ok: put.status < 300, changed: put.status < 300, github_status: put.status });
});
