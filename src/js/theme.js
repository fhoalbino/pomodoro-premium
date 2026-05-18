/* ==========================================================================
   theme.js - Phase theme presets, color math, picker preview and persistence
   ========================================================================== */

const STORAGE_KEY = 'pomo.theme.v2';
const LEGACY_STORAGE_KEY = 'pomo.theme.v1';

export const PHASE_KEYS = Object.freeze(['focus', 'short', 'long']);

const STORAGE_PHASE = Object.freeze({
  focus: 'focus',
  short: 'shortBreak',
  long: 'longBreak',
});

const UI_PHASE = Object.freeze({
  focus: 'focus',
  shortBreak: 'short',
  longBreak: 'long',
});

const PHASE_LABELS = Object.freeze({
  focus: 'Foco',
  short: 'Pausa curta',
  long: 'Pausa longa',
});

const PRESET_THEMES = Object.freeze({
  gold: Object.freeze({
    name: 'gold',
    label: 'Gold',
    phases: Object.freeze({
      focus: Object.freeze({ primary: '#D4AF37', hover: '#F5D76E' }),
      short: Object.freeze({ primary: '#7DE3E8' }),
      long: Object.freeze({ primary: '#B884FF' }),
    }),
  }),
  pink: Object.freeze({
    name: 'pink',
    label: 'Pink',
    phases: Object.freeze({
      focus: Object.freeze({ primary: '#FF4FD8' }),
      short: Object.freeze({ primary: '#FFA8F0' }),
      long: Object.freeze({ primary: '#C58BFF' }),
    }),
  }),
  green: Object.freeze({
    name: 'green',
    label: 'Green',
    phases: Object.freeze({
      focus: Object.freeze({ primary: '#68DDBD' }),
      short: Object.freeze({ primary: '#8FF5D9' }),
      long: Object.freeze({ primary: '#9E8CFF' }),
    }),
  }),
});

const DEFAULT_THEME_NAME = 'gold';

let currentTheme = presetState(DEFAULT_THEME_NAME);
let previewTheme = null;

function root() {
  return document.documentElement;
}

function safeStorageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeStorageSet(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStorageState(payload)));
  } catch {}
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function activeTheme() {
  return previewTheme || currentTheme;
}

function presetState(themeName) {
  const preset = PRESET_THEMES[themeName] || PRESET_THEMES[DEFAULT_THEME_NAME];
  return {
    themeName: preset.name,
    phases: PHASE_KEYS.reduce((acc, phase) => {
      acc[phase] = {
        primary: normalizeHex(preset.phases[phase].primary),
      };
      return acc;
    }, {}),
  };
}

function toStorageState(theme) {
  return {
    themeName: theme.themeName,
    phases: PHASE_KEYS.reduce((acc, phase) => {
      acc[STORAGE_PHASE[phase]] = { primary: theme.phases[phase].primary };
      return acc;
    }, {}),
  };
}

function fromStorageState(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const phases = saved.phases;
  if (!phases || typeof phases !== 'object') return null;

  const normalized = {};
  for (const storagePhase of Object.keys(UI_PHASE)) {
    const phase = UI_PHASE[storagePhase];
    const primary = normalizeHex(phases[storagePhase]?.primary);
    if (!primary) return null;
    normalized[phase] = { primary };
  }

  return {
    themeName: Object.prototype.hasOwnProperty.call(PRESET_THEMES, saved.themeName)
      ? saved.themeName
      : 'custom',
    phases: normalized,
  };
}

function fromLegacyState(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const base = presetState(
    Object.prototype.hasOwnProperty.call(PRESET_THEMES, saved.themeName)
      ? saved.themeName
      : DEFAULT_THEME_NAME
  );

  if (saved.themeName === 'custom' && saved.isCustom) {
    const primary = normalizeHex(saved.customPrimaryColor);
    if (!primary) return base;
    base.themeName = 'custom';
    base.phases.focus.primary = primary;
  }

  return base;
}

function toHexPart(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
}

function mix(hex, target, amount) {
  const rgb = hexToRgb(hex);
  return rgbToHex({
    r: rgb.r + (target.r - rgb.r) * amount,
    g: rgb.g + (target.g - rgb.g) * amount,
    b: rgb.b + (target.b - rgb.b) * amount,
  });
}

