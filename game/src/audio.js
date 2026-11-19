// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum follows speed, the siren wails with the wanted level, and a
// small step sequencer plays a neon synthwave loop while you drive.
export function createAudio() {
  let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null;
  let muted = false, musicOn = false, musicTimer = 0, step = 0, sirenOsc = null, sirenGain = null;
  const NOTES = [55, 0, 55, 65.41, 55, 0, 82.41, 73.42, 55, 0, 55, 65.41, 98, 82.41, 73.42, 65.41];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
    } catch { return false; }
    return true;
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  return {
    unlock,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get isMuted() { return muted; },
    shoot() { noise(0.12, 0.5, 3000); tone(180, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.3, 800); },
    pickup() { tone(660, 0.12, 'sine', 0.25); setTimeout(() => tone(990, 0.18, 'sine', 0.25), 90); },
    cash() { tone(880, 0.1, 'sine', 0.22); setTimeout(() => tone(1320, 0.22, 'sine', 0.22), 100); },
    crash() { noise(0.3, 0.5, 500); },
    siren(on) { if (sirenGain) sirenGain.gain.value = on && !muted ? 0.05 : 0; },
    engine(speed, inCar) {
      if (!ensure()) return;
      engineGain.gain.value = inCar ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.002) : 0;
      engineOsc.frequency.value = 45 + Math.abs(speed) * 4;
      if (sirenGain && sirenGain.gain.value > 0) sirenOsc.frequency.value = 650 + 250 * Math.sin(ctx.currentTime * 3);
    },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.25), i * 110)); },
    busted() { tone(220, 0.6, 'sawtooth', 0.25, 110); },
    startMusic() { musicOn = true; },
    stopMusic() { musicOn = false; },
    // One sequencer step per call; main.js calls this every 0.14 s while playing.
    musicStep() {
      if (!musicOn || !ensure() || muted) return;
      const n = NOTES[step % NOTES.length];
      if (n) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = n;
        g.gain.setValueAtTime(0.5, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
        o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + 0.35);
      }
      if (step % 4 === 0) tone(110, 0.12, 'sine', 0.35, 55);
      step += 1;
    },
    get musicTimer() { return musicTimer; },
    set musicTimer(v) { musicTimer = v; },
  };
}
