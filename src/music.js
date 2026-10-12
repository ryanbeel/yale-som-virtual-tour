// "Ryan Jr. Island Stomp": an original 90-second surf-rock/tiki party tune, synthesized live with the
// Web Audio API (no audio files). 48 bars at 128 BPM:
//   intro 0-3 | verse 4-11 | chorus 12-19 | break 20-23 | VOLCANO 24-31 | big chorus 32-46 | final hit 47
// Bar 24 lands at exactly 45 s: a huge boom as the island's volcano erupts, then double-time chaos.
// Chords go C - Am - F - G. Drums, bass, tremolo-picked surf guitar and a tiki lead melody.

let ctx = null
let mix = null
let master = null
let soloBus = null // distorted lead guitar channel for the shark's solo
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
    // the shark's guitar rig: hard clipping, then a "speaker cabinet" (cut the fizz, push the mids)
    const drive = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(((i / 512) - 1) * 9)
    drive.curve = curve
    drive.oversample = '4x'
    const cab = ctx.createBiquadFilter()
    cab.type = 'lowpass'
    cab.frequency.value = 4200
    const mids = ctx.createBiquadFilter()
    mids.type = 'peaking'
    mids.frequency.value = 1400
    mids.gain.value = 6
    soloBus = ctx.createGain()
    soloBus.gain.value = 0.55
    soloBus.connect(drive).connect(cab).connect(mids).connect(mix)
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

// one note of the shark's solo: distorted, optionally bent up into pitch, with vibrato on long notes
function soloNote(t, midi, dur, bendFrom, vibrato) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.008)
  g.gain.setValueAtTime(0.5, t + dur * 0.85)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08)
  g.connect(soloBus)
  const vib = vibrato ? ctx.createOscillator() : null
  const vibAmt = vibrato ? ctx.createGain() : null
  if (vibrato) {
    vib.frequency.value = 6.5
    vibAmt.gain.setValueAtTime(0, t)
    vibAmt.gain.linearRampToValueAtTime(hz(midi) * 0.03, t + Math.min(0.35, dur * 0.5)) // vibrato blooms in
    vib.connect(vibAmt)
    vib.start(t)
    vib.stop(t + dur + 0.1)
  }
  for (const det of [-7, 7]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.detune.value = det
    if (bendFrom != null) {
      o.frequency.setValueAtTime(hz(bendFrom), t)
      o.frequency.exponentialRampToValueAtTime(hz(midi), t + Math.min(0.18, dur * 0.4)) // string bend
    } else o.frequency.setValueAtTime(hz(midi), t)
    if (vibrato) vibAmt.connect(o.frequency)
    o.connect(g)
    o.start(t)
    o.stop(t + dur + 0.1)
  }
}

// the shark's solo: 8 bars over the final chorus (C Am F G twice), A-minor pentatonic + blues.
// each entry: [step in the bar (16ths), MIDI note, length in 16ths, bend from (or null), vibrato]
const SHARK_SOLO = [
  // lands with a screaming bend, then a fast run up
  [[0, 81, 8, 79, true], [8, 79, 1], [9, 81, 1], [10, 84, 1], [11, 86, 1], [12, 88, 1], [13, 86, 1], [14, 84, 1], [15, 81, 1]],
  // call and answer
  [[0, 84, 4, null, true], [4, 81, 2], [6, 79, 2], [8, 76, 4, 74, true], [12, 79, 2], [14, 81, 2]],
  // finger-tapping arpeggio
  [77, 81, 84, 89, 84, 81, 77, 81, 77, 81, 84, 89, 93, 89, 84, 81].map((n, i) => [i, n, 1]),
  // climbing bends
  [[0, 86, 6, 84, true], [6, 84, 2], [8, 86, 2], [10, 88, 2], [12, 91, 4, null, true]],
  // blazing descending lick
  [96, 93, 91, 88, 93, 91, 88, 86, 91, 88, 86, 84, 88, 86, 84, 81].map((n, i) => [i, n, 1]),
  // bluesy (with the flat 5) into a huge held bend
  [[0, 81, 2], [2, 84, 2], [4, 87, 1], [5, 86, 1], [6, 84, 2], [8, 81, 8, 79, true]],
  // trill, then a run down
  [[0, 89, 1], [1, 91, 1], [2, 89, 1], [3, 91, 1], [4, 89, 1], [5, 91, 1], [6, 89, 1], [7, 91, 1], [8, 93, 1], [9, 91, 1], [10, 89, 1], [11, 88, 1], [12, 86, 1], [13, 84, 1], [14, 81, 1], [15, 79, 1]],
  // the climax: up to a sky-high bent C, held with wide vibrato
  [[0, 91, 4], [4, 93, 4, 91, true], [8, 96, 8, 94, true]],
]
const SOLO_START = 32 // bar where the shark lands (60 s)

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
  const solo = bar >= SOLO_START && bar < SOLO_START + SHARK_SOLO.length
  if (bar === 32 && s === 0) {
    powerChord(t, 52)
    kick(t, 1.3)
  }
  if (bar === SOLO_START + 4 && s === 0) powerChord(t, 52) // halfway through the solo
  if (solo && s === 0) crash(t)
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

  // surf guitar: tremolo-picked chord tones (backs off under the shark's solo)
  if (sec === 'verse' || sec === 'chorus' || sec === 'volcano') guitar(t, ch.triad[(s >> 1) % 3] + (sec === 'verse' ? -12 : 0), sec === 'verse' ? 0.8 : solo ? 0.55 : 1.15)

  // THE SHARK SOLO
  if (solo) {
    for (const [at, n, len, bend, vib] of SHARK_SOLO[bar - SOLO_START]) if (at === s) soloNote(t, n, len * stepDur, bend ?? null, vib)
  }

  // lead hook (an octave down and softer in the second verse); quiet while the shark solos
  if (s % 2 === 0 && !solo) {
    const note = HOOK[bar % 4][s / 2]
    if (note != null) {
      if (sec === 'chorus') lead(t, note + (bar >= 36 ? 12 : 0), stepDur * 1.8)
      else if (sec === 'volcano') lead(t, note + 12, stepDur * 1.5, 0.9)
    }
  }
}

