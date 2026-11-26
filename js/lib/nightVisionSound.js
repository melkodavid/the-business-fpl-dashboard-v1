// Night-vision power-up, synthesised (no audio file): a little click, the
// rising capacitor whine as the tube charges, and a bright ping as it locks on.
// Only ever started from a button press, which is what lets browsers play sound.
export function playNightVisionWhine() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  let ac;
  try { ac = new AudioCtx(); } catch { return; }
  const now = ac.currentTime + 0.02;
  const master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);

  // the switch: a short burst of filtered noise
  const noise = ac.createBuffer(1, Math.round(ac.sampleRate * 0.03), ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const click = ac.createBufferSource();
  click.buffer = noise;
  const clickFilter = ac.createBiquadFilter();
  clickFilter.type = "bandpass"; clickFilter.frequency.value = 2400; clickFilter.Q.value = 1.2;
  const clickGain = ac.createGain();
  clickGain.gain.value = 0.35;
  click.connect(clickFilter).connect(clickGain).connect(master);
  click.start(now);

  // the whine: a pure tone sweeping up as it charges, with a faint flutter
  const whine = ac.createOscillator();
  whine.type = "sine";
  whine.frequency.setValueAtTime(700, now);
  whine.frequency.exponentialRampToValueAtTime(7200, now + 1.35);
  whine.frequency.setValueAtTime(7200, now + 1.9);
  const flutter = ac.createOscillator();
  const flutterDepth = ac.createGain();
  flutter.frequency.value = 26; flutterDepth.gain.value = 40;
  flutter.connect(flutterDepth).connect(whine.frequency);
  const whineGain = ac.createGain();
  whineGain.gain.setValueAtTime(0.0001, now);
  whineGain.gain.exponentialRampToValueAtTime(0.09, now + 0.12);
  whineGain.gain.setValueAtTime(0.09, now + 1.3);
  whineGain.gain.exponentialRampToValueAtTime(0.035, now + 1.6);
  whineGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
  whine.connect(whineGain).connect(master);

  // the lock-on ping
  const ping = ac.createOscillator();
  ping.type = "sine";
  ping.frequency.setValueAtTime(3600, now + 1.3);
  const pingGain = ac.createGain();
  pingGain.gain.setValueAtTime(0.0001, now + 1.3);
  pingGain.gain.exponentialRampToValueAtTime(0.16, now + 1.31);
  pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);
  ping.connect(pingGain).connect(master);

  whine.start(now); flutter.start(now); ping.start(now + 1.3);
  whine.stop(now + 2.7); flutter.stop(now + 2.7); ping.stop(now + 1.8);
  setTimeout(() => ac.close?.(), 3200);
}
