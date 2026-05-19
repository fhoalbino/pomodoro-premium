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

const WATCHED_FIELDS = [
  'focusMin', 'shortMin', 'longMin', 'cyclesUntilLong',
  'soundOn', 'notifOn', 'autoStart', 'particlesOn',
];

const JUST_SAVED_MS = 1400;

function clampInt(v, mn, mx, fb) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fb;
  return Math.min(mx, Math.max(mn, n));
}

/**
 * Wire the settings form to read/write a settings object.
 * Owns the save-button lifecycle: saved / dirty / saving / just-saved.
 * Guards against double-submit via `isSaving`.
 *
 * @param {object} opts
 * @param {object} opts.el          — bag of DOM elements (see SETTINGS_FIELDS)
 * @param {Function} opts.onSave    — (nextSettings) => void | Promise<void>
 * @param {Function} opts.onReset   — (defaults) => void
 * @returns {{ populate: (s) => void, read: () => object, markSaved: () => void, refreshDirty: () => void }}
 */
export function setupSettingsUI({ el, onSave, onReset }) {
  let isSaving = false;
  let lastSavedSnapshot = '';
  let feedbackTimeout = null;

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

  function snapshot() {
    return JSON.stringify(read());
  }

  function isDirty() {
    return snapshot() !== lastSavedSnapshot;
  }

  function setButtonState(state) {
    const b = el.saveSettings;
    b.classList.remove('is-saved', 'is-dirty', 'is-saving', 'is-just-saved');
    b.classList.add(`is-${state}`);
    switch (state) {
      case 'saved':
        b.textContent = 'Salvo';
        b.disabled = true;
        b.setAttribute('aria-label', 'Sem alterações pendentes');
        break;
      case 'dirty':
        b.textContent = 'Salvar alterações';
        b.disabled = false;
        b.setAttribute('aria-label', 'Salvar alterações pendentes');
        break;
      case 'saving':
        b.textContent = 'Salvando...';
        b.disabled = true;
        b.setAttribute('aria-label', 'Salvando');
        break;
      case 'just-saved':
        b.textContent = 'Salvo ✓';
        b.disabled = true;
        b.setAttribute('aria-label', 'Alterações salvas');
        break;
    }
  }

  function refreshDirty() {
    if (isSaving) return;
    setButtonState(isDirty() ? 'dirty' : 'saved');
  }

  function populate(s) {
    el.focusMin.value        = s.focusMin;
    el.shortMin.value        = s.shortMin;
    el.longMin.value         = s.longMin;
    el.cyclesUntilLong.value = s.cyclesUntilLong;
    el.soundOn.checked       = s.soundOn;
    el.notifOn.checked       = s.notifOn;
    el.autoStart.checked     = s.autoStart;
    el.particlesOn.checked   = s.particlesOn;
    lastSavedSnapshot = snapshot();
    if (!isSaving) setButtonState('saved');
  }

  function markSaved() {
    lastSavedSnapshot = snapshot();
    if (!isSaving) refreshDirty();
  }

  WATCHED_FIELDS.forEach((name) => {
    const node = el[name];
    if (!node) return;
    const evt = node.type === 'checkbox' ? 'change' : 'input';
    node.addEventListener(evt, refreshDirty);
  });

  el.saveSettings.addEventListener('click', async () => {
    if (isSaving) return;
    if (!isDirty()) return;

    isSaving = true;
    setButtonState('saving');
    if (feedbackTimeout) {
      clearTimeout(feedbackTimeout);
      feedbackTimeout = null;
    }

    try {
      await onSave(read());
      lastSavedSnapshot = snapshot();
      setButtonState('just-saved');
      feedbackTimeout = setTimeout(() => {
        feedbackTimeout = null;
        refreshDirty();
      }, JUST_SAVED_MS);
    } catch (err) {
      console.error('Falha ao salvar configurações:', err);
      setButtonState('dirty');
    } finally {
      isSaving = false;
    }
  });

  el.resetSettings.addEventListener('click', () => {
    if (isSaving) return;
    onReset({ ...DEFAULTS });
  });

  return { populate, read, markSaved, refreshDirty };
}