// ---------- DO NOT PRESS: a horror-movie score + sound effects for the giant Ryan Jr. event.
// Everything is scheduled at once from the event's timeline ({ T, SNEEZES, LIGHTNING }).
export function pressSfx({ T, SNEEZES, LIGHTNING }) {
  prime()
  if (!ctx) return
  const t0 = ctx.currentTime + 0.05
  const last = SNEEZES[SNEEZES.length - 1]

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
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.05)
    g.gain.setValueAtTime(0.1, t0 + 3.8)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.1)
    o.connect(filter('lowpass', 2500)).connect(g).connect(mix)
    o.start(t0)
    o.stop(t0 + 4.2)
  }

  // the score: a dark drone (D minor) that swells under everything, cut to silence right before
  // the mega-sneeze
  drone(t0 + 2.5, last.at - 0.45 - 2.5, [26, 38, 45, 50])
  drone(last.at + 0.2 + t0, T.BLESS - last.at - 1.5, [26, 38, 45], 0.6)
  // a heartbeat that speeds up as he rises, and again as he wades closer
  heartbeat(t0 + 3, t0 + SNEEZES[0].at - 0.3, 1.05, 0.55)
  heartbeat(t0 + T.CLOSER, t0 + last.at - 0.45, 0.8, 0.22)
  // movie-trailer BRAAAMs when he appears and when he starts coming closer
  braam(t0 + T.RISE, 3.5)
  braam(t0 + T.CLOSER, 3.5)
  // screeching horror strings before each sneeze (the last one is long and climbs)
  for (const sn of SNEEZES) strings(t0 + sn.at - sn.build - 1.5, sn.build + 1.4, sn === last ? 12 : 5)

  // 3-13 s: the sea boils and the ground rumbles as the giant rises
  rumbleSfx(t0 + 3, 10, 0.4)
  // 9.5 s: a deep, enormous "MRRROW"
  growl(t0 + 9.5)
  growl(t0 + T.CLOSER + 1, 0.8)
  // 13 s: a whoosh of water as he shakes off, then clones popping everywhere
  noiseSrc(t0 + 13, 2).connect(filter('bandpass', 900, 0.8)).connect(env(t0 + 13, 0.5, 1.8, 0.3))
  for (let k = 0; k < 40; k++) {
    const t = t0 + 13.4 + k * 0.09 + Math.random() * 0.05
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(500 + Math.random() * 900, t)
    o.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 600, t + 0.06)
    o.connect(env(t, 0.07, 0.08))
    o.start(t)
    o.stop(t + 0.12)
  }
  // thunder for every lightning strike
  for (const at of LIGHTNING) thunder(t0 + at)
  // the three sneezes: "ah... ahh..." breaths, then ACHOO (each bigger), then a crashing wave
  for (const sn of SNEEZES) {
    const breaths = sn === last ? [[sn.at - 3.4, 0.9], [sn.at - 2.3, 1.0], [sn.at - 1.2, 1.15]] : [[sn.at - 2.4, 0.9], [sn.at - 1.3, 1.2]]
    for (const [at, len] of breaths) {
      const f = filter('bandpass', 700, 2)
      f.frequency.setValueAtTime(600, t0 + at)
      f.frequency.linearRampToValueAtTime(1500 + sn.power * 300, t0 + at + len)
      noiseSrc(t0 + at, len + 0.1).connect(f).connect(env(t0 + at, 0.3 + sn.power * 0.1, len, len * 0.8))
    }
    sneezeSfx(t0 + sn.at, sn.power)
    noiseSrc(t0 + sn.at + 2.6, 2.5).connect(filter('lowpass', 1200)).connect(env(t0 + sn.at + 2.6, 0.35 * sn.power, 2.2, 0.4))
    if (sn === last) boom(t0 + sn.at + 0.15) // ...and the volcano goes off
  }
  // after: a ground-shaking purr, a warm major pad and a sparkly "bless you" chime
  rumbleSfx(t0 + last.at + 2.5, T.SINK - last.at, 0.3, 25)
  pad(t0 + T.BLESS - 1.5, 6, [62, 66, 69, 74])
  ;[84, 88, 91, 96].forEach((n, i) => {
    const t = t0 + T.BLESS + i * 0.12
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = hz(n)
    o.connect(env(t, 0.18, 1.2))
    o.start(t)
    o.stop(t + 1.3)
  })
}

function drone(t, dur, notes, level = 1) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.16 * level, t + 3)
  g.gain.setValueAtTime(0.16 * level, t + dur - 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const f = filter('lowpass', 300, 6)
  const lfo = ctx.createOscillator()
  const amt = ctx.createGain()
  lfo.frequency.value = 0.15
  amt.gain.value = 220
  lfo.connect(amt).connect(f.frequency)
  lfo.start(t)
  lfo.stop(t + dur)
  f.connect(g).connect(mix)
  for (const n of notes) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(n)
      o.detune.value = det
      o.connect(f)
      o.start(t)
      o.stop(t + dur)
    }
  }
}

function heartbeat(from, to, startGap, endGap) {
  let t = from
  while (t < to) {
    const k = (t - from) / Math.max(0.001, to - from)
    for (const [dt, v] of [[0, 1], [0.16, 0.7]]) {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(70, t + dt)
      o.frequency.exponentialRampToValueAtTime(35, t + dt + 0.12)
      o.connect(env(t + dt, 0.5 * v * (0.6 + k * 0.6), 0.2))
      o.start(t + dt)
      o.stop(t + dt + 0.25)
    }
    t += startGap + (endGap - startGap) * k
  }
}

