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

  // Phase color class on body follows the VIEWED tab so theme matches the card.
  el.body.classList.remove('phase-focus', 'phase-short', 'phase-long');
  el.body.classList.add(PHASES[viewMode].cssClass);

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

  const timer = createTimer({
    settings,
    state: savedState,
    onTick:   (s) => render(s, timer.getSettings()),
    onChange: (s) => {
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
      flashSaved();
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

  function flashSaved() {
    const b = el.saveSettings;
    const orig = b.textContent;
    b.textContent = '✓ Salvo';
    setTimeout(() => { b.textContent = orig; }, 1100);
  }

  /* ----- Tab clicks: change selectedTab ONLY ----- */
  function selectTab(mode) {
    if (selectedTab === mode) return;
    selectedTab = mode;
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
