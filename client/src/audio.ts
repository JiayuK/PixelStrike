// High-definition game audio engine with WebAudio fallback synthesis.

const SFX_NAMES = [
  'fire_glock', 'fire_deagle', 'fire_mp5', 'fire_ak47', 'fire_m4a4', 'fire_awp',
  'headshot_ding', 'hitmarker', 'death', 'hurt', 'grenade_explode',
  'step', 'reload_click', 'bolt_rack',
] as const;

export type SfxName = (typeof SFX_NAMES)[number];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();
  private lastPlayed = new Map<string, number>();
  private masterGain: GainNode | null = null;
  public volume = 0.8;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  private async load(name: SfxName) {
    if (!this.ctx || this.buffers.has(name) || this.loading.has(name)) return;
    this.loading.add(name);
    try {
      const res = await fetch(`/sfx/${name}.wav`);
      if (res.ok) this.buffers.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
    } catch { /* synthetic sound already played */ }
    finally { this.loading.delete(name); }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  play(name: SfxName, volume = 1, pitchRate = 1.0, pan = 0, priority = false) {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (!priority && now - last < 35) return; // spam deduplication
    this.lastPlayed.set(name, now);

    const buf = this.buffers.get(name);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = pitchRate;
      const g = this.ctx.createGain();
      const p = this.ctx.createStereoPanner();
      g.gain.value = volume;
      p.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(g).connect(p).connect(this.masterGain);
      src.start();
      return;
    }
    void this.load(name);
    this.synth(name, volume, pan);
  }

  private synth(name: SfxName, vol: number, pan: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    out.gain.value = vol * 0.5;
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(panner).connect(this.masterGain!);

    const osc = (type: OscillatorType, f0: number, f1: number, dur: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      o.connect(out);
      o.start(t0);
      o.stop(t0 + dur);
    };

    const noise = (dur: number, cutoff: number) => {
      const n = Math.floor(ctx.sampleRate * dur);
      const b = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / n * 8);
      const src = ctx.createBufferSource();
      src.buffer = b;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      src.connect(f).connect(out);
      src.start(t0);
    };

    switch (name) {
      case 'fire_glock':
        noise(0.18, 3800);
        osc('sine', 160, 45, 0.12);
        break;
      case 'fire_deagle':
        noise(0.32, 2800);
        osc('sine', 120, 30, 0.28);
        osc('triangle', 320, 60, 0.15);
        break;
      case 'fire_mp5':
        noise(0.14, 4500);
        osc('sine', 180, 70, 0.08);
        break;
      case 'fire_ak47':
        noise(0.28, 2600);
        osc('sawtooth', 220, 45, 0.22);
        osc('sine', 95, 30, 0.25);
        break;
      case 'fire_m4a4':
        noise(0.24, 3200);
        osc('triangle', 260, 55, 0.18);
        break;
      case 'fire_awp':
        noise(0.65, 1600);
        osc('sine', 75, 25, 0.6);
        osc('sawtooth', 140, 35, 0.35);
        break;
      case 'headshot_ding':
        // CS:GO iconic metallic DINK (twin crystal sine ringing)
        osc('sine', 2800, 2600, 0.35);
        osc('sine', 4200, 3900, 0.25);
        break;
      case 'grenade_explode':
        noise(0.85, 1200);
        osc('sine', 65, 20, 0.8);
        osc('triangle', 110, 30, 0.45);
        break;
      case 'hitmarker':
        osc('sine', 2400, 2400, 0.05);
        break;
      case 'death':
        osc('sawtooth', 280, 40, 0.6);
        break;
      case 'hurt':
        osc('sawtooth', 200, 70, 0.22);
        break;
      case 'step':
        osc('sine', 75, 75, 0.04);
        break;
      case 'reload_click':
        noise(0.06, 6000);
        osc('triangle', 600, 300, 0.05);
        break;
      case 'bolt_rack':
        osc('sawtooth', 350, 180, 0.12);
        noise(0.08, 4000);
        break;
    }
  }
}
