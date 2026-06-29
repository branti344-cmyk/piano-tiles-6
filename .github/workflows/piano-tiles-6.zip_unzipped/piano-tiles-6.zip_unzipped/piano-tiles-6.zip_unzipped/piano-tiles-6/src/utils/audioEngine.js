// ============================================================
// audioEngine.js — Web Audio API Engine
// Syncs tile generation to song BPM & melody notes
// ============================================================

import { NOTE_FREQUENCIES } from "../data/songs.js";

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bpm = 120;
    this.isPlaying = false;
    this._beatCallbacks = [];
    this._scheduledNotes = [];
    this._beatInterval = null;
    this._currentBeat = 0;
    this._song = null;
    this._noteIndex = 0;
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1.0;
    this.sfxGain.connect(this.ctx.destination);

    // Reverb impulse
    this._reverb = await this._buildReverb(1.5);
  }

  async _buildReverb(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
    }
    const node = this.ctx.createConvolver();
    node.buffer = buf;
    return node;
  }

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  setSfxVolume(v) {
    if (this.sfxGain) this.sfxGain.gain.value = Math.max(0, Math.min(1, v));
  }

  // ─── PLAY MELODIC NOTE ────────────────────────────────────
  playNote(noteName, when = 0, duration = 0.3, type = "triangle", vol = 0.5) {
    if (!this.ctx) return;
    const freq = NOTE_FREQUENCIES[noteName] || 440;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + when);

    // ADSR envelope
    const t = this.ctx.currentTime + when;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);      // attack
    gain.gain.linearRampToValueAtTime(vol * 0.7, t + 0.08); // decay
    gain.gain.setValueAtTime(vol * 0.7, t + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, t + duration);    // release

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // ─── TILE HIT SFX ─────────────────────────────────────────
  playHitSound(noteIndex = 0, song = null) {
    if (!this.ctx) return;
    const notes = song?.melodyNotes || ["C5","E5","G5","A5"];
    const noteName = notes[noteIndex % notes.length];
    this.playNote(noteName, 0, 0.25, "sine", 0.6);
    // layered chord shimmer
    this.playNote(noteName, 0, 0.18, "triangle", 0.2);
  }

  playMissSound() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playComboSound(comboCount) {
    if (!this.ctx) return;
    const baseFreq = 400 + Math.min(comboCount, 20) * 30;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playCountdown(num) {
    if (!this.ctx) return;
    const freq = num === 0 ? 880 : 440;
    this.playNote("A4", 0, 0.3, "sine", num === 0 ? 0.8 : 0.5);
  }

  // ─── BEAT SCHEDULER ───────────────────────────────────────
  startBeat(song, onBeat) {
    if (!song) return;
    this._song = song;
    this._currentBeat = 0;
    this._noteIndex = 0;
    this.bpm = song.bpm;
    this.isPlaying = true;

    const msPerBeat = (60 / this.bpm) * 1000;
    const patternLen = song.beatPattern.length;

    this._beatInterval = setInterval(() => {
      const patternStep = this._currentBeat % patternLen;
      const isActive = song.beatPattern[patternStep] === 1;

      if (isActive) {
        // Auto-play backing melody softly
        const noteName = song.melodyNotes[this._noteIndex % song.melodyNotes.length];
        this.playNote(noteName, 0, 0.2, "triangle", 0.12);
        this._noteIndex++;
        onBeat && onBeat(this._currentBeat, patternStep, isActive);
      }
      this._currentBeat++;
    }, msPerBeat / 4); // 16th note resolution
  }

  stopBeat() {
    this.isPlaying = false;
    if (this._beatInterval) {
      clearInterval(this._beatInterval);
      this._beatInterval = null;
    }
    this._currentBeat = 0;
    this._noteIndex = 0;
  }

  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume();
  }

  destroy() {
    this.stopBeat();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
