// 미니게임 효과음: 파일 없이 WebAudio 로 만듭니다. 사용자가 미니게임에서 직접 켜고 끌 수 있고, 브라우저 정책상 첫 입력 뒤에만 소리가 납니다.
export class Sfx {
  constructor() { this.enabled = true; this.ctx = null; this.master = null; this.noise = null; this.hum = null; }
  setEnabled(on) { this.enabled = !!on; if (!on) this.stopHum(); }
  #ctx() {
    if (!this.enabled) return null;
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
      if (!this.ctx) {
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = .55; this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch { return null; }
  }
  // 톤: freq → freq2 로 미끄러지는 단음
  tone({ f = 440, f2 = f, dur = .15, type = 'sine', vol = .15, at = 0, attack = .005 } = {}) {
    const ctx = this.#ctx(); if (!ctx) return;
    try {
      const t = ctx.currentTime + at, osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t); if (f2 !== f) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
      osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + .02);
      osc.onended = () => { osc.disconnect(); g.disconnect(); };
    } catch { /* 소리는 게임을 막지 않습니다 */ }
  }
  // 잡음: 필터를 거친 짧은 소리(물보라, 불꽃, 부스러기)
  burst({ dur = .2, freq = 1200, q = 1, type = 'bandpass', vol = .2, at = 0, sweep = 0 } = {}) {
    const ctx = this.#ctx(); if (!ctx) return;
    try {
      const t = ctx.currentTime + at, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise; filter.type = type; filter.frequency.setValueAtTime(freq, t); if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur); filter.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
      src.connect(filter); filter.connect(g); g.connect(this.master); src.start(t, Math.random() * .5); src.stop(t + dur + .02);
      src.onended = () => { src.disconnect(); filter.disconnect(); g.disconnect(); };
    } catch { /* noop */ }
  }
  play(name, a = 0) {
    switch (name) {
      case 'ui': this.tone({ f:620, f2:760, dur:.07, type:'triangle', vol:.08 }); break;
      case 'ok': this.tone({ f:523, dur:.12, type:'triangle', vol:.1 }); this.tone({ f:784, dur:.2, type:'triangle', vol:.1, at:.09 }); break;
      case 'cast': this.burst({ dur:.35, freq:3000, sweep:.2, vol:.1, q:.6 }); this.burst({ dur:.25, freq:500, vol:.14, at:.32 }); break;
      case 'splash': this.burst({ dur:.28, freq:900, q:.7, vol:.2 }); this.burst({ dur:.18, freq:2400, vol:.08, at:.04 }); break;
      case 'nibble': this.tone({ f:300, f2:240, dur:.07, vol:.06 }); break;
      case 'bite': this.tone({ f:392, f2:260, dur:.18, type:'square', vol:.1 }); this.burst({ dur:.22, freq:700, vol:.2 }); this.tone({ f:880, dur:.1, type:'triangle', vol:.12, at:.02 }); break;
      case 'hook': this.burst({ dur:.12, freq:1800, vol:.18 }); this.tone({ f:300, f2:620, dur:.12, type:'sawtooth', vol:.07 }); break;
      case 'early': this.tone({ f:330, f2:180, dur:.25, type:'sawtooth', vol:.08 }); break;
      case 'tick': this.tone({ f:1400 + 600 * a, dur:.025, type:'square', vol:.035 }); break;
      case 'warn': this.tone({ f:520, f2:700, dur:.16, type:'square', vol:.08 }); this.tone({ f:520, f2:700, dur:.16, type:'square', vol:.08, at:.2 }); break;
      case 'snap': this.burst({ dur:.18, freq:5000, type:'highpass', vol:.25 }); this.tone({ f:900, f2:90, dur:.35, type:'sawtooth', vol:.12 }); break;
      case 'lose': this.tone({ f:330, f2:150, dur:.45, type:'triangle', vol:.12 }); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, dur:.22, type:'triangle', vol:.1, at:i * .09 })); break;
      case 'level': [659, 784, 988, 1319].forEach((f, i) => this.tone({ f, dur:.25, type:'triangle', vol:.1, at:i * .08 })); break;
      // 요리
      case 'sizzle': this.burst({ dur:.5, freq:6000, type:'highpass', vol:.07 + .06 * a }); break;
      case 'flip': this.burst({ dur:.14, freq:600, vol:.15 }); this.tone({ f:220, f2:420, dur:.14, type:'triangle', vol:.08 }); break;
      case 'chop': this.burst({ dur:.07, freq:1500, type:'highpass', vol:.16 }); this.tone({ f:170 - 20 * a, f2:90, dur:.1, type:'triangle', vol:.16 }); break;
      case 'drop': this.burst({ dur:.16, freq:900, vol:.14 }); this.tone({ f:300 + 80 * a, f2:200, dur:.12, type:'sine', vol:.1 }); break;
      case 'stir': this.tone({ f:180 + 60 * a, f2:150, dur:.1, type:'sine', vol:.08 }); this.burst({ dur:.1, freq:500, vol:.06 }); break;
      case 'perfect': this.tone({ f:880, dur:.1, type:'triangle', vol:.1 }); this.tone({ f:1320, dur:.16, type:'triangle', vol:.1, at:.07 }); break;
      case 'good': this.tone({ f:700, dur:.1, type:'triangle', vol:.09 }); break;
      case 'bad': this.tone({ f:200, f2:140, dur:.2, type:'sawtooth', vol:.08 }); break;
      case 'bell': this.tone({ f:1568, dur:.5, type:'sine', vol:.1 }); this.tone({ f:2093, dur:.4, type:'sine', vol:.05, at:.01 }); break;
      // 채광
      case 'hit-perfect': this.burst({ dur:.12, freq:2400, type:'highpass', vol:.3 }); this.tone({ f:1320, f2:880, dur:.35, type:'triangle', vol:.16 }); this.tone({ f:90, f2:50, dur:.25, type:'sine', vol:.3 }); break;
      case 'hit-good': this.burst({ dur:.1, freq:1800, type:'highpass', vol:.2 }); this.tone({ f:880, f2:640, dur:.22, type:'triangle', vol:.12 }); this.tone({ f:100, f2:55, dur:.2, type:'sine', vol:.24 }); break;
      case 'hit-weak': this.burst({ dur:.14, freq:900, vol:.18 }); this.tone({ f:140, f2:70, dur:.2, type:'sine', vol:.2 }); break;
      case 'hit-miss': this.burst({ dur:.18, freq:500, vol:.22, q:.4 }); this.tone({ f:70, f2:40, dur:.22, type:'sine', vol:.3 }); break;
      case 'crack': this.burst({ dur:.3, freq:3500, sweep:.4, type:'highpass', vol:.22 }); break;
      case 'ore': [988, 1319, 1760].forEach((f, i) => this.tone({ f, dur:.3, type:'sine', vol:.09, at:i * .07 })); break;
      default: break;
    }
  }
  // 낚시 줄 긴장음(장력에 따라 높아지는 낮은 웅웅거림)
  humTo(level) {
    const ctx = this.#ctx(); if (!ctx) return;
    try {
      if (!this.hum) {
        const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'triangle'; osc.frequency.value = 160; g.gain.value = 0;
        osc.connect(g); g.connect(this.master); osc.start(); this.hum = { osc, g };
      }
      const t = ctx.currentTime;
      this.hum.osc.frequency.setTargetAtTime(150 + 520 * level * level, t, .06);
      this.hum.g.gain.setTargetAtTime(level < .45 ? 0 : .02 + .07 * (level - .45), t, .08);
    } catch { /* noop */ }
  }
  stopHum() { if (!this.hum) return; try { this.hum.g.gain.setTargetAtTime(0, this.ctx.currentTime, .05); const h = this.hum; setTimeout(() => { try { h.osc.stop(); h.osc.disconnect(); h.g.disconnect(); } catch {} }, 300); } catch {} this.hum = null; }
}
