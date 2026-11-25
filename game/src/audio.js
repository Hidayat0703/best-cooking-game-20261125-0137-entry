// Warung Kilat's sound: tiny WebAudio bleeps for chop, sizzle, serve and
// mistakes. Created lazily on the first gesture, silent when audio is
// unavailable — the game never depends on it.
export function createAudio() {
  let ctx = null;
  let sizzle = null;

  function ensure() {
    if (ctx !== null) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (AC === undefined) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, gain) {
    const ac = ensure();
    if (ac === null) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type ?? 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain ?? 0.12, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  }

  function noise(dur, gain) {
    const ac = ensure();
    if (ac === null) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = gain ?? 0.15;
    src.connect(g);
    g.connect(ac.destination);
    src.start();
  }

  return {
    unlock() {
      const ac = ensure();
      if (ac !== null && ac.state === 'suspended') void ac.resume();
    },
    pickup() {
      tone(520, 0.08, 'triangle', 0.1);
    },
    place() {
      tone(300, 0.08, 'triangle', 0.1);
    },
    chop() {
      noise(0.07, 0.18);
    },
    fryDone() {
      tone(660, 0.1, 'sine', 0.1);
      setTimeout(() => tone(880, 0.12, 'sine', 0.1), 90);
    },
    serve() {
      tone(523, 0.12, 'sine', 0.14);
      setTimeout(() => tone(659, 0.12, 'sine', 0.14), 110);
      setTimeout(() => tone(784, 0.18, 'sine', 0.14), 220);
    },
    expire() {
      tone(220, 0.25, 'sawtooth', 0.08);
    },
    trash() {
      tone(160, 0.15, 'square', 0.06);
    },
    setSizzle(on) {
      const ac = ensure();
      if (ac === null) return;
      if (on && sizzle === null) {
        const len = ac.sampleRate;
        const buffer = ac.createBuffer(1, len, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 4200;
        const g = ac.createGain();
        g.gain.value = 0.03;
        src.connect(filter);
        filter.connect(g);
        g.connect(ac.destination);
        src.start();
        sizzle = src;
      } else if (!on && sizzle !== null) {
        try {
          sizzle.stop();
        } catch {
          // Already stopped.
        }
        sizzle = null;
      }
    },
  };
}
