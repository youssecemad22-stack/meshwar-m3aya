// ride-share: public share page for one ride.
// Link scrapers (WhatsApp, Facebook, ...) read the Open Graph tags from this
// HTML without running JavaScript; people are redirected to the app deep link
// (/?ride=<id>) which opens the ride details after sign-in.
// Reads the ride with the built-in service role key and returns only the
// fields a public share preview needs (route, points, price, seats left).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const APP = 'https://youssecemad22-stack.github.io/meshwar-m3aya/';
const COVER = APP + 'og-cover.png';

// Catalog fallbacks mirroring app.js; DB points/custom_points override them.
const ROUTES = ["الصحراوي المباشر", "الدائري ← محور 26 يوليو", "محور عمرو بن العاص", "كمال عامر / أحمد عرابي", "وصلة دهشور"];
let PTS: string[] = ["ميدان الجيزة", "المساحة", "مدكور", "الطالبية", "المطبعة", "العريش", "ترسا", "المريوطية", "اللبيني", "المنصورية", "ميدان الرماية", "أول الصحراوي", "المتحف الكبير"];
let OFF: number[] = [0, 6, 10, 14, 18, 21, 22, 25, 27, 30, 32, 34, 36];
let DROP: string[] = ["الحي الأول", "الحي الثاني", "الحي الثالث", "الحي الرابع", "الحي الخامس", "الحي السادس", "الحي السابع", "الحي الثامن", "أركان بلازا", "بارك ستريت", "جاليريا 40", "ويست أرينا", "دندي مول", "هايبر وان", "أمريكانا بلازا", "مول العرب", "مول مصر", "بيفرلي هيلز", "ويستاون", "أليجريا", "زيد ويست", "مستشفى الشيخ زايد التخصصي", "مسجد السليمانية", "نادي الجزيرة", "الحديقة الكندية", "جامعة النيل", "وصلة دهشور", "ميدان جهينة", "ميدان الحصري"];
const AREA_NAMES = ["وسط البلد", "ميدان التحرير", "العتبة", "الأزبكية", "عابدين", "الدرب الأحمر", "الجمالية", "الحسين", "الأزهر", "باب الشعرية", "بولاق أبو العلا", "حي الظاهر", "الفجالة", "رمسيس", "محطة رمسيس", "شبرا", "شبرا مصر", "روض الفرج", "حي الساحل", "الزيتون", "حدائق القبة", "القبة", "الوايلي", "العباسية", "الألف مسكن", "مصر الجديدة", "ألماظة", "مدينة نصر", "مكرم عبيد", "عباس العقاد", "النزهة", "عين شمس", "المطرية", "المرج", "مدينة السلام", "التجمع الأول", "التجمع الثالث", "التجمع الخامس", "القاهرة الجديدة", "الرحاب", "مدينتي", "مدينة الشروق", "مدينة بدر", "العاصمة الإدارية الجديدة", "الزمالك", "جاردن سيتي", "المنيل", "الروضة", "مصر القديمة", "السيدة زينب", "القلعة", "الخليفة", "المقطم", "المعادي", "دجلة المعادي", "زهراء المعادي", "المعادي الجديدة", "ثكنات المعادي", "طرة", "حلوان", "المعصرة", "مدينة 15 مايو", "التبين", "البساتين", "دار السلام", "القطامية", "الأميرية", "منشية ناصر", "الدراسة", "الجامعة الأمريكية بالقاهرة", "الجامعة الألمانية بالقاهرة", "جامعة عين شمس", "جامعة الأزهر", "جامعة حلوان", "مستشفى قصر العيني", "مطار القاهرة الدولي", "سيتي ستارز", "كايرو فيستيفال سيتي", "حديقة الأزهر", "خان الخليلي", "المتحف المصري", "برج القاهرة", "الهرم", "فيصل", "العمرانية", "بولاق الدكرور", "الدقي", "المهندسين", "العجوزة", "إمبابة", "الوراق", "المنيرة", "الكيت كات", "أرض اللواء", "ساقية مكي", "ميدان لبنان", "ميدان سفنكس", "نزلة السمان", "أهرامات الجيزة", "سقارة", "البدرشين", "الحوامدية", "الصف", "العياط", "أطفيح", "أوسيم", "كرداسة", "أبو رواش", "منشأة القناطر", "الواحات البحرية", "مدينة 6 أكتوبر", "الشيخ زايد", "الحي المتميز", "حدائق الأهرام", "حدائق أكتوبر", "دريم لاند", "بالم هيلز أكتوبر", "ماونتن فيو أكتوبر", "كفر طهرمس", "البراجيل", "ناهيا", "جامعة القاهرة", "حديقة الأورمان", "حديقة الحيوان بالجيزة", "مطار سفنكس", "محطة الجيزة"];

const GENERIC_TITLE = 'مشوار معايا | مشاركة مشاوير الهرم والشيخ زايد';
const GENERIC_DESC = 'احجز مقعدك مع سواق من منطقتك، أو انشر مشوارك وقسّم التكلفة.';

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

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id') || '0');
  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  let title = GENERIC_TITLE, desc = GENERIC_DESC, target = APP;

  if (id > 0) {
    try {
      // Mirror loadPoints() in app.js: DB points replace the base catalog.
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

      const { data: r } = await sb.from('rides').select('*').eq('id', id).maybeSingle();
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
        target = APP + '?ride=' + id;
      }
    } catch (_) { /* fall back to the generic card */ }
  }

  return new Response(page(title, desc, target), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  });
});
