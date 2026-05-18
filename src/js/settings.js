/* ==========================================================================
   settings.js — Default values + settings form binding (DOM-aware)
   ========================================================================== */

export const DEFAULTS = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  cyclesUntilLong: 4,
  soundOn: true,
  notifOn: false,
  autoStart: false,
  particlesOn: true,
};

function clampInt(v, mn, mx, fb) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fb;
  return Math.min(mx, Math.max(mn, n));
}

/**
 * Wire the settings form to read/write a settings object.
 * @param {object} opts
 * @param {object} opts.el          — bag of DOM elements (see SETTINGS_FIELDS)
 * @param {Function} opts.onSave    — (nextSettings) => void
 * @param {Function} opts.onReset   — (defaults) => void
 * @returns {{ populate: (s) => void, read: () => object }}
 */
export function setupSettingsUI({ el, onSave, onReset }) {
  function populate(s) {
    el.focusMin.value        = s.focusMin;
    el.shortMin.value        = s.shortMin;
    el.longMin.value         = s.longMin;
    el.cyclesUntilLong.value = s.cyclesUntilLong;
    el.soundOn.checked       = s.soundOn;
    el.notifOn.checked       = s.notifOn;
    el.autoStart.checked     = s.autoStart;
    el.particlesOn.checked   = s.particlesOn;
  }

  function read() {
    return {
      focusMin:        clampInt(el.focusMin.value,        1, 120, DEFAULTS.focusMin),
      shortMin:        clampInt(el.shortMin.value,        1, 60,  DEFAULTS.shortMin),
      longMin:         clampInt(el.longMin.value,         1, 120, DEFAULTS.longMin),
      cyclesUntilLong: clampInt(el.cyclesUntilLong.value, 2, 12,  DEFAULTS.cyclesUntilLong),
      soundOn:     !!el.soundOn.checked,
      notifOn:     !!el.notifOn.checked,
      autoStart:   !!el.autoStart.checked,
      particlesOn: !!el.particlesOn.checked,
    };
  }

  el.saveSettings.addEventListener('click', () => onSave(read()));
  el.resetSettings.addEventListener('click', () => onReset({ ...DEFAULTS }));

  return { populate, read };
}
