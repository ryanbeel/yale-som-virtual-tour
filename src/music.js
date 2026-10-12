// "Ryan Jr. Island Stomp": an original 90-second surf-rock/tiki party tune, synthesized live with the
// Web Audio API (no audio files). 48 bars at 128 BPM:
//   intro 0-3 | verse 4-11 | chorus 12-19 | break 20-23 | VOLCANO 24-31 | big chorus 32-46 | final hit 47
// Bar 24 lands at exactly 45 s: a huge boom as the island's volcano erupts, then double-time chaos.
// Chords go C - Am - F - G. Drums, bass, tremolo-picked surf guitar and a tiki lead melody.

let ctx = null
let mix = null
let master = null
let noise = null
let timer = null
let muted = false
let t0 = 0
let step = 0
let stepDur = 0.117

const BARS = 48
const TOTAL = BARS * 16
const LEVEL = 0.8

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

export function prime() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    master = ctx.createGain()
    master.gain.value = muted ? 0 : LEVEL
    mix = ctx.createGain()
    mix.gain.value = 0.9
    mix.connect(comp).connect(master).connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
}

// for debugging: is audio running?
export const status = () => ({ audio: ctx?.state ?? 'none', playing: timer != null, muted })

export function setMuted(m) {
  muted = m
  if (master) master.gain.setTargetAtTime(m ? 0 : LEVEL, ctx.currentTime, 0.05)
}

export function play(bpm) {
  prime()
  if (!ctx) return
  stop()
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setValueAtTime(muted ? 0 : LEVEL, ctx.currentTime)
  stepDur = 60 / bpm / 4
  t0 = ctx.currentTime + 0.08
  step = 0
  timer = setInterval(schedule, 25)
}

export function stop() {
  if (timer) clearInterval(timer)
  timer = null
  if (!ctx) return
  const now = ctx.currentTime
  master.gain.cancelScheduledValues(now)
  master.gain.setTargetAtTime(0, now, 0.08)
  master.gain.setTargetAtTime(muted ? 0 : LEVEL, now + 0.6, 0.01)
}

// a short countdown blip (Concert calls this for the last few seconds)
export function blip(high = false) {
  if (!ctx || muted) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  const g = env(t, 0.25, 0.25)
  o.type = 'square'
  o.frequency.value = high ? 1320 : 880
  o.connect(g)
  o.start(t)
  o.stop(t + 0.3)
}

function schedule() {
  while (step < TOTAL && t0 + step * stepDur < ctx.currentTime + 0.25) {
    playStep(step, t0 + step * stepDur)
    step++
  }
  if (step >= TOTAL) {
    clearInterval(timer)
    timer = null
  }
}

// ---------- instruments
function env(t, peak, decay, attack = 0.003) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(mix)
  return g
}
function noiseSrc(t, dur) {
  const s = ctx.createBufferSource()
  s.buffer = noise
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur)
  return s
}
function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

