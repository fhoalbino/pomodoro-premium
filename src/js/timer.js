/* ==========================================================================
   timer.js — Pomodoro engine. Drift-resistant via endAt = Date.now() + remaining*1000.
   Pure logic — does not touch the DOM. Emits events through callbacks.

   Concepts:
   - phase / cycleInRound / remaining / total / running form the ACTIVE session.
   - manualModeOverride: true when the user started a phase out of the natural cycle
     (e.g., started "long break" while focus session was paused mid-way).
   - preOverride: snapshot of the active session captured at the moment of override.
     When the manual phase ends, the engine restores this snapshot instead of
     advancing the cycle — so the original flow is not corrupted.
   ========================================================================== */

export const PHASES = {
  focus: { label: 'FOCO',         cssClass: 'phase-focus' },
  short: { label: 'PAUSA CURTA',  cssClass: 'phase-short' },
  long:  { label: 'PAUSA LONGA',  cssClass: 'phase-long'  },
};

export const MSG = {
  focusEnd: 'Sessão concluída. Solte o mouse, relaxe o pulso, alongue por alguns segundos.',
  breakTips: [
    'Relaxe a mão e gire o pulso devagar. Respire fundo.',
    'Solte os ombros. Incline a cabeça para os lados, com calma.',
    'Olhe para um ponto distante por 20 segundos. Descanse a vista.',
    'Levante por um instante. Beba água, alongue o pescoço.',
    'Abra e feche as mãos lentamente. Solte a tensão do braço.',
  ],
  backToFocus: 'De volta ao foco. Boa sessão.',
};

export const RING_R = 108;
export const RING_C = 2 * Math.PI * RING_R;