function braam(t, dur) {
  const f = filter('lowpass', 200, 3)
  f.frequency.setValueAtTime(200, t)
  f.frequency.exponentialRampToValueAtTime(1600, t + 0.6)
  f.frequency.exponentialRampToValueAtTime(300, t + dur)
  f.connect(env(t, 0.45, dur, 0.05))
  for (const n of [26, 38, 45, 50, 53]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(n)
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.1)
  }
}

function strings(t, dur, climb) {
  for (const n of [74, 75, 81]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(hz(n), t)
    o.frequency.exponentialRampToValueAtTime(hz(n + climb), t + dur)
    const trem = ctx.createGain()
    const lfo = ctx.createOscillator()
    const amt = ctx.createGain()
    lfo.frequency.value = 11
    amt.gain.value = 0.5
    trem.gain.value = 0.5
    lfo.connect(amt).connect(trem.gain)
    o.connect(filter('bandpass', 2500, 0.6)).connect(trem).connect(env(t, 0.06, dur, dur * 0.85))
    for (const x of [o, lfo]) {
      x.start(t)
      x.stop(t + dur + 0.1)
    }
  }
}

function growl(t, level = 1) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(70, t)
  o.frequency.linearRampToValueAtTime(110, t + 0.8)
  o.frequency.linearRampToValueAtTime(60, t + 2.1)
  o.connect(filter('lowpass', 500, 4)).connect(env(t, 0.55 * level, 2.0, 0.2))
  o.start(t)
  o.stop(t + 2.3)
}

function thunder(t) {
  noiseSrc(t, 0.3).connect(filter('highpass', 1500)).connect(env(t, 0.5, 0.25, 0.002))
  noiseSrc(t + 0.05, 3).connect(filter('lowpass', 300)).connect(env(t + 0.05, 0.7, 2.6, 0.08))
}

function sneezeSfx(t, power) {
  noiseSrc(t, 1.6).connect(filter('bandpass', 2400, 0.7)).connect(env(t, 0.6 + power * 0.25, 1.0 + power * 0.3, 0.01))
  noiseSrc(t, 2.2).connect(filter('lowpass', 500)).connect(env(t, 0.6 + power * 0.2, 1.6 + power * 0.4, 0.01))
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(220, t)
  o.frequency.exponentialRampToValueAtTime(40, t + 0.6)
  o.connect(env(t, 0.8, 0.7, 0.005))
  o.start(t)
  o.stop(t + 0.8)
}