function readableInk(hex) {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return luminance > 0.42 ? '#15100A' : '#F8F8F8';
}

function phaseTokens(phase, theme = activeTheme()) {
  const primary = theme.phases[phase]?.primary || PRESET_THEMES.gold.phases[phase].primary;
  const presetHover = PRESET_THEMES[theme.themeName]?.phases[phase]?.hover;
  const hover = presetHover && PRESET_THEMES[theme.themeName]?.phases[phase]?.primary === primary
    ? presetHover
    : mix(primary, { r: 255, g: 255, b: 255 }, 0.34);
  const accent = mix(primary, { r: 255, g: 255, b: 255 }, 0.18);
  const deep = mix(primary, { r: 0, g: 0, b: 0 }, 0.36);
  const { r, g, b } = hexToRgb(primary);

  return {
    primary,
    hover,
    accent,
    deep,
    ink: readableInk(primary),
    glow: `rgba(${r}, ${g}, ${b}, 0.38)`,
    glowSoft: `rgba(${r}, ${g}, ${b}, 0.18)`,
    line: `rgba(${r}, ${g}, ${b}, 0.11)`,
    lineHi: `rgba(${r}, ${g}, ${b}, 0.30)`,
    shadow: `0 12px 30px rgba(${r}, ${g}, ${b}, 0.28)`,
    shadowHover: `0 22px 60px rgba(${r}, ${g}, ${b}, 0.14), 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.28)`,
    shadowCard: `0 18px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.06)`,
  };
}

function setVars(style, vars) {
  Object.entries(vars).forEach(([name, value]) => {
    style.setProperty(name, value);
  });
}

function varsForMode(phase, theme = activeTheme()) {
  const tokens = phaseTokens(phase, theme);
  return {
    '--color-primary': tokens.primary,
    '--color-primary-hover': tokens.hover,
    '--color-hover': tokens.hover,
    '--color-primary-deep': tokens.deep,
    '--color-primary-ink': tokens.ink,
    '--color-accent': tokens.primary,
    '--color-glow': tokens.glow,
    '--color-line': tokens.line,
    '--color-line-hi': tokens.lineHi,
    '--border-primary': tokens.lineHi,
    '--shadow-primary': tokens.shadow,
    '--shadow-card': tokens.shadowCard,
    '--shadow-hover': tokens.shadowHover,
    '--accent': tokens.primary,
    '--accent-hi': tokens.hover,
    '--accent-glow': tokens.glow,
  };
}

function applyThemeVariables(theme = activeTheme()) {
  const style = root().style;
  PHASE_KEYS.forEach((phase) => {
    const prefix = phase === 'focus' ? 'focus' : phase === 'short' ? 'short' : 'long';
    const tokens = phaseTokens(phase, theme);
    setVars(style, {
      [`--${prefix}-primary`]: tokens.primary,
      [`--${prefix}-hover`]: tokens.hover,
      [`--${prefix}-glow`]: tokens.glow,
      [`--${prefix}-accent`]: tokens.accent,
      [`--${prefix}-shadow`]: tokens.shadow,
      [`--color-phase-${prefix}`]: tokens.primary,
      [`--color-phase-${prefix}-hi`]: tokens.hover,
      [`--color-phase-${prefix}-glow`]: tokens.glow,
    });
  });

  setVars(style, varsForMode('focus', theme));
  root().dataset.theme = theme.themeName;
}

function inferBasePreset(theme) {
  if (Object.prototype.hasOwnProperty.call(PRESET_THEMES, theme.themeName)) {
    return theme.themeName;
  }

  let bestName = DEFAULT_THEME_NAME;
  let bestScore = -1;
  Object.values(PRESET_THEMES).forEach((preset) => {
    const score = PHASE_KEYS.reduce((count, phase) => (
      theme.phases[phase]?.primary === preset.phases[phase].primary ? count + 1 : count
    ), 0);
    if (score > bestScore) {
      bestName = preset.name;
      bestScore = score;
    }
  });
  return bestName;
}

function saveCurrent(next) {
  currentTheme = clone(next);
  previewTheme = null;
  applyThemeVariables(currentTheme);
  safeStorageSet(currentTheme);
  return getCurrentTheme();
}

