// No audio is created until an explicit opt-in and a user gesture.
export class Sound {
  enabled = false;
  context = null;
  setEnabled(value) { this.enabled = value; if (!value && this.context) this.context.suspend().catch(() => {}); }
  async play(kind = 'click') {
    if (!this.enabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.context ||= new Audio();
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this.enabled) return;
      const ctx = this.context, start = ctx.currentTime;
      const gain = ctx.createGain(), osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(kind === 'arrival' ? 523 : 740, start);
      osc.frequency.exponentialRampToValueAtTime(kind === 'arrival' ? 262 : 520, start + .25);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.035, start + .02);
      gain.gain.exponentialRampToValueAtTime(.001, start + .4);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(start + .42);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch { /* Audio must never block the story. */ }
  }
}