function kick(t, v = 1) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
  o.connect(env(t, 0.9 * v, 0.35))
  o.start(t)
  o.stop(t + 0.4)
}
function snare(t, v = 1) {
  noiseSrc(t, 0.2).connect(filter('highpass', 1300)).connect(env(t, 0.45 * v, 0.17))
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = 190
  o.connect(env(t, 0.25 * v, 0.08))
  o.start(t)
  o.stop(t + 0.1)
}
function hat(t, open = false, v = 1) {
  noiseSrc(t, open ? 0.3 : 0.06).connect(filter('highpass', 7500)).connect(env(t, 0.16 * v, open ? 0.25 : 0.04))
}
function clap(t) {
  for (let i = 0; i < 3; i++) noiseSrc(t + i * 0.012, 0.15).connect(filter('bandpass', 1600, 1.2)).connect(env(t + i * 0.012, 0.35, i === 2 ? 0.14 : 0.02))
}
function crash(t) {
  noiseSrc(t, 1.8).connect(filter('highpass', 5000)).connect(env(t, 0.3, 1.6))
}
function tom(t, midi) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(hz(midi), t)
  o.frequency.exponentialRampToValueAtTime(hz(midi) * 0.65, t + 0.25)
  o.connect(env(t, 0.55, 0.28))
  o.start(t)
  o.stop(t + 0.32)
}
function bass(t, midi, dur) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = hz(midi)
  const f = filter('lowpass', 700, 5)
  f.frequency.setValueAtTime(1400, t)
  f.frequency.exponentialRampToValueAtTime(380, t + dur)
  o.connect(f).connect(env(t, 0.32, dur * 0.95, 0.006))
  o.start(t)
  o.stop(t + dur + 0.05)
}
function guitar(t, midi, v = 1) {
  const o = ctx.createOscillator()
  o.type = 'square'
  o.frequency.value = hz(midi)
  const o2 = ctx.createOscillator()
  o2.type = 'sawtooth'
  o2.frequency.value = hz(midi) * 1.004
  const f = filter('lowpass', 2400, 2)
  const g = env(t, 0.07 * v, stepDur * 1.6, 0.002)
  o.connect(f)
  o2.connect(f)
  f.connect(g)
  o.start(t)
  o2.start(t)
  o.stop(t + stepDur * 2)
  o2.stop(t + stepDur * 2)
}
function lead(t, midi, dur, v = 1) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = hz(midi)
  const vib = ctx.createOscillator()
  const vibAmt = ctx.createGain()
  vib.frequency.value = 6
  vibAmt.gain.value = hz(midi) * 0.012
  vib.connect(vibAmt).connect(o.frequency)
  const o2 = ctx.createOscillator()
  o2.type = 'square'
  o2.frequency.value = hz(midi + 12)
  const g2 = ctx.createGain()
  g2.gain.value = 0.18
  const g = env(t, 0.2 * v, dur, 0.01)
  o.connect(g)
  o2.connect(g2).connect(g)
  for (const x of [o, o2, vib]) {
    x.start(t)
    x.stop(t + dur + 0.05)
  }
}
// a rising whoosh (the shark is in the air)
function riser(t, dur) {
  const f = filter('bandpass', 400, 3)
  f.frequency.setValueAtTime(400, t)
  f.frequency.exponentialRampToValueAtTime(7000, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.6, t + dur)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05)
  g.connect(mix)
  noiseSrc(t, dur + 0.1).connect(f).connect(g)
}

// the shark lands: a huge distorted power chord
function powerChord(t, root) {
  const shaper = ctx.createWaveShaper()
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1
    curve[i] = Math.tanh(x * 6)
  }
  shaper.curve = curve
  const g = env(t, 0.32, 2.4, 0.005)
  shaper.connect(filter('lowpass', 3200)).connect(g)
  for (const n of [root, root + 7, root + 12, root + 19]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(n)
    o.connect(shaper)
    o.start(t)
    o.stop(t + 2.6)
  }
}

// the eruption: a deep falling rumble plus an explosion of noise
function boom(t) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(90, t)
  o.frequency.exponentialRampToValueAtTime(22, t + 2.5)
  o.connect(env(t, 1.0, 2.6, 0.01))
  o.start(t)
  o.stop(t + 2.8)
  noiseSrc(t, 3.2).connect(filter('lowpass', 900)).connect(env(t, 0.9, 3.0, 0.005))
  noiseSrc(t, 1.2).connect(filter('highpass', 2000)).connect(env(t, 0.35, 1.0))
}

function chordHit(t, notes, dur) {
  for (const n of notes) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(n)
    o.connect(filter('lowpass', 2000)).connect(env(t, 0.09, dur, 0.01))
    o.start(t)
    o.stop(t + dur + 0.1)
  }
}

// ---------- the song
const CHORDS = [
  { root: 48, triad: [60, 64, 67] }, // C
  { root: 45, triad: [57, 60, 64] }, // Am
  { root: 41, triad: [53, 57, 60] }, // F
  { root: 43, triad: [55, 59, 62] }, // G
]
// the hook: one bar of eighth notes per chord (null = rest)
const HOOK = [
  [76, 79, 81, 79, 76, 74, 72, null],
  [76, null, 76, 74, 72, 69, 72, null],
  [72, 76, 77, 76, 74, 72, 69, null],
  [74, 76, 79, null, 81, 79, 76, 74],
]

