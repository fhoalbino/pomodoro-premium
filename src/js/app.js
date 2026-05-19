/* ==========================================================================
   app.js — Boot, DOM bindings, render loop, glue between modules

   State architecture:
   - activeMode (timer.getState().phase): the actual running/paused session.
   - selectedTab: which tab the user is *viewing*. Pure UI state, persisted.
   - When selectedTab === activeMode → normal full UI.
   - When selectedTab !== activeMode → preview mode:
       * card shows selectedTab's default time + label (no progress).
       * banner inside the card announces the active session.
       * floating mini timer in top-right shows live remaining + "Voltar".
       * primary button starts selectedTab via confirm modal (manual override).
   ========================================================================== */

import { Storage }            from './storage.js';
import { Audio }              from './audio.js';
import { Notifications }      from './notifications.js';
import {
  createTimer, PHASES, MSG, RING_C,
} from './timer.js';
import { DEFAULTS, setupSettingsUI } from './settings.js';
import { setupPWA }           from './pwa.js';
import * as Theme             from './theme.js';

Theme.restoreSavedTheme();

function $(id) { return document.getElementById(id); }

const el = {
  body:        document.body,
  splash:      $('splash'),
  timeText:    $('timeText'),
  phaseLabel:  $('phaseLabel'),
  cycleText:   $('cycleText'),
  ringFg:      $('ringFg'),

  startBtn:    $('startBtn'),
  pauseBtn:    $('pauseBtn'),
  resetBtn:    $('resetBtn'),
  skipBtn:     $('skipBtn'),
  muteBtn:     $('muteBtn'),
  installBtn:  $('installBtn'),

  phaseTabs:    document.querySelectorAll('.phase-tab'),
  tabIndicator: document.querySelector('.tab-indicator'),

  ergoMsg:        $('ergoMsg'),
  timerCard:      document.querySelector('.timer-card'),
  doneToday:      $('doneToday'),
  streakNum:      $('streakNum'),
  streakTotalMin: $('streakTotalMin'),

  activeBanner:     $('activeBanner'),
  activeBannerText: $('activeBannerText'),

  miniTimer:     $('miniTimer'),
  miniTimerMode: $('miniTimerMode'),
  miniTimerTime: $('miniTimerTime'),
  miniTimerBack: $('miniTimerBack'),

  confirmModal:  $('confirmModal'),
  confirmText:   $('confirmText'),
  confirmOk:     $('confirmOk'),
  confirmCancel: $('confirmCancel'),

  focusMin:        $('focusMin'),
  shortMin:        $('shortMin'),
  longMin:         $('longMin'),
  cyclesUntilLong: $('cyclesUntilLong'),
  soundOn:         $('soundOn'),
  notifOn:         $('notifOn'),
  autoStart:       $('autoStart'),
  particlesOn:     $('particlesOn'),
  saveSettings:    $('saveSettings'),
  resetSettings:   $('resetSettings'),

  themeSelect:          $('themeSelect'),
  resetTheme:           $('resetTheme'),
  openColorPicker:      $('openColorPicker'),
  themePreview:         $('themePreview'),
  activeThemeText:      $('activeThemeText'),
  themeError:           $('themeError'),
  themeEditingValue:    $('themeEditingValue'),
  themeCurrentHex:      $('themeCurrentHex'),
  themeHexChip:         $('themeHexChip'),
  copyThemeHex:         $('copyThemeHex'),
  themePhaseButtons:    document.querySelectorAll('.theme-phase-btn'),

  colorPickerModal:     $('colorPickerModal'),
  colorPickerTitle:     $('colorPickerTitle'),
  colorPickerPhase:     $('colorPickerPhase'),
  colorPickerPreview:   $('colorPickerPreview'),
  colorPickerSv:        $('colorPickerSv'),
  colorPickerSvCursor:  $('colorPickerSvCursor'),
  colorPickerHue:       $('colorPickerHue'),
  colorPickerHueCursor: $('colorPickerHueCursor'),
  colorPickerHexInput:  $('colorPickerHexInput'),
  colorPickerStatus:    $('colorPickerStatus'),
  copyColorHex:         $('copyColorHex'),
  restorePhaseColor:    $('restorePhaseColor'),
  closeColorPicker:     $('closeColorPicker'),
  cancelColorPicker:    $('cancelColorPicker'),
  applyColorPicker:     $('applyColorPicker'),
};