function pad(t, dur, notes) {
  for (const n of notes) {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = hz(n)
    o.connect(env(t, 0.07, dur, 1.2))
    o.start(t)
    o.stop(t + dur + 1.3)
  }
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

// ---------- THE GREAT TIKI-DINO WAR: an epic battle score (~72 s), scheduled on the fly like the song.
// Steps are 16th notes at 150 BPM (0.1 s). One-shot effects (cannons, stingers) ride along by time.
let warTimer = null
export function stopWarMusic() {
  if (warTimer) clearInterval(warTimer)
  warTimer = null
}

export function warMusic({ W, CANNON_SHOTS, FLIGHT }) {
  prime()
  if (!ctx) return
  stopWarMusic()
  const t0 = ctx.currentTime + 0.05
  const STEP = 0.1
  const total = Math.ceil(W.END / STEP)
  // one-shots, by time
  const shots = [
    [W.ROCK, () => blipAt(t0 + W.ROCK, 1047)],
    [W.PAPER, () => blipAt(t0 + W.PAPER, 1319)],
    [W.SCISSORS, () => blipAt(t0 + W.SCISSORS, 1568)],
    [W.SHOOT, (t) => chordHit(t, [72, 76, 79, 84], 0.4)],
    [W.TIKI_LATE, (t) => noiseSrc(t, 0.2).connect(filter('bandpass', 1800, 1)).connect(env(t, 0.6, 0.15))], // slap!
    [W.TIKI_LATE + 0.7, (t) => scratch(t)],
    [W.CHEAT, (t) => dunDunDun(t)],
    [W.FLIP, (t) => { crash(t); noiseSrc(t, 0.8).connect(filter('bandpass', 600, 0.7)).connect(env(t, 0.5, 0.7, 0.1)) }],
    [W.MARCH + 0.5, (t) => horn(t, 50, 57, 2.2)],
    [W.MARCH + 4.5, (t) => horn(t, 50, 57, 2.2)],
    [W.CHARGE, (t) => { crash(t); braamWar(t, 38); roarCrowd(t, 3) }],
    [W.CLASH, (t) => { crash(t); kick(t, 1.4); noiseSrc(t, 1).connect(filter('lowpass', 900)).connect(env(t, 0.7, 0.9, 0.01)) }],
    [W.REINFORCE, (t) => { crash(t); braamWar(t, 40); growlWar(t) }],
    [W.MEGA, (t) => megaBoom(t)],
    ...[0, 0.25, 0.5, 0.8].map((d) => [W.HEAP + 0.2 + d, (t) => kick(t, 0.9)]), // everyone lands: thud thud thud
    [W.HEAP + 1.5, (t) => trombone(t)],
    [W.END - 2.5, (t) => [72, 76, 79, 84].forEach((n, i) => marimba(t + i * 0.13, n, 0.35))],
    ...CANNON_SHOTS.flatMap((s) => [
      [s.at, (t) => cannonBoom(t)],
      [s.at + FLIGHT, (t) => explosion(t)],
    ]),
  ].sort((a, b) => a[0] - b[0])
  let i = 0
  let step = 0
  warTimer = setInterval(() => {
    const horizon = ctx.currentTime + 0.25
    while (i < shots.length && t0 + shots[i][0] < horizon) {
      shots[i][1](t0 + shots[i][0])
      i++
    }
    while (step < total && t0 + step * STEP < horizon) {
      warStep(step, t0 + step * STEP, W)
      step++
    }
    if (step >= total && i >= shots.length) stopWarMusic()
  }, 25)
}

const WAR_CHORDS = [
  { root: 38, triad: [62, 65, 69] }, // Dm
  { root: 34, triad: [58, 62, 65] }, // Bb
  { root: 36, triad: [60, 64, 67] }, // C
  { root: 33, triad: [57, 61, 64] }, // A
]
// heroic brass theme: [MIDI, length in 16ths], 4 bars
const WAR_THEME = [
  [62, 4], [65, 2], [69, 2], [74, 6], [72, 2],
  [70, 4], [69, 4], [67, 8],
  [69, 4], [72, 2], [74, 2], [77, 6], [76, 2],
  [74, 4], [72, 4], [73, 8],
]
const THEME_AT = (() => {
  let at = 0
  return WAR_THEME.map(([n, len]) => {
    const e = [at, n, len]
    at += len
    return e
  })
})()

function warStep(i, t, W) {
  const sec = i * 0.1
  // game night: a bouncy marimba tune until SHOOT, then a ticking clock while the tiki "thinks"
  if (sec < W.SHOOT) {
    const tune = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 79, 76, 74, 71]
    if (i % 2 === 0) marimba(t, tune[(i / 2) % tune.length], 0.18)
    return
  }
  if (sec < W.MARCH) {
    if (sec < W.TIKI_LATE && i % 3 === 0) noiseSrc(t, 0.03).connect(filter('highpass', 4000)).connect(env(t, 0.25, 0.02)) // tick
    return
  }
  // the march: taiko war drums building, a choir swelling in
  if (sec < W.CHARGE) {
    const s = i % 16
    if (s === 0 || s === 8) taiko(t, 1)
    if (s === 6 || s === 14) taiko(t, 0.6)
    if (sec > W.MARCH + 4 && (s === 3 || s === 11)) taiko(t, 0.5)
    if (s === 0 && Math.floor(i / 16) % 2 === 0 && sec > W.MARCH + 2) choir(t, [50, 57, 62, 65], 3.2, 0.7)
    return
  }
  // silence before the mega-explosion, then slow-motion choir while everyone flies
  if (sec >= W.MEGA - 0.35 && sec < W.MEGA) return
  if (sec >= W.MEGA) {
    if (sec < W.HEAP && i % 40 === 0) choir(t, [74, 77, 81], 4, 1)
    return
  }
  // THE BATTLE
  const k = i - Math.round(W.CHARGE / 0.1) // steps since the charge
  const bar = Math.floor(k / 16)
  const s = k % 16
  const up = sec >= W.REINFORCE ? 2 : 0 // reinforcements: key change up a whole step
  const ch = WAR_CHORDS[bar % 4]
  // drums
  if (s === 0 || s === 6 || s === 8 || s === 11 || (up && s % 2 === 0)) taiko(t, s === 0 ? 1.2 : 0.8)
  if (s === 4 || s === 12) {
    snare(t, 1)
    clap(t)
  }
  hat(t, s % 4 === 2, 0.7)
  if (s === 0 && bar % 4 === 0) crash(t)
  if (bar % 2 === 1 && s >= 12) tom(t, 50 - (s - 12) * 3 + up)
  // racing string ostinato
  const pat = [0, 0, 2, 1]
  stringNote(t, ch.triad[pat[s % 4]] - 12 + up, 0.08)
  // bass
  if (s % 2 === 0) bass(t, ch.root + 12 + up + (s % 4 === 2 ? 12 : 0), 0.18)
  // choir chord per bar
  if (s === 0) choir(t, ch.triad.map((n) => n - 12 + up), 1.6, up ? 1 : 0.8)
  // the brass theme (from the clash on), louder after the reinforcements
  if (sec >= W.CLASH) {
    const pos = (k - Math.round((W.CLASH - W.CHARGE) / 0.1) + 6400) % 64
    for (const [at, n, len] of THEME_AT) if (at === pos) brass(t, n + up, len * 0.1, up ? 1.2 : 1)
  }
}

