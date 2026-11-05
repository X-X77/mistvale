// 미니게임 효과음: 파일 없이 WebAudio 로 만듭니다(저작권 문제 없음). 사용자가 미니게임에서 직접 켜고 끌 수 있고, 브라우저 정책상 첫 입력 뒤에만 소리가 납니다.
//  - 같은 소리가 너무 촘촘히 겹치지 않도록 소리마다 최소 간격(MIN_GAP)을 두고, 한꺼번에 울리는 소리 수(MAX_VOICES)도 제한합니다.
//  - 전체 음량(master)은 낮게 잡아 사이트의 배경음악과 부딪히지 않게 합니다.
const MIN_GAP = { rustle:.09, tick:.035, chop:.05, nibble:.06, splash:.08, plop:.1, 'hit-perfect':.06, 'hit-good':.06, 'hit-weak':.06, 'hit-miss':.06, sizzle:.25, bubble:.07, drip:.4, rubble:.12, crack:.08, ui:.04, coin:.05, leaf:.07, find:.08, collect:.05, stir:.06, drop:.06 };
const MAX_VOICES = 20;
export class Sfx {
  constructor() { this.enabled = true; this.ctx = null; this.master = null; this.noise = null; this.hum = null; this.voices = 0; this.lastAt = {}; }
  setEnabled(on) { this.enabled = !!on; if (!on) this.stopHum(); }
  #ctx() {
    if (!this.enabled) return null;
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
      if (!this.ctx) {
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = .5; this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch { return null; }
  }
  // 톤: freq → freq2 로 미끄러지는 단음
  tone({ f = 440, f2 = f, dur = .15, type = 'sine', vol = .15, at = 0, attack = .005 } = {}) {
    const ctx = this.#ctx(); if (!ctx || this.voices >= MAX_VOICES) return;
    try {
      this.voices++;
      const t = ctx.currentTime + at, osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t); if (f2 !== f) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
      osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + .02);
      osc.onended = () => { this.voices = Math.max(0, this.voices - 1); osc.disconnect(); g.disconnect(); };
    } catch { /* 소리는 게임을 막지 않습니다 */ }
  }
  // 잡음: 필터를 거친 짧은 소리(물보라, 불꽃, 부스러기)
  burst({ dur = .2, freq = 1200, q = 1, type = 'bandpass', vol = .2, at = 0, sweep = 0 } = {}) {
    const ctx = this.#ctx(); if (!ctx || this.voices >= MAX_VOICES) return;
    try {
      this.voices++;
      const t = ctx.currentTime + at, src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise; filter.type = type; filter.frequency.setValueAtTime(freq, t); if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur); filter.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
      src.connect(filter); filter.connect(g); g.connect(this.master); src.start(t, Math.random() * .5); src.stop(t + dur + .02);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); src.disconnect(); filter.disconnect(); g.disconnect(); };
    } catch { /* noop */ }
  }
  // 연속 입력(연타·빠른 마우스 이동)에도 소리가 뭉개지지 않게: 같은 소리는 최소 간격 안에서는 한 번만 납니다.
  play(name, a = 0) {
    const gap = MIN_GAP[name]; if (gap && this.ctx) { const now = this.ctx.currentTime; if (now - (this.lastAt[name] ?? -9) < gap) return; this.lastAt[name] = now; }
    switch (name) {
      case 'ui': this.tone({ f:620, f2:760, dur:.07, type:'triangle', vol:.08 }); break;
      case 'ok': this.tone({ f:523, dur:.12, type:'triangle', vol:.1 }); this.tone({ f:784, dur:.2, type:'triangle', vol:.1, at:.09 }); break;
      // 낚시 보강
      case 'plop': this.tone({ f:520, f2:170, dur:.14, type:'sine', vol:.16 }); this.burst({ dur:.2, freq:1100, q:.8, vol:.12, at:.02 }); this.burst({ dur:.3, freq:700, q:.6, vol:.07, at:.14 }); break;
      case 'catch': this.burst({ dur:.25, freq:1500, sweep:2, q:.7, vol:.14 }); this.tone({ f:660, f2:990, dur:.18, type:'triangle', vol:.1, at:.05 }); this.tone({ f:1320, dur:.25, type:'sine', vol:.07, at:.16 }); break;
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
      // 채집
      case 'rustle': this.burst({ dur:.12, freq:2800 + 600 * a, q:.7, vol:.05, sweep:.55 }); this.burst({ dur:.09, freq:5200, type:'highpass', vol:.025, at:.03 }); break;
      case 'leaf': this.burst({ dur:.2, freq:1900, q:.5, vol:.09, sweep:.35 }); this.burst({ dur:.14, freq:4200, type:'highpass', vol:.04, at:.05 }); this.tone({ f:280, f2:190, dur:.1, type:'sine', vol:.04 }); break;
      case 'find': this.tone({ f:880, dur:.1, type:'triangle', vol:.09 }); this.tone({ f:1175, dur:.18, type:'triangle', vol:.09, at:.07 }); break;
      case 'gold': [1319, 1568, 1976, 2637].forEach((f, i) => this.tone({ f, dur:.2, type:'sine', vol:.065, at:i * .06 })); this.burst({ dur:.3, freq:6500, type:'highpass', vol:.025, at:.1 }); break;
      case 'collect': this.tone({ f:600, f2:920, dur:.09, type:'square', vol:.045 }); this.tone({ f:1240, dur:.13, type:'triangle', vol:.07, at:.06 }); break;
      case 'miss': this.tone({ f:250, f2:180, dur:.15, type:'triangle', vol:.07 }); this.burst({ dur:.1, freq:650, vol:.05 }); break;
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
      // 상점
      case 'coin': this.tone({ f:1319, dur:.09, type:'square', vol:.05 }); this.tone({ f:1976, dur:.22, type:'square', vol:.05, at:.07 }); break;
      case 'buy': this.tone({ f:520, f2:780, dur:.1, type:'triangle', vol:.1 }); this.tone({ f:1175, dur:.18, type:'triangle', vol:.08, at:.09 }); this.tone({ f:1568, dur:.22, type:'sine', vol:.05, at:.16 }); break;
      case 'deny': this.tone({ f:240, f2:170, dur:.16, type:'triangle', vol:.09 }); break;
      // 채광
      case 'hit-perfect': this.burst({ dur:.12, freq:2400, type:'highpass', vol:.3 }); this.tone({ f:1320, f2:880, dur:.35, type:'triangle', vol:.16 }); this.tone({ f:90, f2:50, dur:.25, type:'sine', vol:.3 }); break;
      case 'hit-good': this.burst({ dur:.1, freq:1800, type:'highpass', vol:.2 }); this.tone({ f:880, f2:640, dur:.22, type:'triangle', vol:.12 }); this.tone({ f:100, f2:55, dur:.2, type:'sine', vol:.24 }); break;
      case 'hit-weak': this.burst({ dur:.14, freq:900, vol:.18 }); this.tone({ f:140, f2:70, dur:.2, type:'sine', vol:.2 }); break;
      case 'hit-miss': this.burst({ dur:.18, freq:500, vol:.22, q:.4 }); this.tone({ f:70, f2:40, dur:.22, type:'sine', vol:.3 }); break;
      case 'rubble': for (let i = 0; i < 5; i++) this.tone({ f:900 + Math.random() * 1000, f2:260, dur:.045, type:'square', vol:.028, at:i * .055 + Math.random() * .03 }); break;
      case 'drip': this.tone({ f:1500, f2:780, dur:.07, type:'sine', vol:.05 }); this.tone({ f:700, f2:520, dur:.18, type:'sine', vol:.025, at:.08 }); break;
      case 'bubble': this.tone({ f:170 + Math.random() * 220, f2:260 + Math.random() * 300, dur:.07, type:'sine', vol:.05 + .03 * a }); break;
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
