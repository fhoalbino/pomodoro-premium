/* ==========================================================================
   pwa.js — Install prompt + service worker registration
   ========================================================================== */

export function setupPWA(installBtn) {
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn?.classList.remove('hidden');
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') installBtn.classList.add('hidden');
    } catch {}
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    installBtn?.classList.add('hidden');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./service-worker.js')
        .catch(() => { /* offline support is optional; ignore on failure */ });
    });
  }
}