function blipAt(t, f) {
  const o = ctx.createOscillator()
  o.type = 'square'
  o.frequency.value = f
  o.connect(env(t, 0.15, 0.25))
  o.start(t)
  o.stop(t + 0.3)
}
function marimba(t, n, level) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = hz(n)
  const o2 = ctx.createOscillator()
  o2.type = 'sine'
  o2.frequency.value = hz(n) * 4
  const g2 = ctx.createGain()
  g2.gain.value = 0.25
  const g = env(t, level, 0.35, 0.002)
  o.connect(g)
  o2.connect(g2).connect(g)
  for (const x of [o, o2]) {
    x.start(t)
    x.stop(t + 0.4)
  }
}
function scratch(t) {
  const f = filter('bandpass', 3000, 2)
  f.frequency.setValueAtTime(3000, t)
  f.frequency.exponentialRampToValueAtTime(150, t + 0.45)
  noiseSrc(t, 0.5).connect(f).connect(env(t, 0.6, 0.45, 0.01))
}
function dunDunDun(t) {
  ;[[50, 0, 0.35], [49, 0.45, 0.35], [43, 0.9, 1.6]].forEach(([n, d, len]) => brass(t + d, n, len, 1.4))
}
function brass(t, n, dur, level = 1) {
  const f = filter('lowpass', 400, 2)
  f.frequency.setValueAtTime(400, t)
  f.frequency.linearRampToValueAtTime(2400, t + 0.08)
  f.frequency.linearRampToValueAtTime(1300, t + dur)
  f.connect(env(t, 0.11 * level, dur, 0.04))
  for (const det of [-8, 0, 8]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(n)
    o.detune.value = det
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.1)
  }
}
function horn(t, from, to, dur) {
  const f = filter('lowpass', 1200, 2)
  f.connect(env(t, 0.22, dur, 0.25))
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.detune.value = det
    o.frequency.setValueAtTime(hz(from), t)
    o.frequency.setValueAtTime(hz(from), t + dur * 0.4)
    o.frequency.exponentialRampToValueAtTime(hz(to), t + dur * 0.55)
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.1)
  }
}
function taiko(t, v) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.25)
  o.connect(env(t, 0.75 * v, 0.45, 0.002))
  o.start(t)
  o.stop(t + 0.5)
  noiseSrc(t, 0.08).connect(filter('lowpass', 1200)).connect(env(t, 0.25 * v, 0.06))
}
function choir(t, notes, dur, level) {
  const f1 = filter('bandpass', 750, 4)
  const f2 = filter('bandpass', 1150, 5)
  const g = env(t, 0.07 * level, dur, Math.min(0.8, dur * 0.4))
  f1.connect(g)
  f2.connect(g)
  for (const n of notes) {
    for (const det of [-10, 10]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(n)
      o.detune.value = det
      o.connect(f1)
      o.connect(f2)
      o.start(t)
      o.stop(t + dur + 0.1)
    }
  }
}
function stringNote(t, n, dur) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = hz(n)
  o.connect(filter('lowpass', 2200, 1)).connect(env(t, 0.07, dur, 0.004))
  o.start(t)
  o.stop(t + dur + 0.05)
}
function braamWar(t, root) {
  const f = filter('lowpass', 200, 3)
  f.frequency.setValueAtTime(200, t)
  f.frequency.exponentialRampToValueAtTime(1800, t + 0.5)
  f.frequency.exponentialRampToValueAtTime(300, t + 3)
  f.connect(env(t, 0.4, 3, 0.04))
  for (const n of [root, root + 7, root + 12, root + 15, root + 19]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(n)
    o.connect(f)
    o.start(t)
    o.stop(t + 3.1)
  }
}
function roarCrowd(t, dur) {
  noiseSrc(t, dur).connect(filter('bandpass', 900, 0.6)).connect(env(t, 0.35, dur, 0.4))
}
function growlWar(t) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(90, t)
  o.frequency.linearRampToValueAtTime(140, t + 0.6)
  o.frequency.linearRampToValueAtTime(70, t + 1.8)
  o.connect(filter('lowpass', 700, 5)).connect(env(t, 0.6, 1.8, 0.1))
  o.start(t)
  o.stop(t + 2)
}
function cannonBoom(t) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(35, t + 0.3)
  o.connect(env(t, 0.5, 0.4, 0.002))
  o.start(t)
  o.stop(t + 0.45)
  noiseSrc(t, 0.4).connect(filter('lowpass', 1500)).connect(env(t, 0.35, 0.3, 0.002))
}
function explosion(t) {
  noiseSrc(t, 0.9).connect(filter('lowpass', 2500)).connect(env(t, 0.45, 0.8, 0.003))
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(80, t)
  o.frequency.exponentialRampToValueAtTime(30, t + 0.4)
  o.connect(env(t, 0.45, 0.45, 0.003))
  o.start(t)
  o.stop(t + 0.5)
}
function megaBoom(t) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(20, t + 2.5)
  o.connect(env(t, 1, 2.6, 0.005))
  o.start(t)
  o.stop(t + 2.8)
  noiseSrc(t, 3).connect(filter('lowpass', 1200)).connect(env(t, 1, 2.8, 0.005))
  noiseSrc(t, 1).connect(filter('highpass', 2500)).connect(env(t, 0.4, 0.8, 0.002))
  crash(t)
}
function trombone(t) {
  ;[[58, 0, 0.4], [57, 0.45, 0.4], [56, 0.9, 0.4], [55, 1.35, 1.4]].forEach(([n, d, len], k) => {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(hz(n), t + d)
    if (k === 3) {
      const vib = ctx.createOscillator()
      const amt = ctx.createGain()
      vib.frequency.value = 5
      amt.gain.value = hz(n) * 0.025
      vib.connect(amt).connect(o.frequency)
      vib.start(t + d)
      vib.stop(t + d + len)
    }
    o.connect(filter('lowpass', 900, 3)).connect(env(t + d, 0.2, len, 0.05))
    o.start(t + d)
    o.stop(t + d + len + 0.05)
  })
}

// ---------- THE FINALE (~95 s): one score in four acts, scheduled on the fly from a list of timed
// events. Act 1 the awakening (drone, heartbeat, thunder, braams), act 2 the king (timpani roll, royal
// fanfare, a regal march), act 3 the ultimate concert (128 BPM rock: band, a guitar duel between Rose
// and the shark, DJ build-up and a huge drop), act 4 chaos (battle drums), countdown, rocket launch,
// floaty space music, a slide whistle down under the parachute, the splash and a music-box ending.
let finaleTimer = null
export function stopFinaleMusic() {
  if (finaleTimer) clearInterval(finaleTimer)
  finaleTimer = null
}

// the secret button's "are you sure?" stingers
export function askSfx(level) {
  prime()
  if (!ctx) return
  const t = ctx.currentTime + 0.02
  if (level === 1) {
    brass(t, 38, 1.4, 1.4)
    taiko(t, 1)
  } else {
    brass(t, 37, 0.5, 1.5)
    brass(t + 0.55, 36, 2.2, 1.6)
    taiko(t, 1.2)
    taiko(t + 0.55, 1.4)
    heartbeat(t + 1, t + 6, 0.9, 0.9)
  }
}

