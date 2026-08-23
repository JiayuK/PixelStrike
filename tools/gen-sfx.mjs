// Generates comprehensive HD 16-bit mono WAV game audio into client/public/sfx/.
// Zero external dependencies. Run: node tools/gen-sfx.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../client/public/sfx');
mkdirSync(outDir, { recursive: true });

function wav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0.92 ? 0.92 / peak : 1;
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(samples[i] * gain * 32767 | 0, 44 + i * 2);
  writeFileSync(join(outDir, name + '.wav'), buf);
}
const sec = s => Math.floor(s * SR);

let seed = 1337;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

function gunshot(dur, punch, low, tailLow = 0.08, crackGain = 0.8) {
  const n = sec(dur), out = new Float64Array(n);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.exp(-t * punch);
    const tail = Math.exp(-t * 7) * 0.38;
    const noise = rnd() * 2 - 1;
    lp += (noise - lp) * low;
    lp2 += (noise - lp2) * tailLow;
    const crack = t < 0.006 ? noise * crackGain * (1 - t / 0.006) : 0;
    out[i] = (lp * 0.82 + lp2 * tail + crack) * env + Math.sin(t * 115 * Math.PI * 2) * env * 0.28;
  }
  return out;
}

function tone(freq, dur, type = 'sine', vol = 0.5, decay = 8) {
  const n = sec(dur), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, ph = 2 * Math.PI * freq * t;
    const w = type === 'square' ? Math.sign(Math.sin(ph))
      : type === 'saw' ? ((freq * t) % 1) * 2 - 1
      : type === 'noise' ? rnd() * 2 - 1
      : Math.sin(ph);
    out[i] = w * vol * Math.exp(-t * decay);
  }
  return out;
}

function sweep(f0, f1, dur, vol = 0.5, decay = 4) {
  const n = sec(dur), out = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + (f1 - f0) * (i / n);
    ph += 2 * Math.PI * f / SR;
    out[i] = Math.sin(ph) * vol * Math.exp(-(i / SR) * decay);
  }
  return out;
}

function mix(...parts) {
  const n = Math.max(...parts.map(p => p.length));
  const out = new Float64Array(n);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

function cat(...parts) {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float64Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function delayed(part, delay, gain = 1) {
  const out = new Float64Array(part.length + sec(delay));
  const offset = sec(delay);
  for (let i = 0; i < part.length; i++) out[offset + i] = part[i] * gain;
  return out;
}

// 1. Weapon gunshots
wav('fire_awp', mix(
  gunshot(0.95, 7, 0.16, 0.035, 1), tone(48, 0.82, 'sine', 0.88, 3.5), sweep(340, 36, 0.58, 0.46),
  delayed(gunshot(0.34, 13, 0.08, 0.025, 0.12), 0.09, 0.24), delayed(tone(42, 0.5, 'sine', 0.55, 5), 0.14, 0.25)));
wav('fire_glock', mix(
  gunshot(0.24, 31, 0.46, 0.12, 0.82), tone(175, 0.09, 'square', 0.16, 38),
  delayed(tone(2200, 0.035, 'square', 0.16, 55), 0.012), delayed(gunshot(0.1, 36, 0.2, 0.08, 0.08), 0.048, 0.1)));
wav('fire_deagle', mix(
  gunshot(0.5, 14, 0.27, 0.055, 0.95), tone(72, 0.38, 'sine', 0.62, 7), sweep(520, 75, 0.22, 0.22, 13),
  delayed(gunshot(0.2, 22, 0.11, 0.04, 0.1), 0.07, 0.18)));
wav('fire_mp5', mix(
  gunshot(0.19, 39, 0.13, 0.035, 0.16), tone(105, 0.12, 'sine', 0.42, 24), sweep(360, 90, 0.08, 0.16, 35),
  delayed(tone(1450, 0.025, 'square', 0.12, 70), 0.018)));
wav('fire_ak47', mix(
  gunshot(0.46, 15, 0.3, 0.045, 1), tone(88, 0.3, 'square', 0.34, 9), sweep(760, 92, 0.2, 0.24, 15),
  delayed(gunshot(0.2, 20, 0.1, 0.03, 0.12), 0.065, 0.2)));
wav('fire_m4a4', mix(
  gunshot(0.36, 20, 0.36, 0.065, 0.9), tone(122, 0.2, 'square', 0.24, 14), sweep(980, 130, 0.13, 0.2, 22),
  delayed(gunshot(0.15, 27, 0.13, 0.04, 0.08), 0.052, 0.14)));

// 2. Combat impact & hit sounds
wav('headshot_ding', mix(tone(1760, 0.4, 'sine', 0.6, 8), tone(2640, 0.25, 'sine', 0.35, 12), tone(880, 0.3, 'square', 0.15, 10)));
wav('hitmarker', mix(tone(2200, 0.06, 'sine', 0.5, 45), tone(1100, 0.04, 'square', 0.3, 50)));
wav('death', mix(sweep(320, 45, 0.8, 0.6, 3), tone(80, 0.5, 'sine', 0.4, 6)));
wav('hurt', mix(sweep(240, 80, 0.25, 0.6, 8), tone(110, 0.2, 'saw', 0.3, 14)));

// 3. Movement & weapon mechanics
wav('step', mix(tone(80, 0.06, 'sine', 0.25, 40), tone(120, 0.04, 'noise', 0.2, 55)));
wav('reload_click', cat(tone(1350, 0.035, 'noise', 0.34, 70), tone(560, 0.055, 'square', 0.28, 36), tone(1900, 0.04, 'square', 0.2, 60)));
wav('bolt_rack', cat(tone(380, 0.07, 'saw', 0.3, 22), tone(900, 0.055, 'noise', 0.32, 48), tone(1450, 0.04, 'square', 0.28, 38), tone(260, 0.05, 'sine', 0.2, 32)));
wav('mag_out', mix(cat(tone(2600, 0.025, 'square', 0.25, 60), tone(820, 0.065, 'noise', 0.3, 34)), tone(170, 0.055, 'sine', 0.22, 34)));
wav('mag_in', mix(cat(tone(145, 0.075, 'sine', 0.55, 28), tone(1950, 0.035, 'square', 0.36, 52)), tone(620, 0.085, 'noise', 0.34, 28), delayed(tone(3400, 0.025, 'saw', 0.22, 70), 0.055)));
wav('bolt_cycle', cat(tone(480, 0.065, 'saw', 0.32, 28), tone(1500, 0.045, 'noise', 0.32, 42), tone(2350, 0.035, 'square', 0.4, 58), tone(210, 0.055, 'sine', 0.28, 34)));
wav('empty_click', mix(tone(3400, 0.02, 'saw', 0.34, 85), tone(780, 0.035, 'triangle', 0.22, 52)));
wav('knife_slash', mix(sweep(1350, 240, 0.15, 0.42, 15), tone(760, 0.075, 'noise', 0.3, 38)));
wav('knife_hit', mix(tone(135, 0.13, 'sine', 0.65, 20), tone(1750, 0.035, 'saw', 0.45, 48), tone(580, 0.055, 'noise', 0.32, 30)));
wav('weapon_switch', cat(tone(1900, 0.025, 'noise', 0.26, 65), tone(760, 0.045, 'square', 0.22, 42), tone(1500, 0.035, 'saw', 0.26, 48)));
wav('grenade_explode', mix(gunshot(0.9, 7, 0.12, 0.035), tone(48, 0.8, 'sine', 0.9, 3)));
console.log('generated 21 game WAV audio assets');
