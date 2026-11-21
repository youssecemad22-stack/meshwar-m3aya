/* Web push opt-in and sync for Meshwar Maaya. Self-contained: reads the existing
   Supabase session from localStorage and talks to the REST API directly, so it
   never touches app.js internals. */
(() => {
  'use strict';
  const SUPA_URL = 'https://dbvzfcerkbhdolmocujm.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidnpmY2Vya2JoZG9sbW9jdWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NDIxNjAsImV4cCI6MjExMDIxODE2MH0.Bb7HzibF8dd_aSh0V_rxtpT6Byw6lH-ERnPZ9nYQcWc';
  const VAPID_PUBLIC = 'BOzZSV2L7BwAdHrrcF8ZIidAg8sOELw8KyuPjPFa3z8NEnCgTADNXbCESd5ce_JlULzIY5ZrJ7so6XpNyDldKT4';
  const STORE_KEY = 'sb-dbvzfcerkbhdolmocujm-auth-token';
  const $ = id => document.getElementById(id);
  const isEn = () => document.documentElement.lang === 'en';
  const text = (ar, en) => isEn() ? en : ar;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';

  function b64ToU8(base64) {
    const pad = '='.repeat((4 - base64.length % 4) % 4);
    const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function session() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !d.access_token || !d.user || !d.user.id) return null;
      if (d.expires_at && d.expires_at * 1000 < Date.now() + 30000) return null;
      return { token: d.access_token, uid: d.user.id };
    } catch (_) { return null; }
  }
  async function saveSub(sub) {
    const ses = session();
    if (!ses) return false;
    const keys = sub.toJSON();
    try {
      const r = await fetch(SUPA_URL + '/rest/v1/push_subscriptions?on_conflict=endpoint', {
        method: 'POST',
        headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + ses.token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: ses.uid, endpoint: sub.endpoint, p256dh: keys.keys.p256dh, auth: keys.keys.auth, ua: navigator.userAgent.slice(0, 180), last_seen: new Date().toISOString() })
      });
      return r.ok;
    } catch (_) { return false; }
  }
  async function dropSub(endpoint) {
    const ses = session();
    if (!ses) return;
    try {
      await fetch(SUPA_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(endpoint), {
        method: 'DELETE',
        headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + ses.token }
      });
    } catch (_) {}
  }
  async function currentSub() {
    if (!supported) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch (_) { return null; }
  }
  async function enable() {
    const btn = $('push-enable');
    btn.disabled = true;
    try {
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') { note(text('الإذن ماتقبلش. ممكن تسمح بالإشعارات من إعدادات الموقع في المتصفح.', 'Permission was not granted. Allow notifications from the browser site settings.')); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUBLIC) });
      let ok = await saveSub(sub);
      if (!ok) { await new Promise(r => setTimeout(r, 2500)); ok = await saveSub(sub); }
      if (!ok) { note(text('اتفعلت الإشعارات بس الحفظ على السيرفر فشل. جرّب تاني وانت أونلاين.', 'Notifications are on, but saving to the server failed. Try again while online.')); return; }
      try { await reg.showNotification('مشوار معايا', { body: text('الإشعارات اتفعلت على الجهاز ده 🎉', 'Notifications are on for this device 🎉'), icon: './icon-192.png', tag: 'meshwar-push-welcome' }); } catch (_) {}
      render();
    } catch (_) {
      note(text('مشكلة في التفعيل. حاول تاني.', 'Activation failed. Please try again.'));
    } finally { btn.disabled = false; }
  }
  async function disable() {
    const sub = await currentSub();
    if (sub) { try { await sub.unsubscribe(); } catch (_) {} await dropSub(sub.endpoint); }
    render();
  }
  function note(msg) {
    const copy = $('push-copy');
    if (copy) copy.textContent = msg;
  }
  async function render() {
    const card = $('push-card');
    if (!card) return;
    const state = $('push-state'), copy = $('push-copy'), on = $('push-enable'), off = $('push-disable');
    if (!supported) {
      state.textContent = text('مش مدعومة', 'Unsupported');
      copy.textContent = ios
        ? text('على آيفون الإشعارات بتشتغل من النسخة المثبتة على الشاشة الرئيسية بس. افتح زر "تثبيت التطبيق على الموبايل" تحت وضيفه الأول.', 'On iPhone, notifications only work from the home-screen app. Use "Install on your phone" below first.')
        : text('المتصفح ده مش بيدعم إشعارات الويب.', 'This browser does not support web push.');
      on.hidden = true; off.hidden = true;
      return;
    }
    if (ios && !standalone()) {
      state.textContent = text('محتاج تثبيت', 'Install first');
      copy.textContent = text('على آيفون: ثبّت التطبيق على الشاشة الرئيسية من زر المشاركة في Safari، وبعدين افتحه من الأيقونة وفعّل الإشعارات من هنا.', 'On iPhone: add the app to your home screen from the Safari share button, then open it from the icon and enable notifications here.');
      on.hidden = true; off.hidden = true;
      return;
    }
    if (Notification.permission === 'denied') {
      state.textContent = text('محظورة', 'Blocked');
      copy.textContent = text('الإشعارات محظورة من المتصفح. اسمح بيها من إعدادات الموقع وبعدين ارجع هنا.', 'Notifications are blocked by the browser. Allow them in site settings, then come back.');
      on.hidden = true; off.hidden = true;
      return;
    }
    const sub = await currentSub();
    if (Notification.permission === 'granted' && sub) {
      state.textContent = text('شغالة ✓', 'On ✓');
      copy.textContent = text('هيوصلك إشعار على الجهاز ده لما حد يحجز معاك أو يبعتلك رسالة، حتى لو التطبيق مقفول.', 'This device gets a notification when someone books with you or messages you, even when the app is closed.');
      on.hidden = true; off.hidden = false;
    } else {
      state.textContent = text('مقفولة', 'Off');
      copy.textContent = text('فعّلها عشان يوصلك إشعار لما حد يحجز معاك أو يرد عليك في الشات، حتى لو التطبيق مقفول.', 'Turn them on to get a notification when someone books with you or replies in chat, even when the app is closed.');
      on.hidden = false; off.hidden = true;
    }
    on.textContent = text('فعّل الإشعارات', 'Enable notifications');
    off.textContent = text('وقّف الإشعارات على الجهاز ده', 'Disable notifications on this device');
  }
  function buildCard() {
    if ($('push-card')) return;
    const profile = $('v5');
    if (!profile) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'push-card';
    card.innerHTML = '<div class="row"><h2 id="push-title" style="margin:0"></h2><span class="chip" id="push-state"></span></div><p class="mu" id="push-copy"></p><button class="btn" id="push-enable" type="button"></button><button class="btn g" id="push-disable" type="button" hidden></button>';
    profile.appendChild(card);
    $('push-title').textContent = text('إشعارات الموبايل', 'Phone notifications');
    $('push-enable').addEventListener('click', enable);
    $('push-disable').addEventListener('click', disable);
    render();
  }
  async function resync() {
    if (!supported || Notification.permission !== 'granted') return;
    const sub = await currentSub();
    if (sub) await saveSub(sub);
  }
  function toastInline(title, body) {
    let t = $('toast');
    if (!t) return;
    t.textContent = (title ? title + ' · ' : '') + (body || '');
    t.style.display = 'block';
    clearTimeout(toastInline.i);
    toastInline.i = setTimeout(() => { t.style.display = 'none'; }, 4000);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'push-received') toastInline(event.data.title, event.data.body);
    });
  }
  new MutationObserver(() => { buildCard(); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('load', () => {
    buildCard();
    setTimeout(resync, 2000);
    setTimeout(resync, 8000);
    setTimeout(resync, 20000);
  });
  if (document.readyState !== 'loading') buildCard(); else document.addEventListener('DOMContentLoaded', buildCard);
})();
