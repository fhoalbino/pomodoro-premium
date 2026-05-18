/* ==========================================================================
   audio.js — Web Audio API. Premium chime + soft click. No external files.
   ========================================================================== */

let ctx = null;
let masterGain = null;
let enabled = true;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function playPartial(freq, startOffset, duration, peak, dest) {
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const Audio = {
  ensure,

  setEnabled(v) { enabled = !!v; },

  /* Three descending sine notes through a lowpass: gentle, premium. */
  chime() {
    if (!enabled || !ensure()) return;
    const notes = [
      { f: 987.77, t: 0.00, d: 1.4, g: 0.20 }, // B5
      { f: 783.99, t: 0.18, d: 1.4, g: 0.16 }, // G5
      { f: 587.33, t: 0.36, d: 1.6, g: 0.14 }, // D5
    ];

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    lp.Q.value = 0.4;
    lp.connect(masterGain);

    for (const n of notes) {
      playPartial(n.f,     n.t, n.d,        n.g,        lp);
      playPartial(n.f * 2, n.t, n.d * 0.85, n.g * 0.18, lp);
      playPartial(n.f * 3, n.t, n.d * 0.6,  n.g * 0.06, lp);
    }
  },

  /* Tiny click for primary interactions. */
  tick() {
    if (!enabled || !ensure()) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    osc.type = 'triangle';
    osc.frequency.value = 1760;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.10);
    osc.connect(g).connect(hp).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  },
};