function section(bar) {
  if (bar < 4) return 'intro'
  if (bar < 12) return 'verse'
  if (bar < 20) return 'chorus'
  if (bar < 24) return 'break'
  if (bar < 32) return 'volcano'
  if (bar < 47) return 'chorus'
  return 'end'
}

function playStep(i, t) {
  const bar = Math.floor(i / 16)
  const s = i % 16
  const sec = section(bar)
  const prev = bar > 0 ? section(bar - 1) : null
  const ch = CHORDS[bar % 4]

  if (sec === 'end') {
    if (s === 0) {
      crash(t)
      kick(t, 1.2)
      chordHit(t, [...ch.triad.map((n) => n - 12), 72, 76, 79], 2.6)
      bass(t, 36, 2.4)
      lead(t, 84, 2.2)
    }
    return
  }

  // drums
  if (s === 0 && sec !== prev) crash(t)
  if (bar === 31 && s >= 8) {
    if (s === 8) riser(t, stepDur * 8)
    return
  }
  if (bar === 32 && s === 0) {
    powerChord(t, 52)
    kick(t, 1.3)
  }
  if (sec === 'volcano') {
    if (bar === 24 && s === 0) boom(t)
    if (s === 0) crash(t)
    if (s % 4 === 0 || s === 14) kick(t, 1.1)
    if (s === 4 || s === 12) {
      snare(t, 1.1)
      clap(t)
    }
    if (bar % 4 === 3 && s >= 8) snare(t, 0.5 + (s - 8) * 0.08)
    hat(t, s % 4 === 2)
  } else if (sec === 'intro') {
    if (s % 4 === 0) kick(t, 0.9)
    if (bar >= 2 && s % 2 === 0) hat(t)
    if (bar === 3 && s >= 8) snare(t, 0.4 + (s - 8) * 0.08)
  } else if (sec === 'verse') {
    if (s === 0 || s === 8 || s === 10) kick(t)
    if (s === 4 || s === 12) snare(t)
    if (s % 2 === 0) hat(t)
    if (bar % 8 === 7 && s >= 12) tom(t, 52 - (s - 12) * 3)
  } else if (sec === 'chorus') {
    if (s % 4 === 0) kick(t)
    if (s === 4 || s === 12) {
      snare(t)
      clap(t)
    }
    hat(t, s % 4 === 2, s % 2 ? 0.6 : 1)
    if ((bar % 4 === 3 && s === 14) || (bar >= 32 && s === 8 && bar % 2 === 1)) crash(t)
  } else if (sec === 'break') {
    if (s === 0) kick(t)
    if (s === 4 || s === 12) clap(t)
    if (bar === 23 && s >= 8) tom(t, 57 - (s - 8) * 2)
  }

  // bass
  if (sec === 'verse' && [0, 3, 6, 8, 11, 14].includes(s)) bass(t, ch.root, stepDur * 2.5)
  if (sec === 'chorus' && s % 2 === 0) bass(t, s % 4 === 2 ? ch.root + 12 : ch.root, stepDur * 1.8)
  if (sec === 'volcano') bass(t, s % 2 ? ch.root + 12 : ch.root, stepDur * 0.9)
  if (sec === 'break' && s === 0) bass(t, ch.root, stepDur * 14)
  if (sec === 'intro' && bar >= 2 && s % 4 === 0) bass(t, ch.root, stepDur * 3)

  // surf guitar: tremolo-picked chord tones
  if (sec === 'verse' || sec === 'chorus' || sec === 'volcano') guitar(t, ch.triad[(s >> 1) % 3] + (sec === 'verse' ? -12 : 0), sec === 'verse' ? 0.8 : 1.15)

  // shark shred solo: fast high chord-tone runs for 4 bars after it lands
  if (bar >= 32 && bar < 36) guitar(t, ch.triad[s % 3] + 12 + (s % 4 === 3 ? 12 : 0), 1.7)

  // lead hook (an octave down and softer in the second verse)
  if (s % 2 === 0) {
    const note = HOOK[bar % 4][s / 2]
    if (note != null) {
      if (sec === 'chorus') lead(t, note + (bar >= 36 ? 12 : 0), stepDur * 1.8)
      else if (sec === 'volcano') lead(t, note + 12, stepDur * 1.5, 0.9)
    }
  }
}