function fmt(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tabLabel(mode) {
  // Title-case version for banners (HTML phase labels are uppercase).
  return mode === 'focus' ? 'Foco' : mode === 'short' ? 'Pausa curta' : 'Pausa longa';
}

function positionTabIndicator() {
  const active = document.querySelector('.phase-tab.is-active');
  if (!active || !el.tabIndicator) return;
  const wrap = active.parentElement.getBoundingClientRect();
  const r = active.getBoundingClientRect();
  el.tabIndicator.style.width = `${r.width}px`;
  el.tabIndicator.style.transform = `translateX(${r.left - wrap.left - 5}px)`;
}

function applyMuteIcon(soundOn) {
  const onPath  = el.muteBtn.querySelector('.sound-on');
  const offPath = el.muteBtn.querySelector('.sound-off');
  if (!onPath || !offPath) return;
  onPath.classList.toggle('hidden', !soundOn);
  offPath.classList.toggle('hidden', soundOn);
  el.muteBtn.setAttribute('aria-pressed', String(!soundOn));
}

function setErgo(text) {
  el.ergoMsg.classList.remove('show');
  if (!text) { el.ergoMsg.textContent = ''; return; }
  requestAnimationFrame(() => {
    el.ergoMsg.textContent = text;
    el.ergoMsg.classList.add('show');
  });
}

function flashCard() {
  el.timerCard.classList.remove('flash');
  void el.timerCard.offsetWidth;
  el.timerCard.classList.add('flash');
}

/* ---------- UI state ---------- */
let selectedTab = 'focus';

function isPreview(state) {
  return selectedTab !== state.phase;
}

function hasActiveSession(state) {
  // "Active" = running OR paused mid-way (remaining < total).
  return state.running || (state.remaining > 0 && state.remaining < state.total);
}

function applyPhaseClass(target, mode) {
  if (!target) return;
  target.classList.remove('phase-focus', 'phase-short', 'phase-long');
  target.classList.add(PHASES[mode].cssClass);
  Theme.applyModeVariables(target, mode);
}

/* ---------- Render ---------- */
function render(state, settings) {
  const preview = isPreview(state);
  const active  = hasActiveSession(state);
  const viewMode = preview ? selectedTab : state.phase;

  // Card content reflects what user is viewing (selectedTab when previewing).
  if (preview) {
    const total = durationFor(viewMode, settings);
    el.timeText.textContent   = fmt(total);
    el.phaseLabel.textContent = PHASES[viewMode].label;
    el.cycleText.textContent  = `Ciclo ${state.cycleInRound} de ${settings.cyclesUntilLong}`;
    // Full ring in preview — no progress shown for unrelated tab.
    el.ringFg.style.strokeDasharray  = RING_C.toFixed(3);
    el.ringFg.style.strokeDashoffset = '0';
  } else {
    el.timeText.textContent   = fmt(state.remaining);
    el.phaseLabel.textContent = PHASES[state.phase].label;
    el.cycleText.textContent  = `Ciclo ${state.cycleInRound} de ${settings.cyclesUntilLong}`;
    const progress = state.total > 0 ? state.remaining / state.total : 0;
    el.ringFg.style.strokeDasharray  = RING_C.toFixed(3);
    el.ringFg.style.strokeDashoffset = (RING_C * (1 - progress)).toFixed(3);
  }

  // Stats
  const h = Storage.loadHistory();
  el.doneToday.textContent = h.count;
  const completedInRound = state.phase === 'focus' ? state.cycleInRound - 1 : state.cycleInRound;
  el.streakNum.textContent = Math.max(0, Math.min(settings.cyclesUntilLong, completedInRound));
  if (el.streakTotalMin.firstChild && el.streakTotalMin.firstChild.nodeType === Node.TEXT_NODE) {
    el.streakTotalMin.firstChild.nodeValue = String(Math.round(h.focusSec / 60));
  } else {
    el.streakTotalMin.textContent = String(Math.round(h.focusSec / 60));
  }

  // Main UI follows selectedTab; live surfaces follow activeMode.
  applyPhaseClass(el.body, viewMode);
  applyPhaseClass(el.timerCard, viewMode);
  applyPhaseClass(el.miniTimer, state.phase);
  applyPhaseClass(el.activeBanner, state.phase);
  applyPhaseClass(el.confirmModal, selectedTab);

  // Preview & running indicators on card.
  el.timerCard.classList.toggle('is-running', state.running && !preview);
  el.timerCard.classList.toggle('is-preview', preview);

  // Tabs — driven by selectedTab, not by active session.
  el.phaseTabs.forEach(t => {
    const isActive = t.dataset.phase === selectedTab;
    t.classList.toggle('is-active', isActive);
    t.setAttribute('aria-selected', String(isActive));
  });
  positionTabIndicator();

  // Buttons: when previewing, only the primary "Iniciar" is meaningful.
  if (preview) {
    el.startBtn.disabled = false;
    el.startBtn.querySelector('.btn-label').textContent =
      `Iniciar ${tabLabel(selectedTab).toLowerCase()}`;
    el.pauseBtn.disabled = true;
    el.skipBtn.disabled  = true;
    el.resetBtn.disabled = true;
  } else {
    el.startBtn.disabled = state.running;
    el.pauseBtn.disabled = !state.running;
    el.skipBtn.disabled  = false;
    el.resetBtn.disabled = false;
    el.startBtn.querySelector('.btn-label').textContent =
      state.remaining < state.total && !state.running ? 'Retomar' : 'Iniciar';
  }

  // Active session banner (shown only while previewing AND a session exists).
  const showBanner = preview && active;
  el.activeBanner.classList.toggle('hidden', !showBanner);
  if (showBanner) {
    el.activeBannerText.textContent = `${tabLabel(state.phase)} • ${fmt(state.remaining)}`;
  }

  // Floating mini timer — same condition as banner.
  el.miniTimer.classList.toggle('hidden', !showBanner);
  if (showBanner) {
    el.miniTimerMode.textContent = tabLabel(state.phase);
    el.miniTimerTime.textContent = fmt(state.remaining);
  }

  // Tab title reflects the live session, regardless of preview.
  document.title = state.running
    ? `${fmt(state.remaining)} · ${PHASES[state.phase].label.toLowerCase()} — Pomodoro`
    : 'Pomodoro Premium';
}

function durationFor(mode, settings) {
  const min = mode === 'focus' ? settings.focusMin
            : mode === 'short' ? settings.shortMin
            : settings.longMin;
  return min * 60;
}

/* ---------- Confirm modal ---------- */
let _confirmResolver = null;

function askConfirm(text) {
  el.confirmText.textContent = text;
  el.confirmModal.classList.remove('hidden');
  return new Promise(resolve => { _confirmResolver = resolve; });
}

function resolveConfirm(answer) {
  el.confirmModal.classList.add('hidden');
  const r = _confirmResolver; _confirmResolver = null;
  r?.(answer);
}

/* ---------- Hotkeys ---------- */
function setupHotkeys(actions) {
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (el.colorPickerModal && !el.colorPickerModal.classList.contains('hidden')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'Space')                       { e.preventDefault(); actions.toggle(); }
    else if (e.code === 'KeyR' && e.shiftKey)     { e.preventDefault(); actions.reset(); }
    else if (e.code === 'KeyS' && !e.shiftKey)    { actions.skip(); }
    else if (e.code === 'KeyM' && !e.shiftKey)    { actions.mute(); }
    else if (e.code === 'Escape' && _confirmResolver) { resolveConfirm(false); }
  });
}

