// Generates comprehensive HD 16-bit mono WAV game audio into client/public/sfx/.
// Zero external dependencies. Run: node tools/gen-sfx.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../client/public/sfx');
mkdirSync(outDir, { recursive: true });

function wav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767 | 0, 44 + i * 2);
  writeFileSync(join(outDir, name + '.wav'), buf);
}
const sec = s => Math.floor(s * SR);

let seed = 1337;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

function gunshot(dur, punch, low, tailLow = 0.08) {
  const n = sec(dur), out = new Float64Array(n);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.exp(-t * punch);
    const tail = Math.exp(-t * 8) * 0.35;
    const noise = rnd() * 2 - 1;
    lp += (noise - lp) * low;
    lp2 += (noise - lp2) * tailLow;
    const crack = t < 0.008 ? noise * 0.8 : 0;
    out[i] = (lp * 0.85 + lp2 * tail + crack) * env + Math.sin(t * 120 * Math.PI * 2) * env * 0.3;
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

// 1. Weapon gunshots
wav('fire_awp', mix(gunshot(0.85, 8, 0.18, 0.05), tone(55, 0.6, 'sine', 0.8, 4), sweep(280, 40, 0.4, 0.4)));
wav('fire_glock', mix(gunshot(0.22, 30, 0.48), tone(170, 0.08, 'square', 0.18, 36)));
wav('fire_deagle', mix(gunshot(0.42, 16, 0.28), tone(80, 0.3, 'sine', 0.55, 8)));
wav('fire_mp5', mix(gunshot(0.16, 42, 0.55), tone(230, 0.05, 'saw', 0.2, 44)));
wav('fire_ak47', mix(gunshot(0.4, 17, 0.3), tone(92, 0.22, 'square', 0.36, 11)));
wav('fire_m4a4', mix(gunshot(0.32, 22, 0.38), tone(125, 0.16, 'square', 0.25, 16)));

// 2. Combat impact & hit sounds
wav('headshot_ding', mix(tone(1760, 0.4, 'sine', 0.6, 8), tone(2640, 0.25, 'sine', 0.35, 12), tone(880, 0.3, 'square', 0.15, 10)));
wav('hitmarker', mix(tone(2200, 0.06, 'sine', 0.5, 45), tone(1100, 0.04, 'square', 0.3, 50)));
wav('death', mix(sweep(320, 45, 0.8, 0.6, 3), tone(80, 0.5, 'sine', 0.4, 6)));
wav('hurt', mix(sweep(240, 80, 0.25, 0.6, 8), tone(110, 0.2, 'saw', 0.3, 14)));

// 3. Movement & weapon mechanics
wav('step', mix(tone(80, 0.06, 'sine', 0.25, 40), tone(120, 0.04, 'noise', 0.2, 55)));
wav('reload_click', cat(tone(1200, 0.04, 'noise', 0.4, 60), tone(600, 0.06, 'square', 0.3, 30), tone(1600, 0.05, 'square', 0.25, 50)));
wav('bolt_rack', cat(tone(400, 0.08, 'saw', 0.3, 20), tone(800, 0.06, 'noise', 0.35, 40), tone(1200, 0.05, 'square', 0.3, 30)));
wav('grenade_explode', mix(gunshot(0.9, 7, 0.12, 0.035), tone(48, 0.8, 'sine', 0.9, 3)));
console.log('generated 14 game WAV audio assets');
