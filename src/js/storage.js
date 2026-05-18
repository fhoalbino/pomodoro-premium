/* ==========================================================================
   storage.js — localStorage wrappers for settings, runtime state, daily history
   ========================================================================== */

const KEYS = {
  settings: 'pomo.settings.v3',
  state:    'pomo.state.v3',
  history:  'pomo.history.v3',
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const Storage = {
  loadSettings(defaults) {
    try {
      const raw = localStorage.getItem(KEYS.settings);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return { ...defaults };
    }
  },

  saveSettings(s) {
    try { localStorage.setItem(KEYS.settings, JSON.stringify(s)); } catch {}
  },

  loadState() {
    try {
      const raw = localStorage.getItem(KEYS.state);
      if (!raw) return null;
      // Keep `running`, `updatedAt`, `selectedTab`, and override fields so the
      // full UX (active session + visual tab) restores after Ctrl+R / reload.
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Persist runtime state. `extra` is merged on top so UI-only fields like
   * `selectedTab` can travel with the session snapshot without polluting the
   * pure-logic timer module.
   */
  saveState(st, extra = {}) {
    try {
      const payload = { ...st, ...extra, updatedAt: Date.now() };
      localStorage.setItem(KEYS.state, JSON.stringify(payload));
    } catch {}
  },

  loadHistory() {
    try {
      const raw = localStorage.getItem(KEYS.history);
      if (!raw) return { date: todayKey(), count: 0, focusSec: 0 };
      const h = JSON.parse(raw);
      if (h.date !== todayKey()) return { date: todayKey(), count: 0, focusSec: 0 };
      return { date: h.date, count: h.count || 0, focusSec: h.focusSec || 0 };
    } catch {
      return { date: todayKey(), count: 0, focusSec: 0 };
    }
  },

  recordFocusCompleted(focusSec) {
    const h = this.loadHistory();
    h.count += 1;
    h.focusSec += focusSec;
    h.date = todayKey();
    try { localStorage.setItem(KEYS.history, JSON.stringify(h)); } catch {}
    return h;
  },
};