function preventZoomShortcuts() {
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (['=', '+', '-', '_', '0'].includes(e.key)) e.preventDefault();
  });
}

function setupThemeUI(onThemeChange, onPhaseSelect) {
  const labels = new Map(Theme.getThemes().map((theme) => [theme.name, theme.label]));
  const phaseLabels = Theme.getPhaseLabels();
  let editingPhase = selectedTab;
  let pickerPhase = selectedTab;
  let pickerHsv = Theme.hexToHsv(Theme.getPhaseColor(editingPhase));
  let pickerHex = Theme.getPhaseColor(editingPhase);
  let pickerOpen = false;

  function themeLabel(theme) {
    if (theme.themeName === 'custom') return 'Custom';
    return labels.get(theme.themeName) || 'Gold';
  }

  function updatePanel(message = '') {
    const theme = Theme.getAppliedTheme();
    const hex = Theme.getPhaseColor(editingPhase, theme);
    el.themeSelect.value = theme.themeName;
    el.themePreview.style.backgroundColor = hex;
    el.themePreview.style.boxShadow = `0 0 18px ${Theme.getPhaseTokens(editingPhase).glow}`;
    el.activeThemeText.textContent = `Tema ativo: ${themeLabel(theme)}`;
    el.themeEditingValue.textContent = phaseLabels[editingPhase];
    el.themeCurrentHex.textContent = hex;
    el.themeError.textContent = message;
    el.themePhaseButtons.forEach((button) => {
      const isActive = button.dataset.themePhase === editingPhase;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function setPickerVars() {
    const style = el.colorPickerModal.style;
    style.setProperty('--picker-hue', String(Math.round(pickerHsv.h)));
    style.setProperty('--picker-s', pickerHsv.s.toFixed(4));
    style.setProperty('--picker-v', pickerHsv.v.toFixed(4));
  }

  function updatePicker(message = '') {
    pickerHex = Theme.hsvToHex(pickerHsv);
    el.colorPickerTitle.textContent = 'Personalizar cor';
    el.colorPickerPhase.textContent = `Editando: ${phaseLabels[pickerPhase]}`;
    el.colorPickerPreview.style.backgroundColor = pickerHex;
    el.colorPickerHexInput.value = pickerHex;
    el.colorPickerStatus.textContent = message;
    setPickerVars();
    Theme.applyModeVariables(el.colorPickerModal, pickerPhase);
  }

  function previewPickerHex(hex) {
    const normalized = Theme.normalizeHex(hex);
    if (!normalized) {
      el.colorPickerStatus.textContent = 'Digite uma cor HEX valida, como #68DDBD ou #0FF.';
      return false;
    }

    pickerHsv = Theme.hexToHsv(normalized);
    pickerHex = normalized;
    const result = Theme.previewPhaseColor(pickerPhase, normalized);
    updatePicker(result.ok ? '' : result.error);
    updatePanel(result.ok ? '' : result.error);
    onThemeChange?.();
    return result.ok;
  }

  function openPicker() {
    pickerPhase = editingPhase;
    pickerHex = Theme.getPhaseColor(pickerPhase);
    pickerHsv = Theme.hexToHsv(pickerHex);
    pickerOpen = true;
    el.colorPickerModal.classList.remove('hidden');
    el.colorPickerModal.setAttribute('aria-hidden', 'false');
    Theme.applyModeVariables(el.colorPickerModal, pickerPhase);
    updatePicker('');
    requestAnimationFrame(() => el.colorPickerHexInput.focus());
  }

  function closePicker({ commit } = { commit: false }) {
    if (!commit) Theme.cancelPreview();
    pickerOpen = false;
    el.colorPickerModal.classList.add('hidden');
    el.colorPickerModal.setAttribute('aria-hidden', 'true');
    updatePanel('');
    onThemeChange?.();
    el.openColorPicker.focus();
  }

  function setCustomizePhase(phase) {
    if (!Theme.PHASE_KEYS.includes(phase)) return;
    editingPhase = phase;
    Theme.applyModeVariables(el.themePreview, phase);
    updatePanel('');
  }

  function pointInElement(element, event) {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    return { x, y, rect };
  }

  function setSvFromPointer(event) {
    const { x, y, rect } = pointInElement(el.colorPickerSv, event);
    pickerHsv = {
      h: pickerHsv.h,
      s: rect.width ? x / rect.width : pickerHsv.s,
      v: rect.height ? 1 - y / rect.height : pickerHsv.v,
    };
    previewPickerHex(Theme.hsvToHex(pickerHsv));
  }

  function setHueFromPointer(event) {
    const { x, rect } = pointInElement(el.colorPickerHue, event);
    pickerHsv = {
      h: rect.width ? (x / rect.width) * 360 : pickerHsv.h,
      s: pickerHsv.s,
      v: pickerHsv.v,
    };
    previewPickerHex(Theme.hsvToHex(pickerHsv));
  }

  function bindDrag(target, handler) {
    target.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      target.setPointerCapture?.(event.pointerId);
      handler(event);
      const move = (moveEvent) => handler(moveEvent);
      const up = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
  }

  el.themeSelect.addEventListener('change', () => {
    const name = el.themeSelect.value;
    if (name === 'custom') {
      openPicker();
      el.themeError.textContent = 'Edite uma fase para criar um tema custom.';
      return;
    }

    Theme.applyTheme(name);
    updatePanel('');
    onThemeChange?.();
  });

  el.themePhaseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const phase = button.dataset.themePhase;
      if (!Theme.PHASE_KEYS.includes(phase)) return;
      onPhaseSelect?.(phase);
      if (!onPhaseSelect) setCustomizePhase(phase);
    });
  });

  el.openColorPicker.addEventListener('click', openPicker);

  function copyPanelHex() {
    const hex = Theme.getPhaseColor(editingPhase, Theme.getAppliedTheme());
    navigator.clipboard?.writeText(hex);
    updatePanel('HEX copiado.');
  }

  el.themeHexChip.addEventListener('click', copyPanelHex);
  el.copyThemeHex.addEventListener('click', copyPanelHex);

  el.resetTheme.addEventListener('click', () => {
    Theme.resetTheme();
    updatePanel('');
    onThemeChange?.();
  });

  bindDrag(el.colorPickerSv, setSvFromPointer);
  bindDrag(el.colorPickerHue, setHueFromPointer);

  el.colorPickerHexInput.addEventListener('input', () => {
    const normalized = Theme.normalizeHex(el.colorPickerHexInput.value);
    if (!normalized) {
      el.colorPickerStatus.textContent = '';
      return;
    }
    previewPickerHex(normalized);
  });

  el.colorPickerHexInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const normalized = Theme.normalizeHex(el.colorPickerHexInput.value);
    if (!normalized) {
      el.colorPickerStatus.textContent = 'HEX invalido. Use #RGB ou #RRGGBB.';
      return;
    }
    previewPickerHex(normalized);
    el.colorPickerStatus.textContent = 'Preview aplicado.';
  });

  el.copyColorHex.addEventListener('click', () => {
    const normalized = Theme.normalizeHex(el.colorPickerHexInput.value);
    if (!normalized) {
      el.colorPickerStatus.textContent = 'HEX invalido.';
      return;
    }
    navigator.clipboard?.writeText(normalized);
    el.colorPickerStatus.textContent = 'HEX copiado.';
  });

  el.restorePhaseColor.addEventListener('click', () => {
    const result = Theme.restorePhaseDefault(pickerPhase);
    pickerHex = Theme.getPhaseColor(pickerPhase, Theme.getAppliedTheme());
    pickerHsv = Theme.hexToHsv(pickerHex);
    updatePicker(result.ok ? '' : 'Nao foi possivel restaurar esta fase.');
    updatePanel('');
    onThemeChange?.();
  });

  el.cancelColorPicker.addEventListener('click', () => closePicker({ commit: false }));
  el.closeColorPicker.addEventListener('click', () => closePicker({ commit: false }));

  el.applyColorPicker.addEventListener('click', () => {
    const normalized = Theme.normalizeHex(el.colorPickerHexInput.value);
    if (!normalized) {
      el.colorPickerStatus.textContent = 'Digite uma cor HEX valida, como #68DDBD ou #0FF.';
      return;
    }
    const result = Theme.applyPhaseColor(pickerPhase, normalized);
    if (!result.ok) {
      el.colorPickerStatus.textContent = result.error;
      return;
    }
    editingPhase = pickerPhase;
    closePicker({ commit: true });
  });

  el.colorPickerModal.addEventListener('click', (event) => {
    if (event.target === el.colorPickerModal) closePicker({ commit: false });
  });

  document.addEventListener('keydown', (event) => {
    if (!pickerOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker({ commit: false });
    }
  });

  updatePanel('');

  return { setCustomizePhase, updatePanel };
}

