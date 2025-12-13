// frontend/src/components/amogusPalette.js
//
// Purpose:
// - Generate a BIG set of (mid, shadow) color-pairs for recoloring your single amogus sprite.
// - Each palette is ALWAYS a paired "mid + darker shadow" of the SAME hue (no random red+blue mixes).
// - Uses HSL -> RGB so you can crank out tons of distinct colors without hand-writing them.
//
// Export:
//   buildAmogusPalettes(options?) -> { [name]: { mid:{r,g,b}, shadow:{r,g,b} } }
//
// Notes:
// - This does NOT recolor anything by itself. It only produces the palette map.
// - Keep "mid" and "shadow" luminance separated so the suit retains shading depth.
//
// DJ knobs:
// - count: number of procedural hues (more = more colors)
// - sat: saturation for vividness (0..1)
// - midL / shadowL: lightness for mid & shadow (0..1)
// - hueJitter: small hue offset pattern to avoid looking "evenly spaced"
// - addNeutrals: include white/gray/black/gold/skin-ish extras

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function hslToRgb(h, s, l) {
  // h: 0..360, s/l: 0..1
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);

  const hh = h / 360;

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Small deterministic “jitter” pattern so palettes don’t feel like evenly-spaced paint chips.
function jitterForIndex(i, amount) {
  // repeating sequence to break uniformity without true randomness
  const seq = [0, 1, -1, 2, -2, 3, -3, 1.5, -1.5, 2.5, -2.5];
  return (seq[i % seq.length] || 0) * amount;
}

export function buildAmogusPalettes(options = {}) {
  const {
    // crank this up for “as many as possible”
    // 360 gives essentially 1-degree hues; 240 is already huge.
    count = 360,

    // vivid but not neon-burn
    sat = 0.86,

    // keep shading consistent
    midL = 0.56,
    shadowL = 0.36,

    // optional slight hue offsets (degrees)
    hueJitter = 0.9,

    // add extra neutrals & special tones
    addNeutrals = true,
  } = options;

  const out = {};

  // Generate a full hue sweep.
  // We deliberately do not name them “red/blue/etc” because count may be huge.
  for (let i = 0; i < count; i++) {
    const baseHue = (i * (360 / count)) % 360;
    const hue = (baseHue + jitterForIndex(i, hueJitter)) % 360;

    const mid = hslToRgb(hue, sat, midL);
    const shadow = hslToRgb(hue, sat, shadowL);

    // Name format: p000..p359 (stable and sortable)
    const name = `p${String(i).padStart(3, "0")}`;
    out[name] = { mid, shadow };
  }

  if (addNeutrals) {
    // Clean neutrals
    out.white = {
      mid: { r: 245, g: 245, b: 248 },
      shadow: { r: 205, g: 205, b: 212 },
    };
    out.silver = {
      mid: { r: 210, g: 214, b: 224 },
      shadow: { r: 150, g: 156, b: 170 },
    };
    out.gray = {
      mid: { r: 160, g: 165, b: 175 },
      shadow: { r: 105, g: 110, b: 120 },
    };
    out.charcoal = {
      mid: { r: 80, g: 86, b: 98 },
      shadow: { r: 35, g: 38, b: 44 },
    };
    out.black = {
      mid: { r: 55, g: 55, b: 62 },
      shadow: { r: 18, g: 18, b: 22 },
    };

    // Metals / warm specials
    out.gold = {
      mid: { r: 244, g: 201, b: 85 },
      shadow: { r: 168, g: 121, b: 28 },
    };
    out.copper = {
      mid: { r: 204, g: 120, b: 76 },
      shadow: { r: 130, g: 70, b: 38 },
    };
    out.roseGold = {
      mid: { r: 220, g: 154, b: 150 },
      shadow: { r: 150, g: 96, b: 92 },
    };

    // Pastels (still paired mid/shadow)
    out.pastelMint = { mid: hslToRgb(155, 0.55, 0.70), shadow: hslToRgb(155, 0.55, 0.48) };
    out.pastelPink = { mid: hslToRgb(335, 0.55, 0.72), shadow: hslToRgb(335, 0.55, 0.50) };
    out.pastelLav = { mid: hslToRgb(255, 0.50, 0.72), shadow: hslToRgb(255, 0.50, 0.50) };
    out.pastelBlue = { mid: hslToRgb(210, 0.55, 0.70), shadow: hslToRgb(210, 0.55, 0.48) };

    // “Neon-ish” but still readable
    out.neonLime = { mid: hslToRgb(98, 0.95, 0.58), shadow: hslToRgb(98, 0.95, 0.36) };
    out.neonCyan = { mid: hslToRgb(185, 0.95, 0.55), shadow: hslToRgb(185, 0.95, 0.34) };
    out.neonMagenta = { mid: hslToRgb(305, 0.95, 0.56), shadow: hslToRgb(305, 0.95, 0.35) };

    // Skin-ish / warm neutrals (if you want variety)
    out.sand = { mid: hslToRgb(35, 0.45, 0.62), shadow: hslToRgb(35, 0.45, 0.40) };
    out.tan = { mid: hslToRgb(28, 0.50, 0.56), shadow: hslToRgb(28, 0.50, 0.34) };
    out.mocha = { mid: hslToRgb(25, 0.45, 0.44), shadow: hslToRgb(25, 0.45, 0.26) };
  }

  return out;
}

export default buildAmogusPalettes;