// ---------- DO NOT PRESS: sound effects for the 30-second giant Ryan Jr. event (scheduled all at once)
export function pressSfx() {
  prime()
  if (!ctx) return
  const t0 = ctx.currentTime + 0.05
  // 0-4 s: wailing siren
  {
    const o = ctx.createOscillator()
    o.type = 'square'
    for (let k = 0; k < 8; k++) {
      o.frequency.setValueAtTime(620, t0 + k * 0.5)
      o.frequency.linearRampToValueAtTime(980, t0 + k * 0.5 + 0.25)
      o.frequency.linearRampToValueAtTime(620, t0 + k * 0.5 + 0.5)
    }
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05)
    g.gain.setValueAtTime(0.12, t0 + 3.8)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.1)
    o.connect(filter('lowpass', 2500)).connect(g).connect(mix)
    o.start(t0)
    o.stop(t0 + 4.2)
  }
  // 3-13 s: the sea boils and the ground rumbles as the giant rises
  rumbleSfx(t0 + 3, 10, 0.5)
  // 9.5 s: a deep, enormous "MRRROW"
  {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(70, t0 + 9.5)
    o.frequency.linearRampToValueAtTime(110, t0 + 10.3)
    o.frequency.linearRampToValueAtTime(60, t0 + 11.6)
    o.connect(filter('lowpass', 500, 4)).connect(env(t0 + 9.5, 0.55, 2.0, 0.2))
    o.start(t0 + 9.5)
    o.stop(t0 + 11.8)
  }
  // 13 s: a whoosh of water as he shakes off, then clones popping everywhere
  noiseSrc(t0 + 13, 2).connect(filter('bandpass', 900, 0.8)).connect(env(t0 + 13, 0.5, 1.8, 0.3))
  for (let k = 0; k < 40; k++) {
    const t = t0 + 13.4 + k * 0.09 + Math.random() * 0.05
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(500 + Math.random() * 900, t)
    o.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 600, t + 0.06)
    o.connect(env(t, 0.08, 0.08))
    o.start(t)
    o.stop(t + 0.12)
  }
  // 17 s: "ah... ahh..." (two rising breaths), 19.5 s: ACHOO
  for (const [at, len] of [[17.1, 0.9], [18.2, 1.2]]) {
    const f = filter('bandpass', 700, 2)
    f.frequency.setValueAtTime(600, t0 + at)
    f.frequency.linearRampToValueAtTime(1500, t0 + at + len)
    noiseSrc(t0 + at, len + 0.1).connect(f).connect(env(t0 + at, 0.4, len, len * 0.8))
  }
  {
    const t = t0 + 19.5
    noiseSrc(t, 1.6).connect(filter('bandpass', 2400, 0.7)).connect(env(t, 1.0, 1.2, 0.01))
    noiseSrc(t, 2.2).connect(filter('lowpass', 500)).connect(env(t, 0.9, 2.0, 0.01))
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.6)
    o.connect(env(t, 0.8, 0.7, 0.005))
    o.start(t)
    o.stop(t + 0.8)
  }
  // 23-28 s: a ground-shaking purr
  rumbleSfx(t0 + 23, 5, 0.35, 25)
  // 25 s: a sparkly "bless you" chime
  ;[84, 88, 91, 96].forEach((n, i) => {
    const t = t0 + 25 + i * 0.12
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = hz(n)
    o.connect(env(t, 0.18, 1.2))
    o.start(t)
    o.stop(t + 1.3)
  })
}

// low rumble; with `pulse` it throbs (a purr)
function rumbleSfx(t, dur, level, pulse = 0) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(level, t + 0.8)
  g.gain.setValueAtTime(level, t + dur - 0.8)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const src = noiseSrc(t, dur + 0.1)
  const f = filter('lowpass', 140, 1)
  if (pulse) {
    const lfo = ctx.createOscillator()
    const amt = ctx.createGain()
    lfo.frequency.value = pulse
    amt.gain.value = level * 0.9
    lfo.connect(amt).connect(g.gain)
    lfo.start(t)
    lfo.stop(t + dur)
  }
  src.connect(f).connect(g).connect(mix)
}