/* ---------- Boot ---------- */
function boot() {
  const settings = Storage.loadSettings(DEFAULTS);
  const savedState = Storage.loadState();

  // Restore selectedTab from the saved payload; fall back to the active phase.
  if (savedState && typeof savedState.selectedTab === 'string'
      && ['focus', 'short', 'long'].includes(savedState.selectedTab)) {
    selectedTab = savedState.selectedTab;
  } else if (savedState && savedState.phase) {
    selectedTab = savedState.phase;
  }

  Audio.setEnabled(settings.soundOn);
  el.body.classList.toggle('no-particles', !settings.particlesOn);
  applyMuteIcon(settings.soundOn);

  let themeUI = null;

  const timer = createTimer({
    settings,
    state: savedState,
    onTick:   (s) => render(s, timer.getSettings()),
    onChange: (s) => {
      if (s.autoCompleted) {
        selectedTab = s.phase;
        themeUI?.setCustomizePhase(selectedTab);
      }
      render(s, timer.getSettings());
      Storage.saveState(timer.getState(), { selectedTab });
    },
    onComplete: ({ finishedPhase, wasManual }) => {
      Audio.chime();
      flashCard();

      if (timer.getSettings().notifOn) {
        const title = finishedPhase === 'focus' ? 'Foco concluído' : 'Pausa terminada';
        const body  = finishedPhase === 'focus' ? MSG.focusEnd : MSG.backToFocus;
        Notifications.fire(title, body);
      }

      if (wasManual) {
        // Manual phase ended — original session is restored (paused).
        // Snap the visual tab back to the restored active phase so user lands oriented.
        selectedTab = timer.getState().phase;
        setErgo('Pausa manual concluída. Sessão anterior preservada — retome quando quiser.');
        return;
      }
      if (finishedPhase === 'focus') {
        const tip = MSG.breakTips[Math.floor(Math.random() * MSG.breakTips.length)];
        setErgo(`${MSG.focusEnd} ${tip}`);
      } else {
        setErgo(MSG.backToFocus);
      }
      // Natural advance — keep selectedTab synced with the new active phase.
      selectedTab = timer.getState().phase;
    },
    recordFocus: (sec) => Storage.recordFocusCompleted(sec),
  });

  /* ----- Settings UI ----- */
  const settingsUI = setupSettingsUI({
    el,
    onSave: (next) => {
      Storage.saveSettings(next);
      timer.setSettings(next);
      Audio.setEnabled(next.soundOn);
      el.body.classList.toggle('no-particles', !next.particlesOn);
      applyMuteIcon(next.soundOn);
      if (!timer.getState().running) timer.jumpTo(timer.getState().phase);
      if (next.notifOn) Notifications.maybeRequest();
      settingsUI.populate(next);
      render(timer.getState(), next);
    },
    onReset: (defaults) => {
      Storage.saveSettings(defaults);
      timer.setSettings(defaults);
      Audio.setEnabled(defaults.soundOn);
      el.body.classList.toggle('no-particles', !defaults.particlesOn);
      applyMuteIcon(defaults.soundOn);
      if (!timer.getState().running) timer.jumpTo(timer.getState().phase);
      settingsUI.populate(defaults);
      render(timer.getState(), defaults);
    },
  });
  settingsUI.populate(settings);
  themeUI = setupThemeUI(
    () => render(timer.getState(), timer.getSettings()),
    (phase) => selectTab(phase)
  );

  /* ----- Tab clicks: change selectedTab ONLY ----- */
  function selectTab(mode) {
    if (selectedTab === mode) {
      themeUI?.setCustomizePhase(mode);
      return;
    }
    selectedTab = mode;
    themeUI?.setCustomizePhase(mode);
    Storage.saveState(timer.getState(), { selectedTab });
    render(timer.getState(), timer.getSettings());
    setErgo('');
  }

  el.phaseTabs.forEach(t => {
    t.addEventListener('click', () => {
      Audio.tick();
      selectTab(t.dataset.phase);
    });
  });

  /* ----- Mini timer "Voltar" ----- */
  el.miniTimerBack.addEventListener('click', () => {
    Audio.tick();
    selectTab(timer.getState().phase);
  });

  /* ----- Primary "Iniciar" — branches on preview vs active ----- */
  async function handleStart() {
    if (_confirmResolver) return; // already awaiting confirmation
    Audio.ensure(); Audio.tick();
    const state = timer.getState();

    if (!isPreview(state)) {
      timer.start();
      return;
    }

    // Preview mode start. If no active session, just convert selectedTab into the running phase.
    if (!hasActiveSession(state)) {
      timer.jumpTo(selectedTab);
      timer.start();
      return;
    }

    // Active session exists on a different phase — confirm before override.
    const ok = await askConfirm(
      `Isso vai interromper o ciclo atual e iniciar ${tabLabel(selectedTab)} manualmente. Deseja continuar?`
    );
    if (!ok) return;

    timer.startManual(selectedTab);
  }

  /* ----- Controls ----- */
  el.startBtn.addEventListener('click', handleStart);
  el.pauseBtn.addEventListener('click', () => { Audio.tick(); timer.pause(); });
  el.resetBtn.addEventListener('click', () => {
    Audio.tick();
    timer.reset();
    selectedTab = timer.getState().phase;
    setErgo('');
  });
  el.skipBtn .addEventListener('click', () => {
    Audio.tick();
    timer.skip();
    selectedTab = timer.getState().phase;
  });

  el.muteBtn.addEventListener('click', () => {
    const cfg = { ...timer.getSettings(), soundOn: !timer.getSettings().soundOn };
    timer.setSettings(cfg);
    Storage.saveSettings(cfg);
    Audio.setEnabled(cfg.soundOn);
    applyMuteIcon(cfg.soundOn);
    settingsUI.populate(cfg);
  });

  /* ----- Confirm modal wiring ----- */
  el.confirmOk    .addEventListener('click', () => resolveConfirm(true));
  el.confirmCancel.addEventListener('click', () => resolveConfirm(false));
  el.confirmModal.addEventListener('click', (e) => {
    if (e.target === el.confirmModal) resolveConfirm(false);
  });

  /* ----- Hotkeys ----- */
  setupHotkeys({
    toggle: () => {
      const s = timer.getState();
      if (isPreview(s) && hasActiveSession(s)) {
        // Space on preview is ambiguous — route through the start handler so
        // the confirm modal still gates manual override.
        handleStart();
        return;
      }
      s.running ? timer.pause() : timer.start();
      Audio.tick();
    },
    reset:  () => { timer.reset(); selectedTab = timer.getState().phase; setErgo(''); },
    skip:   () => { timer.skip();  selectedTab = timer.getState().phase; },
    mute:   () => { el.muteBtn.click(); },
  });
  preventZoomShortcuts();

  /* ----- PWA ----- */
  setupPWA(el.installBtn);

  /* ----- Persistence ----- */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      Storage.saveState(timer.getState(), { selectedTab });
    }
  });

  window.addEventListener('beforeunload', (e) => {
    Storage.saveState(timer.getState(), { selectedTab });
    if (timer.getState().running) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  window.addEventListener('resize', positionTabIndicator);

  /* ----- Initial paint ----- */
  render(timer.getState(), settings);
  // Reset updatedAt so a subsequent reload doesn't subtract the elapsed gap twice.
  Storage.saveState(timer.getState(), { selectedTab });
  requestAnimationFrame(positionTabIndicator);
  setTimeout(() => el.body.classList.remove('boot'), 700);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
