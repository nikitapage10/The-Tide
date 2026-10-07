/**
 * Generated sound for the home hero (Web Audio, no audio files). Off until the
 * visitor turns it on (browsers require a gesture, and sound should never
 * surprise anyone).
 *
 * - In space: a low "gravity" hum and a dark whoosh that swell gently with pointer
 *   speed, with a rare soft blip when moving fast.
 * - Over the planet (once it is revealed): an airy cloud swish instead.
 * - A storm surge (click on the planet): rolling thunder.
 */

/** Written by the hero scene each frame; read by the sound engine. */
export const heroSignal = { overPlanet: false, surgeAt: 0 };

export class HeroSound {
  private ctx: AudioContext;
  private master: GainNode;
  private hum: GainNode;
  private whoosh: GainNode;
  private whooshFilter: BiquadFilterNode;
  private swish: GainNode;
  private swishFilter: BiquadFilterNode;
  private noise: AudioBuffer;
  private speed = 0;
  /** Pointer speed as last measured; `speed` eases toward it (no sudden swells). */
  private target = 0;
  private last = { x: 0, y: 0, t: 0 };
  private raf = 0;
  private lastSurge = 0;
  private lastGlitch = 0;

  constructor() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.master.gain.setTargetAtTime(0.42, ctx.currentTime, 1.2);

    // Shared noise buffer (2 s, looped).
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Hum: two detuned low sines through a lowpass, slowly breathing.
    this.hum = ctx.createGain();
    this.hum.gain.value = 0.05;
    const humLp = ctx.createBiquadFilter();
    humLp.type = "lowpass";
    humLp.frequency.value = 180;
    for (const f of [41.2, 61.9]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.detune.value = Math.random() * 8 - 4;
      o.connect(humLp);
      o.start();
    }
    humLp.connect(this.hum).connect(this.master);

    // Whoosh: low band of noise, opened by pointer speed.
    this.whoosh = ctx.createGain();
    this.whoosh.gain.value = 0;
    this.whooshFilter = ctx.createBiquadFilter();
    this.whooshFilter.type = "bandpass";
    this.whooshFilter.frequency.value = 120;
    this.whooshFilter.Q.value = 0.9;
    this.loopNoise().connect(this.whooshFilter).connect(this.whoosh).connect(this.master);

    // Swish: airy higher band, for the clouds.
    this.swish = ctx.createGain();
    this.swish.gain.value = 0;
    this.swishFilter = ctx.createBiquadFilter();
    this.swishFilter.type = "bandpass";
    this.swishFilter.frequency.value = 1400;
    this.swishFilter.Q.value = 0.5;
    this.loopNoise().connect(this.swishFilter).connect(this.swish).connect(this.master);

    window.addEventListener("pointermove", this.onMove, { passive: true });
    this.tick();
  }

  private loopNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    src.start(0, Math.random() * 1.5);
    return src;
  }

  private onMove = (e: PointerEvent) => {
    const now = performance.now();
    const dt = Math.max(8, now - this.last.t);
    const v = Math.hypot(e.clientX - this.last.x, e.clientY - this.last.y) / dt; // px per ms
    this.last = { x: e.clientX, y: e.clientY, t: now };
    this.target = Math.max(this.target, Math.min(3, v));
    // A glitch tick now and then when moving fast through space.
    if (!heroSignal.overPlanet && v > 1.6 && now - this.lastGlitch > 1500 && Math.random() < 0.15) {
      this.lastGlitch = now;
      this.glitch();
    }
  };

  private tick = () => {
    const t = this.ctx.currentTime;
    this.target *= 0.94;
    this.speed += (this.target - this.speed) * 0.06;
    // Eased curve: small movements barely register, fast ones swell gently.
    const s0 = Math.min(1, this.speed / 1.8);
    const s = s0 * s0 * (3 - 2 * s0);
    const over = heroSignal.overPlanet;
    this.whoosh.gain.setTargetAtTime(over ? 0.015 * s : 0.22 * s, t, 0.35);
    this.whooshFilter.frequency.setTargetAtTime(90 + 200 * s, t, 0.4);
    this.swish.gain.setTargetAtTime(over ? 0.1 * s : 0, t, 0.35);
    this.swishFilter.frequency.setTargetAtTime(800 + 1200 * s, t, 0.4);
    this.hum.gain.setTargetAtTime(0.04 + 0.05 * s + 0.01 * Math.sin(t * 0.4), t, 0.5);
    if (heroSignal.surgeAt && heroSignal.surgeAt !== this.lastSurge) {
      this.lastSurge = heroSignal.surgeAt;
      this.thunder();
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  /** A faint, soft blip (a muffled sine chirp, no hard edges). */
  private glitch() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(700 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(260 + Math.random() * 120, t + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.012, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  private thunder() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    // Distant and rolling: a soft swell, a second murmur, a long tail.
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(110, t + 3.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.26, t + 0.35);
    g.gain.linearRampToValueAtTime(0.14, t + 0.9);
    g.gain.linearRampToValueAtTime(0.18, t + 1.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.6);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 3.7);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.onMove);
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.15);
    const ctx = this.ctx;
    setTimeout(() => void ctx.close(), 600);
  }
}
