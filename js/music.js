// MISTVALE opening BGM: one persistent media element to respect browser audio policies.
// No playback is attempted until the visitor clicks a game control or a music control.
export const MUSIC_TRACKS = Object.freeze({
  title: './assets/audio/title-theme.mp3',
  awakening: './assets/audio/awakening-theme.mp3',
});

export class Music {
  constructor({ tracks = MUSIC_TRACKS, audio = new Audio(), onChange = () => {} } = {}) {
    this.tracks = tracks;
    this.audio = audio;
    this.audio.loop = true;
    this.audio.preload = 'none';
    this.audio.volume = 0;
    this.onChange = onChange;
    this.enabled = true;
    this.unlocked = false;
    this.scene = 'title';
    this.track = null;
    this.timer = null;
    this.delayTimer = null;
    this.sequence = 0;
    this.levels = { title: 0.28, awakening: 0.20 };
  }

  isPlaying() { return this.enabled && this.unlocked && !this.audio.paused; }

  clearTimers() {
    clearInterval(this.timer);
    clearTimeout(this.delayTimer);
    this.timer = null;
    this.delayTimer = null;
  }

  fade(target, duration, done, seq = this.sequence) {
    clearInterval(this.timer);
    this.timer = null;
    if (duration <= 0) {
      this.audio.volume = target;
      done?.();
      return;
    }
    const initial = this.audio.volume;
    const started = performance.now();
    this.timer = setInterval(() => {
      if (seq !== this.sequence) { clearInterval(this.timer); this.timer = null; return; }
      const t = Math.min(1, (performance.now() - started) / duration);
      this.audio.volume = Math.min(1, Math.max(0, initial + (target - initial) * t));
      if (t >= 1) {
        clearInterval(this.timer);
        this.timer = null;
        done?.();
      }
    }, 40);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      ++this.sequence;
      this.clearTimers();
      this.audio.pause();
      this.audio.volume = 0;
    }
    this.onChange();
  }

  // Called synchronously in a real click event; a stored preference alone
  // never triggers automatic sound on initial page load.
  activate() {
    if (!this.enabled) return;
    this.unlocked = true;
    if (this.scene === 'transition') return;
    this.playTrack(this.scene === 'title' || this.scene === 'loading' ? 'title' : 'awakening');
  }

  setScene(scene, { delay = 0 } = {}) {
    this.scene = scene;
    if (scene === 'transition') {
      ++this.sequence;
      this.clearTimers();
      const seq = this.sequence;
      if (this.unlocked && this.enabled && !this.audio.paused) {
        this.fade(0, 700, () => { if (seq === this.sequence) this.audio.pause(); }, seq);
      }
      this.onChange();
      return;
    }
    if (scene === 'title' || scene === 'loading') {
      if (this.unlocked && this.enabled) this.playTrack('title');
      return;
    }
    if (scene === 'story') {
      if (this.unlocked && this.enabled) this.playTrack('awakening', { delay, fadeIn: 2200 });
    }
    // Notification / choice / result scenes keep the same awakening track.
  }

  playTrack(name, { delay = 0, fadeIn = 1100 } = {}) {
    if (!this.enabled || !this.unlocked || !this.tracks[name]) return;
    // Repeated requests (such as title -> loading) must not cancel playback.
    if (this.track === name && !this.audio.paused) return;
    ++this.sequence;
    this.clearTimers();
    const seq = this.sequence;
    const begin = () => {
      if (seq !== this.sequence || !this.enabled || !this.unlocked) return;
      if (this.track !== name) {
        this.audio.pause();
        this.audio.src = this.tracks[name];
        this.audio.volume = 0;
        this.track = name;
      }
      let playResult;
      try { playResult = this.audio.play(); }
      catch { this.unlocked = false; this.onChange(); return; }
      Promise.resolve(playResult).then(() => {
        if (seq !== this.sequence || !this.enabled) return;
        this.fade(this.levels[name], fadeIn, null, seq);
        this.onChange();
      }).catch(() => {
        if (seq === this.sequence) {
          this.unlocked = false;
          this.onChange(); // Display the explicit BGM play button again.
        }
      });
    };
    if (delay > 0) this.delayTimer = setTimeout(begin, delay);
    else begin();
  }
}