export function finaleMusic(F, { lightning, shots, flight }) {
  prime()
  if (!ctx) return
  stopFinaleMusic()
  const t0 = ctx.currentTime + 0.05
  const ev = []
  const at = (s, fn) => ev.push([s, fn])

  // ===== ACT 1: THE AWAKENING (0-11)
  at(0, (t) => {
    megaBoom(t)
    braamWar(t, 26)
    drone(t + 0.4, 10.8, [26, 33, 38], 1.3)
    rumbleSfx(t, 11, 0.5)
    heartbeat(t + 1, t + 11, 0.95, 0.32)
  })
  at(3, (t) => strings(t, 8, 12))
  at(5.5, (t) => braamWar(t, 29))
  at(8, (t) => braamWar(t, 31))
  at(9.5, (t) => {
    riser(t, 1.5)
    choir(t, [62, 66, 69, 74], 3.5, 1.4) // a golden beam: the choir turns major
  })
  for (const s of lightning) at(s, (t) => thunder(t))
  // ===== ACT 2: THE KING (11-31)
  at(11, (t) => {
    choir(t, [50, 57, 62, 66], 5.2, 1.2)
    pad(t, 5, [50, 57, 62, 66, 69])
    for (let k = 0; k < 40; k++) {
      const d = 5 * (1 - (1 - k / 40) ** 1.6) // a timpani roll that speeds up
      taiko(t + d, 0.35 + (k / 40) * 0.8)
    }
  })
  // the royal fanfare: da-da-da DAAA, da-da-DAAAAA
  at(F.CROWN, (t) => {
    crash(t)
    taiko(t, 1.4)
    ;[[0, 62, 0.15], [0.17, 62, 0.15], [0.34, 62, 0.15], [0.5, 69, 0.95], [1.5, 66, 0.15], [1.67, 69, 0.15], [1.84, 74, 1.6]].forEach(([d, n, len]) => {
      brass(t + d, n, len, 1.6)
      brass(t + d, n + 12, len, 0.7)
    })
    choir(t + 1.84, [62, 66, 69, 74], 2, 1.3)
    taiko(t + 1.84, 1.4)
    crash(t + 1.84)
  })
  // the royal march: 120 BPM in D major, 6.5 bars (18-31)
  const MB = 0.5 // one beat
  const MARCH_CHORDS = [[50, [62, 66, 69]], [43, [59, 62, 67]], [45, [61, 64, 69]], [50, [62, 66, 69]], [47, [59, 62, 66]], [43, [59, 62, 67]], [45, [61, 64, 69]]]
  const MARCH_TUNE = [
    [[62, 1], [66, 0.5], [69, 0.5], [74, 1.5], [73, 0.5]],
    [[71, 1], [74, 1], [71, 1], [67, 1]],
    [[69, 1], [73, 0.5], [76, 0.5], [76, 1], [73, 1]],
    [[74, 3], [69, 1]],
    [[71, 1], [74, 0.5], [78, 0.5], [78, 1.5], [76, 0.5]],
    [[74, 1], [71, 1], [67, 1], [71, 1]],
    [[69, 2]],
  ]
  MARCH_CHORDS.forEach(([root, triad], bar) => {
    const b0 = F.PARADE + bar * 4 * MB
    const beats = bar === 6 ? 2 : 4
    for (let k = 0; k < beats; k++) {
      const s = b0 + k * MB
      at(s, (t) => {
        if (k % 2 === 0) kick(t, 0.9)
        else snare(t, 0.7)
        hat(t, false, 0.5)
        bass(t, root - 12 + (k % 2 ? 7 : 0), 0.4)
        marimba(t + MB / 2, triad[(k + 1) % 3] + 12, 0.08)
      })
      if (k === 3) for (let r = 0; r < 3; r++) at(s + MB / 2 + (r * MB) / 6, (t) => snare(t, 0.45)) // rat-a-tat
    }
    at(b0, (t) => choir(t, triad.map((n) => n - 12), beats * MB, 0.7))
    let d = 0
    for (const [n, len] of MARCH_TUNE[bar]) {
      const dd = d
      at(b0 + dd * MB, (t) => {
        brass(t, n, len * MB * 0.95, 1.1)
        marimba(t, n + 12, 0.12)
      })
      d += len
    }
  })
  at(29.6, (t) => riser(t, 1.4))
  for (let k = 0; k < 12; k++) at(30 + k / 12, (t) => snare(t, 0.4 + k * 0.06))

  // ===== ACT 3: THE ULTIMATE CONCERT (31-57.25): 14 bars at 128 BPM in D major (D A Bm G)
  const B = 60 / 128
  const S = B / 4
  const ROCK = [[50, [62, 66, 69]], [45, [61, 64, 69]], [47, [62, 66, 71]], [43, [62, 67, 71]]]
  const HOOK2 = [
    [74, 74, 76, 78, 76, 74, 71, 69],
    [73, 73, 74, 76, 73, null, 69, null],
    [74, 74, 76, 78, 81, 78, 76, 74],
    [71, null, 71, 74, 73, 71, 69, null],
  ]
  const ROSE_LICKS = {
    4: [74, 76, 78, 81, 78, 76, 74, 71, 74, 76, 78, 81, 83, 81, 78, 76],
    6: [81, 83, 86, 83, 81, 78, 81, 83, 86, 88, 90, 88, 86, 83, 86, 90],
  }
  const SHARK_LICKS = {
    5: [[0, 86, 6, 84, true], [6, 83, 1], [7, 81, 1], [8, 78, 1], [9, 81, 1], [10, 83, 1], [11, 86, 1], [12, 88, 4, 86, true]],
    7: [93, 90, 88, 86, 90, 88, 86, 83, 88, 86, 83, 81, 86, 83, 81, 78].map((n, i) => [i, n, 1]),
  }
  for (let bar = 0; bar < 14; bar++) {
    const b0 = F.SHOW + bar * 16 * S
    const [root, triad] = ROCK[bar % 4]
    const drop = bar >= 10
    const build = bar === 8 || bar === 9
    for (let s = 0; s < 16; s++) {
      const st = b0 + s * S
      at(st, (t) => {
        if (build) {
          // the build: snare gets faster and louder, no bass
          const every = bar === 8 ? 4 : s < 8 ? 2 : 1
          if (s % every === 0) snare(t, 0.4 + (bar - 8) * 0.3 + s * 0.02)
          if (s % 4 === 0) kick(t, 0.8)
          return
        }
        if (s % 4 === 0) kick(t, drop ? 1.25 : 1)
        if (s === 4 || s === 12) {
          snare(t, 1)
          if (drop) clap(t)
        }
        if (s % 2 === 0) hat(t, drop && s % 4 === 2, 0.7)
        if (s % 2 === 0) bass(t, root - 12 + (s % 4 === 2 ? 12 : 0), S * 1.8)
        if (!drop) guitar(t, root, 0.9) // chugging power-chord root
        if (!drop) guitar(t, root + 7, 0.6)
        if (drop && s % 4 === 2) chordHit(t, triad.map((n) => n + 12), S * 1.5) // supersaw offbeat stabs
      })
    }
    if (bar === 0 || drop) at(b0, (t) => powerChord(t, root - 12))
    if (bar % 4 === 0 || drop) at(b0, (t) => crash(t))
    // the hook (intro + drop), on the lead in the intro and the brass in the drop
    if (bar < 4 || drop) {
      HOOK2[bar % 4].forEach((n, k) => {
        if (n == null) return
        at(b0 + k * 2 * S, (t) => (drop ? brass(t, n, 2 * S * 0.95, 1.3) : lead(t, n, 2 * S * 0.9, 1.1)))
      })
    }
    if (drop) at(b0, (t) => wobble(t, root - 24, 16 * S))
    // the guitar duel: Rose (bright lead) and the shark (distorted) trade bars
    if (ROSE_LICKS[bar]) ROSE_LICKS[bar].forEach((n, k) => at(b0 + k * S, (t) => lead(t, n, S * 0.95, 1.3)))
    if (SHARK_LICKS[bar]) SHARK_LICKS[bar].forEach(([k, n, len, bend, vib]) => at(b0 + k * S, (t) => soloNote(t, n, len * S, bend, vib)))
  }
  at(F.BUILD, (t) => riser(t, F.DROP - F.BUILD - 0.25))
  // DJ Zaman: 3... 2... 1...
  ;[3, 2, 1].forEach((n, k) => at(F.DROP - (3 - k) * B, (t) => blipAt(t, n === 1 ? 1760 : 880)))
  at(F.DROP, (t) => {
    megaBoom(t)
    roarCrowd(t, 3)
  })

  // ===== ACT 4: TOTAL ISLAND CHAOS (57.25-68.5)
  const STEP = 0.1
  for (let s = F.CHAOS; s < F.COUNT; s += STEP) {
    const i = Math.round((s - F.CHAOS) / STEP)
    const k = i % 16
    const bar = Math.floor(i / 16)
    const ch = [[38, [62, 65, 69]], [34, [58, 62, 65]], [36, [60, 64, 67]], [33, [57, 61, 64]]][bar % 4]
    at(s, (t) => {
      if (k === 0 || k === 6 || k === 8 || k === 11 || k % 4 === 2) taiko(t, k === 0 ? 1.3 : 0.8)
      if (k === 4 || k === 12) {
        snare(t, 1)
        clap(t)
      }
      hat(t, k % 4 === 2, 0.6)
      stringNote(t, ch[1][[0, 0, 2, 1][k % 4]] - 12, 0.08)
      if (k % 2 === 0) bass(t, ch[0] + 12, 0.18)
      if (k === 0) choir(t, ch[1].map((n) => n - 12), 1.6, 1)
      if (k === 0 && bar % 4 === 0) crash(t)
    })
  }
  ;[F.CHAOS, F.CHAOS + 3.2].forEach((s) => at(s, (t) => braamWar(t, 38)))
  at(F.CHAOS + 0.3, (t) => growl(t, 1.4)) // the giant rises
  at(F.CHAOS + 1.2, (t) => wind(t, 9)) // the sharknado
  at(F.SNEEZE, (t) => {
    sneezeSfx(t, 2.4)
    crash(t)
  })
  at(F.WAVE, (t) => noiseSrc(t, 4).connect(filter('lowpass', 700)).connect(env(t, 0.7, 3.6, 0.6))) // the tsunami roars past
  at(F.TOSPACE, (t) => {
    braamWar(t, 38)
    choir(t, [62, 66, 69, 74], 1, 1.4)
  })
  for (const sh of shots) {
    at(sh.at, (t) => cannonBoom(t))
    at(sh.at + flight, (t) => explosion(t))
  }
  for (let k = 0; k < 16; k++) at(F.CHAOS + 0.5 + k * 0.47, (t) => meow(t, 600 + ((k * 137) % 300)))
  // 3... 2... 1...
  ;[0, 1, 2].forEach((k) => at(F.COUNT + k, (t) => {
    blipAt(t, k === 2 ? 1760 : 880)
    taiko(t, 1.2)
  }))
  for (let k = 0; k < 6; k++) at(F.COUNT + 1.5 + k * 0.25, (t) => heartbeat(t, t + 0.2, 1, 1))

  // ===== LIFTOFF (68.5) -> SPACE (74.5-82)
  at(F.LIFTOFF, (t) => {
    megaBoom(t)
    rocket(t, F.SPACE - F.LIFTOFF + 0.5)
    rumbleSfx(t, 6, 0.9)
  })
  // a sunrise-in-space fanfare: D ... A ... D!
  ;[[1.5, 50, 1.4], [3, 57, 1.4], [4.5, 62, 1.6]].forEach(([d, n, len]) => at(F.LIFTOFF + d, (t) => {
    brass(t, n, len, 1.8)
    brass(t, n + 12, len, 0.9)
  }))
  at(F.LIFTOFF + 4.5 + 0.8, (t) => choir(t, [62, 66, 69, 74], 1.2, 1.2))
  ;[0, 0.25, 0.5, 0.75].forEach((d) => at(F.SPACE - 0.4 + d * 0.5, (t) => taiko(t, 1.3)))
  at(F.SPACE, (t) => {
    crash(t)
    pad(t, 7.5, [62, 66, 69, 73, 76])
    choir(t, [74, 78, 81], 7, 0.6)
  })
  // a music box in zero gravity (the concert hook, slow and twinkly)
  const BOX = [86, 86, 88, 90, 88, 86, 83, 81, 85, 85, 86, 88, 85, 81]
  BOX.forEach((n, k) => at(F.SPACE + 0.5 + k * 0.5, (t) => {
    marimba(t, n, 0.13)
    marimba(t + 0.25, n + 12, 0.04) // echo
  }))

  // ===== THE PARACHUTE (82) and SPLASH (88)
  at(F.CHUTE, (t) => {
    noiseSrc(t, 0.6).connect(filter('lowpass', 500)).connect(env(t, 0.9, 0.5, 0.01)) // FWOOMP
    slideWhistle(t + 0.3, 2.6, 1600, 500)
    slideWhistle(t + 3.1, 2.7, 1300, 300)
  })
  for (let k = 0; k < 10; k++) at(F.CHUTE + 0.3 + k * 0.56, (t) => bass(t, [38, 45, 38, 45, 36, 43, 36, 43, 33, 40][k], 0.45)) // oom-pah
  at(F.SPLASH, (t) => {
    noiseSrc(t, 1.8).connect(filter('highpass', 600)).connect(env(t, 0.8, 1.6, 0.005)) // SPLASH
    kick(t, 1.5)
    crash(t)
    powerChord(t, 38)
    brass(t, 62, 2.6, 1.6)
    brass(t, 66, 2.6, 1.3)
    brass(t, 69, 2.6, 1.3)
    choir(t, [62, 66, 69, 74], 2.6, 1.4)
  })
  // ===== THE END: a music box plays the fanfare, and the tiny button goes "ding"
  ;[[0, 74], [0.18, 74], [0.36, 74], [0.6, 81], [1.5, 78], [1.68, 81], [1.86, 86]].forEach(([d, n]) => at(F.TINY - 1.6 + d, (t) => marimba(t, n, 0.14)))
  at(F.TINY + 0.6, (t) => blipAt(t, 2093))
  at(F.END - 2.2, (t) => [74, 78, 81, 86].forEach((n, i) => marimba(t + i * 0.16, n, 0.12)))

  ev.sort((a, b) => a[0] - b[0])
  let i = 0
  finaleTimer = setInterval(() => {
    const horizon = ctx.currentTime + 0.25
    while (i < ev.length && t0 + ev[i][0] < horizon) {
      ev[i][1](t0 + ev[i][0])
      i++
    }
    if (i >= ev.length) stopFinaleMusic()
  }, 25)
}

