/* ==========================================================================
   notifications.js — Browser Notification API wrapper
   ========================================================================== */

export const Notifications = {
  isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  },

  permission() {
    return this.isSupported() ? Notification.permission : 'denied';
  },

  async maybeRequest() {
    if (!this.isSupported()) return 'denied';
    if (Notification.permission === 'default') {
      try { return await Notification.requestPermission(); } catch { return 'denied'; }
    }
    return Notification.permission;
  },

  fire(title, body) {
    if (!this.isSupported()) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, silent: false, icon: './public/icons/icon-192.svg' });
    } catch {}
  },
};
