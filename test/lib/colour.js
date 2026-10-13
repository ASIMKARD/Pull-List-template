/* Colour maths for the tests (session 7): OKLCH to sRGB and back, the sRGB
   gamut, and WCAG 2 contrast. An independent copy of the build's maths in
   tools/build.py, so a test checks the build's numbers rather than repeating
   them; 20-build and 40-look use it. */
'use strict';

const toLinear = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const toSrgb = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

function oklchLinear(L, C, H) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
const inGamut = (L, C, H) => oklchLinear(L, C, H).every(v => v >= 0 && v <= 1);
const oklchRgb = (L, C, H) => oklchLinear(L, C, H).map(v => Math.round(Math.min(Math.max(toSrgb(Math.min(Math.max(v, 0), 1)), 0), 1) * 255));
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

function rgbOklch(rgb) {
  const [r, g, b] = rgb.map(v => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180 / Math.PI) + 360) % 360];
}

function maxChroma(L, H) {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (inGamut(L, mid, H)) lo = mid; else hi = mid; }
  return lo;
}

const luminance = c => 0.2126 * toLinear(c[0] / 255) + 0.7152 * toLinear(c[1] / 255) + 0.0722 * toLinear(c[2] / 255);
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (fg, alpha, bg) => fg.map((f, i) => Math.round(alpha * f + (1 - alpha) * bg[i]));
const WHITE = [255, 255, 255];
const YEARS = 217 / 255;          /* the years in a Pull era box: white at 85 %, drawn at 8-bit alpha */

module.exports = { oklchLinear, inGamut, oklchRgb, rgbOklch, hexRgb, rgbHex, maxChroma, luminance, contrast, over, WHITE, YEARS };