export function createTimer({ settings, state, onTick, onChange, onComplete, recordFocus }) {
  const MAX_RESUME_GAP_SEC = 60 * 60;
  const MAX_FAST_FORWARD   = 16;

  let _settings = { ...settings };
  let _state = state ? normalizeState(state) : freshState();
  let endAt = null;
  let handle = null;

  if (!_state.total || !_state.remaining) setPhase(_state.phase, _state.cycleInRound);

  // ---- Resume from persisted state ----
  if (_state.running && typeof _state.updatedAt === 'number') {
    const elapsed = (Date.now() - _state.updatedAt) / 1000;
    if (elapsed < 0 || elapsed > MAX_RESUME_GAP_SEC) {
      _state.running = false;
    } else {
      let remaining = _state.remaining - elapsed;
      let iter = 0;
      let manualResolved = false;
      while (remaining <= 0 && iter < MAX_FAST_FORWARD) {
        if (_state.phase === 'focus' && !_state.manualModeOverride) recordFocus?.(_state.total);
        const overflow = -remaining;
        if (_state.manualModeOverride) {
          // Manual phase finished while page was closed — restore the snapshot
          // and leave the session PAUSED. We don't auto-resume the preOverride.
          restoreFromOverride();
          manualResolved = true;
          break;
        }
        silentAdvance();
        remaining = _state.total - overflow;
        iter++;
      }
      if (manualResolved) {
        // Pause cleanly; user re-enters via Iniciar.
        _state.running = false;
      } else if (iter >= MAX_FAST_FORWARD) {
        _state.running = false;
      } else {
        _state.remaining = remaining;
        _state.running = true;
        endAt = Date.now() + remaining * 1000;
        schedule();
      }
    }
  }

  function normalizeState(s) {
    return {
      phase: s.phase || 'focus',
      remaining: typeof s.remaining === 'number' ? s.remaining : 0,
      total: typeof s.total === 'number' ? s.total : 0,
      cycleInRound: s.cycleInRound || 1,
      running: !!s.running,
      updatedAt: s.updatedAt,
      manualModeOverride: !!s.manualModeOverride,
      preOverride: s.preOverride || null,
    };
  }

  function freshState() {
    return {
      phase: 'focus',
      remaining: _settings.focusMin * 60,
      total:     _settings.focusMin * 60,
      cycleInRound: 1,
      running: false,
      manualModeOverride: false,
      preOverride: null,
    };
  }

  function durationFor(phase) {
    const min = phase === 'focus' ? _settings.focusMin
              : phase === 'short' ? _settings.shortMin
              : _settings.longMin;
    return min * 60;
  }

  function silentAdvance() {
    let nextPhase, nextCycle = _state.cycleInRound;
    if (_state.phase === 'focus') {
      nextPhase = _state.cycleInRound >= _settings.cyclesUntilLong ? 'long' : 'short';
    } else {
      nextPhase = 'focus';
      nextCycle = _state.phase === 'long'
        ? 1
        : Math.min(_state.cycleInRound + 1, _settings.cyclesUntilLong);
    }
    setPhase(nextPhase, nextCycle);
  }

  function getState() { return _state; }
  function getSettings() { return _settings; }
  function setSettings(next) { _settings = { ...next }; }

  function start() {
    if (_state.running) return;
    _state.running = true;
    endAt = Date.now() + _state.remaining * 1000;
    schedule();
    onChange?.(_state);
  }

  function pause() {
    if (!_state.running) return;
    _state.running = false;
    if (endAt) _state.remaining = Math.max(0, (endAt - Date.now()) / 1000);
    clearTimeout(handle); handle = null; endAt = null;
    onChange?.(_state);
  }

  function reset() {
    pause();
    _state = freshState();
    onChange?.(_state);
  }

  function skip() { advancePhase(false); }

  /**
   * Jump preview only — does NOT change the running session.
   * Kept for legacy callers; new UI should treat tabs as preview only and not call this.
   */
  function jumpTo(phase) {
    pause();
    setPhase(phase, _state.cycleInRound);
    onChange?.(_state);
  }

  /**
   * Start a phase out-of-band. If a session is already in progress on a different phase,
   * snapshot it into preOverride so the cycle can be restored when this manual phase ends.
   */
  function startManual(phase) {
    if (phase === _state.phase) { start(); return; }

    if (!_state.manualModeOverride) {
      _state.preOverride = {
        phase: _state.phase,
        cycleInRound: _state.cycleInRound,
        remaining: _state.remaining,
        total: _state.total,
      };
    }
    _state.manualModeOverride = true;
    _state.phase = phase;
    _state.total = durationFor(phase);
    _state.remaining = _state.total;
    _state.running = true;
    endAt = Date.now() + _state.remaining * 1000;
    schedule();
    onChange?.(_state);
  }

  function restoreFromOverride() {
    if (!_state.preOverride) {
      _state.manualModeOverride = false;
      return;
    }
    const p = _state.preOverride;
    _state.phase = p.phase;
    _state.cycleInRound = p.cycleInRound;
    _state.total = p.total;
    _state.remaining = p.remaining;
    _state.running = false;
    _state.manualModeOverride = false;
    _state.preOverride = null;
  }

  /** Cancel manual phase mid-run and restore the previous session (paused). */
  function cancelManual() {
    if (!_state.manualModeOverride) return;
    clearTimeout(handle); handle = null; endAt = null;
    restoreFromOverride();
    onChange?.(_state);
  }

  function schedule() {
    clearTimeout(handle);
    handle = setTimeout(tick, 250);
  }

  function tick() {
    if (!_state.running || !endAt) return;
    const remaining = (endAt - Date.now()) / 1000;
    _state.remaining = Math.max(0, remaining);
    if (remaining <= 0) {
      _state.remaining = 0;
      complete();
    } else {
      onTick?.(_state);
      schedule();
    }
  }

  function complete() {
    _state.running = false;
    endAt = null;
    clearTimeout(handle);

    const finishedPhase = _state.phase;
    const finishedTotal = _state.total;
    const wasManual = _state.manualModeOverride;

    // Manual focus is intentionally NOT counted toward daily pomodoros.
    if (finishedPhase === 'focus' && !wasManual) recordFocus?.(finishedTotal);

    onComplete?.({ finishedPhase, finishedTotal, wasManual });

    if (wasManual) {
      restoreFromOverride();
      onChange?.({ ..._state, autoCompleted: true, fromManual: true });
      return;
    }
    advancePhase(true);
  }

  function advancePhase(autoCompleted) {
    let nextPhase, nextCycle = _state.cycleInRound;
    if (_state.phase === 'focus') {
      nextPhase = _state.cycleInRound >= _settings.cyclesUntilLong ? 'long' : 'short';
    } else {
      nextPhase = 'focus';
      nextCycle = _state.phase === 'long'
        ? 1
        : Math.min(_state.cycleInRound + 1, _settings.cyclesUntilLong);
    }
    setPhase(nextPhase, nextCycle);
    onChange?.({ ..._state, autoCompleted });
    if (autoCompleted && _settings.autoStart) start();
  }

  function setPhase(phase, cycleInRound) {
    _state.phase = phase;
    _state.cycleInRound = cycleInRound;
    _state.total = durationFor(phase);
    _state.remaining = _state.total;
    _state.running = false;
  }

  return {
    start, pause, reset, skip, jumpTo,
    startManual, cancelManual,
    getState, getSettings, setSettings,
    durationFor,
  };
}