export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/;
  const full = /^#([0-9a-fA-F]{6})$/;

  if (short.test(trimmed)) {
    const [, raw] = trimmed.match(short);
    return `#${raw.split('').map((ch) => ch + ch).join('').toUpperCase()}`;
  }

  if (full.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error('Invalid HEX color');
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  return `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
}

export function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

export function hsvToRgb({ h, s, v }) {
  const hue = ((h % 360) + 360) % 360;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = v - chroma;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hue < 60) [rp, gp, bp] = [chroma, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, chroma, 0];
  else if (hue < 180) [rp, gp, bp] = [0, chroma, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, chroma];
  else if (hue < 300) [rp, gp, bp] = [x, 0, chroma];
  else [rp, gp, bp] = [chroma, 0, x];

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

export function hexToHsv(hex) {
  return rgbToHsv(hexToRgb(hex));
}

export function hsvToHex(hsv) {
  return rgbToHex(hsvToRgb(hsv));
}

export function getThemes() {
  return Object.values(PRESET_THEMES).map((theme) => ({
    name: theme.name,
    label: theme.label,
    phases: PHASE_KEYS.reduce((acc, phase) => {
      acc[phase] = { primary: theme.phases[phase].primary };
      return acc;
    }, {}),
  }));
}

export function getPhaseLabels() {
  return { ...PHASE_LABELS };
}

export function getCurrentTheme() {
  return clone(currentTheme);
}

export function getAppliedTheme() {
  return clone(activeTheme());
}

export function getPhaseColor(phase, theme = activeTheme()) {
  return theme.phases[phase]?.primary || PRESET_THEMES.gold.phases[phase].primary;
}

export function getPresetPhaseColor(themeName, phase) {
  const preset = PRESET_THEMES[themeName] || PRESET_THEMES[DEFAULT_THEME_NAME];
  return preset.phases[phase].primary;
}

export function getPhaseTokens(phase) {
  return { ...phaseTokens(phase) };
}

export function applyModeVariables(element, phase) {
  if (!element || !PHASE_KEYS.includes(phase)) return;
  setVars(element.style, varsForMode(phase));
}

export function applyTheme(themeName) {
  if (!Object.prototype.hasOwnProperty.call(PRESET_THEMES, themeName)) {
    return applyTheme(DEFAULT_THEME_NAME);
  }
  return saveCurrent(presetState(themeName));
}

export function previewPhaseColor(phase, hex) {
  const normalized = normalizeHex(hex);
  if (!PHASE_KEYS.includes(phase) || !normalized) {
    return { ok: false, error: 'Digite uma cor HEX valida, como #68DDBD ou #0FF.' };
  }

  previewTheme = clone(currentTheme);
  previewTheme.themeName = 'custom';
  previewTheme.phases[phase].primary = normalized;
  applyThemeVariables(previewTheme);
  return { ok: true, theme: getAppliedTheme() };
}

export function applyPhaseColor(phase, hex) {
  const normalized = normalizeHex(hex);
  if (!PHASE_KEYS.includes(phase) || !normalized) {
    return { ok: false, error: 'Digite uma cor HEX valida, como #68DDBD ou #0FF.' };
  }

  const next = previewTheme ? clone(previewTheme) : clone(currentTheme);
  next.themeName = 'custom';
  next.phases[phase].primary = normalized;
  saveCurrent(next);
  return { ok: true, theme: getCurrentTheme() };
}

export function restorePhaseDefault(phase) {
  if (!PHASE_KEYS.includes(phase)) return { ok: false };
  const source = inferBasePreset(currentTheme);
  return previewPhaseColor(phase, getPresetPhaseColor(source, phase));
}

export function cancelPreview() {
  previewTheme = null;
  applyThemeVariables(currentTheme);
  return getCurrentTheme();
}

export function resetTheme() {
  return applyTheme(DEFAULT_THEME_NAME);
}

export function restoreSavedTheme() {
  const savedV2 = fromStorageState(safeStorageGet(STORAGE_KEY));
  const savedLegacy = savedV2 || fromLegacyState(safeStorageGet(LEGACY_STORAGE_KEY));
  return saveCurrent(savedLegacy || presetState(DEFAULT_THEME_NAME));
}
