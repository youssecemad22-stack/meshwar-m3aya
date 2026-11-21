(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const isEnglish = () => document.documentElement.lang === 'en';
  const text = (ar, en) => isEnglish() ? en : ar;
  let deferredInstall = null;
  let registration = null;
  let reloading = false;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function showStatus() {
    const offline = !navigator.onLine;
    // Offline startup must not be held behind the live-data loading splash.
    if (offline && $('sp')) $('sp').style.display = 'none';
    $('pwa-offline').hidden = !offline;
    $('pwa-offline').textContent = text('إنت أوفلاين دلوقتي. الواجهة متاحة، بس المشاوير والحجز وتسجيل الدخول محتاجين إنترنت.','You are offline. The app shell is available, but rides, booking and sign-in need internet.');
  }
  function dismissed() {
    try { return Date.now() - Number(localStorage.getItem('meshwar-install-dismissed') || 0) < 7 * 86400000; } catch (_) { return false; }
  }
  function showInstall() {
    $('pwa-install').hidden = standalone() || dismissed() || !('serviceWorker' in navigator);
    $('pwa-install-title').textContent = text('مشوار معايا على موبايلك','Meshwar on your phone');
    $('pwa-install-copy').textContent = text('ضيفه للشاشة الرئيسية وافتحه بلمسة، من غير متجر.','Add it to your home screen and open with a tap. No app store needed.');
    $('pwa-install-action').textContent = text('ضيف التطبيق','Add app');
    $('pwa-install-later').textContent = text('مش دلوقتي','Not now');
  }
  function showHelp() {
    const dialog = $('pwa-help');
    $('pwa-help-title').textContent = text('ضيف مشوار معايا على موبايلك','Add Meshwar to your phone');
    $('pwa-help-copy').textContent = ios
      ? text('افتح اللينك في Safari، دوس على زر المشاركة، وبعدها "إضافة إلى الشاشة الرئيسية" ثم "إضافة". لو الخيار مش ظاهر، افتح القائمة كاملة.','Open this link in Safari, tap Share, then Add to Home Screen and Add. Expand the menu if needed.')
      : text('افتح اللينك في Chrome، ومن قائمة ⋮ اختار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية". لو فاتحه جوه تيك توك أو أي تطبيق، افتحه في المتصفح الأول. التثبيت محتاج إنترنت.','Open this link in Chrome. In the ⋮ menu choose Install app or Add to Home screen. If you opened it inside TikTok or another app, open it in your browser first. Installation needs internet.');
    $('pwa-help-close').textContent = text('تمام','Got it');
    dialog.showModal();
  }
  async function install() {
    if (!deferredInstall) return showHelp();
    const prompt = deferredInstall;
    deferredInstall = null;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === 'accepted') $('pwa-install').hidden = true;
    } catch (_) { showHelp(); }
  }
  $('pwa-install-action').addEventListener('click', install);
  $('pwa-install-later').addEventListener('click', () => {
    $('pwa-install').hidden = true;
    try { localStorage.setItem('meshwar-install-dismissed', String(Date.now())); } catch (_) {}
  });
  $('pwa-help-close').addEventListener('click', () => $('pwa-help').close());
  $('pwa-help').addEventListener('click', event => { if (event.target === $('pwa-help')) $('pwa-help').close(); });
  // Keep installation available after dismissing the suggestion.
  const helpButton = document.createElement('button');
  helpButton.type = 'button'; helpButton.className = 'btn g';
  helpButton.textContent = text('تثبيت التطبيق على الموبايل','Install on your phone');
  helpButton.addEventListener('click', install);
  const profile = document.getElementById('v5');
  (profile || $('pwa-install').parentElement).appendChild(helpButton);
  helpButton.hidden = standalone();
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; showInstall(); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; $('pwa-install').hidden = true; helpButton.hidden = true; $('pwa-help').close(); });
  matchMedia('(display-mode: standalone)').addEventListener('change', () => { showInstall(); helpButton.hidden = standalone(); });
  window.addEventListener('online', showStatus);
  window.addEventListener('offline', showStatus);
  new MutationObserver(() => { showStatus(); showInstall(); }).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
  showStatus(); showInstall();
  function offerUpdate() {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return;
    $('pwa-update').hidden = false;
    $('pwa-update-copy').textContent = text('في نسخة جديدة جاهزة. خلّص أي بيانات بتكتبها وبعدين حدّث.','A new version is ready. Finish any unsaved work before updating.');
    $('pwa-update-action').textContent = text('تحديث دلوقتي','Update now');
  }
  $('pwa-update-action').addEventListener('click', () => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({type: 'SKIP_WAITING'});
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading && registration?.active && ! $('pwa-update').hidden) {
        reloading = true; location.reload();
      }
    });
    window.addEventListener('load', async () => {
      try {
        registration = await navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'});
        offerUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => { if (worker.state === 'installed') offerUpdate(); });
        });
        registration.update().catch(() => {});
      } catch (error) { console.warn('App installation support is currently unavailable.', error); }
    });
  }
})();
