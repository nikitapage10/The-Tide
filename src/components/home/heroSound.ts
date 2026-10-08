/**
 * Sound for the home hero (generated with Web Audio, plus the theme). Off until the
 * visitor turns it on (browsers require a gesture, and sound should never
 * surprise anyone).
 *
 * - In space: a low "gravity" hum and a dark whoosh that swell gently with pointer
 *   speed, with a rare soft blip when moving fast.
 * - Over the planet (once it is revealed): an airy cloud swish instead.
 * - A storm surge (click on the planet): rolling thunder.
 * - A gravity well (hold in open space): a low hum rising as it charges; on
 *   release a soft, deep pulse, deeper and longer the stronger the charge.
 * - Under it all, quietly, the Tide's theme on a loop (streamed, fading in;
 *   it steps back while a well charges, so the effects carry).
 * - Everything ducks while the Arrival narration plays (`tide:narration`).
 */

/** Written by the hero scene each frame; read by the sound engine. */
export const heroSignal = { overPlanet: false, surgeAt: 0, gravAt: 0, gravStrength: 0, charging: false, charge: 0, wellX: 0, wellY: 0 };

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
  private lastGrav = 0;
  private hum2: { o: OscillatorNode; g: GainNode } | null = null;
  private lastGlitch = 0;
  private music: HTMLAudioElement;
  private musicGain: GainNode;

  constructor() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.master.gain.setTargetAtTime(0.42, ctx.currentTime, 1.2);

    // The theme, low in the mix (streamed rather than decoded whole).
    this.music = new Audio("/audio/tide-theme.mp3");
    this.music.loop = true;
    this.music.preload = "auto";
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    ctx.createMediaElementSource(this.music).connect(this.musicGain).connect(this.master);
    this.musicGain.gain.setTargetAtTime(0.28, ctx.currentTime + 0.3, 2.5);
    void this.music.play().catch(() => {
      /* blocked or unavailable: the generated sound still plays */
    });

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
    // Charging a well: a low hum that rises with the charge.
    if (heroSignal.charging && !this.hum2) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 30;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(this.master);
      o.start();
      this.hum2 = { o, g };
    }
    if (this.hum2) {
      const c = heroSignal.charging ? heroSignal.charge : 0;
      this.hum2.o.frequency.setTargetAtTime(28 + 40 * c, t, 0.3);
      this.hum2.g.gain.setTargetAtTime(heroSignal.charging ? 0.02 + 0.18 * c : 0, t, heroSignal.charging ? 0.4 : 0.05);
      if (!heroSignal.charging) {
        const h = this.hum2;
        this.hum2 = null;
        h.o.stop(t + 0.4);
      }
    }
    // The theme steps back while a well charges, and returns after.
    this.musicGain.gain.setTargetAtTime(heroSignal.charging ? 0.28 * (1 - 0.65 * heroSignal.charge) : 0.28, t, heroSignal.charging ? 0.6 : 2.0);
    if (heroSignal.gravAt && heroSignal.gravAt !== this.lastGrav) {
      this.lastGrav = heroSignal.gravAt;
      this.pulse(heroSignal.gravStrength);
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

  /** A deep, soft pulse: a low sine falling in pitch, with a breath of air;
   *  deeper, louder and longer the stronger the well was charged (0..1). */
  private pulse(strength = 0.3) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = 1.2 + 2.2 * strength;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(78 - 18 * strength, t);
    o.frequency.exponentialRampToValueAtTime(26 - 6 * strength, t + len * 0.75);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 + 0.3 * strength, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + len + 0.1);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(300, t + 0.05);
    bp.frequency.exponentialRampToValueAtTime(90, t + len);
    bp.Q.value = 0.8;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, t + 0.05);
    gn.gain.linearRampToValueAtTime(0.03 + 0.07 * strength, t + 0.25);
    gn.gain.exponentialRampToValueAtTime(0.001, t + len + 0.3);
    src.connect(bp).connect(gn).connect(this.master);
    src.start(t + 0.05, Math.random());
    src.stop(t + len + 0.4);
    // Stronger releases hit harder: from about half charge a deep impact and a
    // crack; at full charge a second impact and a long low rumble as well.
    if (strength > 0.45) {
      this.hit(t + 0.01, 0.2 + 0.3 * strength);
      this.crack(t, 0.08 + 0.12 * strength, 0.12, 900);
    }
    if (strength > 0.8) {
      this.hit(t + 0.45, 0.3);
      for (let i = 0; i < 6; i++) this.crack(t + 0.1 + Math.random() * 0.8, 0.03 + Math.random() * 0.04, 0.05, 1500 + Math.random() * 2500);
      const r = ctx.createBufferSource();
      r.buffer = this.noise;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(220, t);
      lp.frequency.exponentialRampToValueAtTime(60, t + 4);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.25, t + 0.3);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 4.2);
      r.connect(lp).connect(g2).connect(this.master);
      r.start(t, Math.random());
      r.stop(t + 4.3);
    }
  }

  /** A short burst of filtered noise (a crackle or the strike's crack). */
  private crack(at: number, gain: number, dur: number, freq: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(hp).connect(g).connect(this.master);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.02);
  }

  /** A deep hit: a low sine dropping in pitch, with a soft (not clipped) attack. */
  private hit(at: number, gain: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(64, at);
    o.frequency.exponentialRampToValueAtTime(32, at + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.9);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 1);
  }

  private thunder() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // The strike: a crack and a deep hit, crackles running on for a moment,
    // a second (softer) hit, then the rolling rumble below.
    this.crack(t, 0.22, 0.14, 1800);
    this.hit(t + 0.01, 0.42);
    for (let i = 0; i < 9; i++) {
      const at = t + 0.08 + Math.random() * 0.9 * (i / 9 + 0.1);
      this.crack(at, 0.03 + Math.random() * 0.06, 0.02 + Math.random() * 0.05, 2500 + Math.random() * 3000);
    }
    this.hit(t + 0.7 + Math.random() * 0.4, 0.26);
    this.crack(t + 0.72 + Math.random() * 0.3, 0.1, 0.1, 1400);
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

  /** Step back (or return) while the narration speaks. */
  duck(on: boolean) {
    this.master.gain.setTargetAtTime(on ? 0.1 : 0.42, this.ctx.currentTime, 0.6);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("pointermove", this.onMove);
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.15);
    const ctx = this.ctx;
    const music = this.music;
    setTimeout(() => {
      music.pause();
      music.removeAttribute("src");
      music.load();
      void ctx.close();
    }, 600);
  }
}
