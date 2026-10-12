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