// a dubstep-ish wobble bass for the drop
function wobble(t, midi, dur) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = hz(midi)
  const o2 = ctx.createOscillator()
  o2.type = 'square'
  o2.frequency.value = hz(midi) * 0.5
  const f = filter('lowpass', 300, 8)
  const lfo = ctx.createOscillator()
  const amt = ctx.createGain()
  lfo.type = 'triangle'
  lfo.frequency.value = (128 / 60) * 2 // eighth-note wobble
  amt.gain.value = 900
  lfo.connect(amt).connect(f.frequency)
  const g = env(t, 0.4, dur, 0.01)
  o.connect(f)
  o2.connect(f)
  f.connect(g)
  for (const x of [o, o2, lfo]) {
    x.start(t)
    x.stop(t + dur + 0.05)
  }
}
// howling wind (the sharknado)
function wind(t, dur) {
  const f = filter('bandpass', 500, 2)
  const lfo = ctx.createOscillator()
  const amt = ctx.createGain()
  lfo.frequency.value = 0.4
  amt.gain.value = 350
  lfo.connect(amt).connect(f.frequency)
  lfo.start(t)
  lfo.stop(t + dur)
  noiseSrc(t, dur).connect(f).connect(env(t, 0.35, dur, 1.5))
}
// a tiny cartoon meow (clones flying out of the machine)
function meow(t, f0) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(f0, t)
  o.frequency.linearRampToValueAtTime(f0 * 1.5, t + 0.08)
  o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.3)
  o.connect(filter('lowpass', 2500)).connect(env(t, 0.12, 0.3, 0.02))
  o.start(t)
  o.stop(t + 0.35)
}
// rocket engines: a roaring noise that brightens as it climbs
function rocket(t, dur) {
  const f = filter('lowpass', 200, 1)
  f.frequency.setValueAtTime(200, t)
  f.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.6)
  f.frequency.exponentialRampToValueAtTime(400, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.4)
  g.gain.setValueAtTime(0.9, t + dur * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  g.connect(mix)
  noiseSrc(t, dur + 0.1).connect(f).connect(g)
}
// a cartoon slide whistle
function slideWhistle(t, dur, from, to) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur)
  const vib = ctx.createOscillator()
  const amt = ctx.createGain()
  vib.frequency.value = 7
  amt.gain.value = 18
  vib.connect(amt).connect(o.frequency)
  o.connect(env(t, 0.16, dur, 0.05))
  for (const x of [o, vib]) {
    x.start(t)
    x.stop(t + dur + 0.05)
  }
}
