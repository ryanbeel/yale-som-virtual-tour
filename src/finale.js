import { useSyncExternalStore } from 'react'
import { askSfx, finaleMusic, stopFinaleMusic } from './music.js'
import { concert } from './concert.js'
import { press } from './donotpress.js'
import { war } from './war.js'
import { world } from './world.js'
import { CRATER, ROYAL_BOX, ROYAL_STAGE, finaleLive, heightAt } from './island.js'

// THE FINALE (~95 s): the most epic event of all time. Press the secret button in the crater, say YES
// twice, and you're beamed onto the floating Royal Box. Then:
//   1. THE AWAKENING: the ground rumbles, the sky turns blood red, lightning, fire rains from the sky
//   2. KING RYAN JR. rises out of the crater on a golden throne, and everyone parades in to honor him
//   3. THE ULTIMATE CONCERT: a stage rises, the band plays (guitar duel: Rose vs. the shark), DJ Zaman
//      drops the beat, the volcano erupts
//   4. THE END OF THE ISLAND: a giant Ryan Jr. sneezes, a tsunami, cannons, a cat waterfall, a sharknado,
//      then 3-2-1 LIFTOFF: the whole island flies into space, floats in zero gravity, comes back down
//      under a giant parachute, splashes down... and a tiny new button appears.
// Visuals: Finale.jsx + FinaleFx.jsx. Score: finaleMusic in music.js. Banners + shake: App.jsx.
export const F = {
  AWAKEN: 0,
  FIRE: 3,
  BEAM: 9.5, // a golden beam shoots up out of the crater
  RISE: 11, // the throne rises
  CROWN: 16, // ALL HAIL KING RYAN JR.
  PARADE: 18,
  SHOW: 31, // LET THE SHOW BEGIN (the concert: 14 bars at 128 BPM)
  DUEL: 38.5, // bar 4: Rose vs. the shark
  BUILD: 46, // bar 8: DJ Zaman builds it up
  DROP: 49.75, // bar 10: THE DROP
  CHAOS: 57.25, // bar 14: total island chaos
  SNEEZE: 61,
  WAVE: 61.6, // the tsunami
  TOSPACE: 64.5, // the king: "TO SPACE!!!"
  COUNT: 65.5, // 3 (65.5), 2 (66.5), 1 (67.5)
  LIFTOFF: 68.5,
  SPACE: 74.5, // zero gravity
  CHUTE: 82, // the parachute opens
  SPLASH: 88,
  TINY: 90.5, // the tiny new button
  END: 95,
}
export const BPM = 128
export const BEAT = 60 / BPM
export const SPACE_Y = 650 // how high the island flies (m)
// shared timings (visuals + sound)
export const LIGHTNING_F = [3.4, 4.1, 5.0, 5.6, 6.3, 7.2, 7.7, 8.5, 9.1, 10.2, 57.8, 58.9, 59.6, 60.4, 62.3, 63.1, 64.0, 65.0, 66.2, 67.4]

const rand = (seed) => {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}
const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const smooth = (v) => {
  const x = clamp01(v)
  return x * x * (3 - 2 * x)
}

// fireballs falling from the sky: [launch time, target x, z, size]; they land FALL seconds later
export const FALL = 1.6
export const METEORS = (() => {
  const r = rand(4242)
  const out = []
  const add = (from, to, every) => {
    for (let t = from; t < to; t += every * (0.5 + r())) {
      // somewhere 14-80 m from the Royal Box, mostly out in front of it
      const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.6
      const d = 14 + r() * 66
      out.push({ at: t, x: ROYAL_BOX.x + Math.cos(a) * d, z: ROYAL_BOX.z + Math.sin(a) * d, s: 0.8 + r() * 1.2 })
    }
  }
  add(F.FIRE, F.RISE - FALL, 0.22)
  add(F.CHAOS, F.COUNT - FALL, 0.5)
  return out
})()

// cannonballs during the chaos: fired from 6 cannons around the crowd
export const CANNONS_F = [
  [-14, -30], [-16, -10], [-6, 6], [32, -4], [34, -16], [26, 6],
].map(([x, z]) => ({ x, z }))
export const CANNON_FLIGHT = 1.4
export const SHOTS_F = (() => {
  const r = rand(77)
  const out = []
  CANNONS_F.forEach((c, i) => {
    for (let t = F.CHAOS + 0.6 + r() * 1.2; t < F.COUNT - CANNON_FLIGHT; t += 1 + r() * 1.3) {
      out.push({ at: t, cannon: i, to: [2 + r() * 24, -18 + r() * 18] })
    }
  })
  return out.sort((a, b) => a.at - b.at)
})()

// clones shot out of the overloaded Clone-O-Matic
export const N_CLONES_F = 60
export const CLONE_LAUNCH = (i) => F.CHAOS + 0.5 + (i / N_CLONES_F) * 7.5

// HUD stages (App shows a banner for each)
const STAGES = [
  [0, 'awaken'],
  [F.FIRE, 'fire'],
  [F.RISE, 'rise'],
  [F.CROWN, 'king'],
  [F.PARADE + 1, 'parade'],
  [F.SHOW, 'show'],
  [F.DUEL, 'duel'],
  [F.BUILD, 'build'],
  [F.DROP, 'drop'],
  [F.CHAOS, 'chaos'],
  [F.SNEEZE, 'achoo'],
  [F.SNEEZE + 2.2, 'wave'],
  [F.TOSPACE, 'tospace'],
  [F.COUNT, 'three'],
  [F.COUNT + 1, 'two'],
  [F.COUNT + 2, 'one'],
  [F.LIFTOFF, 'liftoff'],
  [F.SPACE, 'space'],
  [F.CHUTE, 'chute'],
  [F.SPLASH, 'splash'],
  [F.TINY, 'end'],
]

// how high the whole island has flown at time e
export function liftAt(e) {
  if (e < F.LIFTOFF || e >= F.SPLASH) return 0
  if (e < F.SPACE) {
    const u = clamp01((e - F.LIFTOFF) / (F.SPACE - F.LIFTOFF))
    return SPACE_Y * u * u * u * (u * (u * 6 - 15) + 10) // smootherstep: slow start, fast, gentle stop
  }
  if (e < F.CHUTE) return SPACE_Y + Math.sin(((e - F.SPACE) / (F.CHUTE - F.SPACE)) * Math.PI) * 8
  return SPACE_Y * (1 - smooth((e - F.CHUTE) / (F.SPLASH - F.CHUTE)))
}
// the Royal Box floats at deck height until after the splash, then sets you down gently
export const boxGround = () => Math.max(heightAt(ROYAL_BOX.x, ROYAL_BOX.z), 0) + 0.25
export function boxDeckY(e) {
  return ROYAL_BOX.y + (boxGround() - ROYAL_BOX.y) * smooth((e - (F.SPLASH + 1)) / 3)
}
// gravity: 1 normally, ~0 in space (characters float), ramps back before the splash
export function zeroG(e) {
  return smooth((e - F.SPACE + 0.5) / 2) * (1 - smooth((e - F.CHUTE - 1) / 4))
}
// the concert stage rises out of the ground in front of the crater (deck DECK_H m up), and sinks
// back at the very end. Stage-local x runs along the front, +z toward the Royal Box.
export const DECK_H = 7
export const stageRise = (e) => smooth((e - F.SHOW) / 2.2) * (1 - smooth((e - (F.TINY + 0.5)) / 3.5))
export const stageY = (e) => ROYAL_STAGE.y + DECK_H * stageRise(e)
const SC = Math.cos(ROYAL_STAGE.yaw)
const SS = Math.sin(ROYAL_STAGE.yaw)
export const stagePoint = (lx, lz) => [ROYAL_STAGE.x + lx * SC + lz * SS, ROYAL_STAGE.z - lx * SS + lz * SC]
// the sharknado crosses the field during the chaos
export const TORNADO = { from: [-30, -36], to: [6, -42], on: F.CHAOS + 1, off: F.COUNT + 1.5 }
export function tornadoAt(e) {
  const k = smooth((e - TORNADO.on) / 1.2) * (1 - smooth((e - TORNADO.off + 1) / 1))
  const u = clamp01((e - TORNADO.on) / (TORNADO.off - TORNADO.on))
  return {
    k,
    x: TORNADO.from[0] + (TORNADO.to[0] - TORNADO.from[0]) * u + Math.sin(e * 0.9) * 3,
    z: TORNADO.from[1] + (TORNADO.to[1] - TORNADO.from[1]) * u + Math.cos(e * 0.7) * 3,
  }
}
// the tsunami rolls south across the whole island (its crest's z), or null
export function waveZ(e) {
  const a = e - F.WAVE
  return a >= 0 && a < 4.4 ? -80 + a * 38 : null
}
// you face the crater when you arrive on the box
export const VIEW_YAW = -Math.atan2(CRATER.x - 8 - ROYAL_BOX.x, -(CRATER.z - ROYAL_BOX.z))

let state = { asking: 0, chicken: 0, chickenAt: 0, active: false, start: 0, stage: null, plays: 0, done: false }
const listeners = new Set()
const emit = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const now = () => performance.now() / 1000
let frameT = -1 // time of the current frame (so everything in a frame agrees)

function finish() {
  finaleLive.box = false
  finaleLive.lift = 0
  finaleLive.busy = false
}

export const finale = {
  get: () => state,
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  // the secret button: "Are you sure?" (asking 1) -> "Are you truly ready for this?" (asking 2)
  ask() {
    if (state.active || state.asking || finaleLive.busy) return
    askSfx(1)
    emit({ asking: 1 })
  },
  answer(yes) {
    if (!yes) return emit({ asking: 0, chicken: performance.now(), chickenAt: state.asking })
    if (state.asking === 1) {
      askSfx(2)
      return emit({ asking: 2 })
    }
    emit({ asking: 0 })
    finale.start()
  },
  // called from the YES click (a user gesture), so the browser lets the score play
  start() {
    if (state.active) return
    if (concert.get().phase !== 'idle') concert.reset()
    press.reset()
    war.reset()
    finaleLive.busy = true
    finaleLive.box = true
    finaleLive.boxY = ROYAL_BOX.y
    finaleLive.lift = 0
    finaleMusic(F, { lightning: LIGHTNING_F, shots: SHOTS_F, flight: CANNON_FLIGHT })
    frameT = 0
    emit({ active: true, start: now(), stage: 'awaken', plays: state.plays + 1 })
    world.beam({ x: ROYAL_BOX.x, z: ROYAL_BOX.z + 1.8, yaw: VIEW_YAW })
  },
  // once per frame, before anything else draws (Finale uses a negative useFrame priority)
  tick() {
    if (!state.active) {
      frameT = -1
      return
    }
    const t = now() - state.start
    if (t >= F.END) {
      finish()
      frameT = -1
      return emit({ active: false, stage: null, done: true })
    }
    frameT = t
    finaleLive.lift = liftAt(t)
    finaleLive.boxY = boxDeckY(t)
    finaleLive.tiny = state.done || t >= F.TINY
    const stage = STAGES.filter(([at]) => t >= at).pop()[1]
    if (stage !== state.stage) emit({ stage })
  },
  // seconds since YES (-1 when nothing is happening)
  t: () => frameT,
  reset() {
    stopFinaleMusic()
    if (state.active) {
      finish()
      frameT = -1
      emit({ active: false, stage: null, asking: 0 })
    } else if (state.asking) emit({ asking: 0 })
  },
}

export const useFinale = () => useSyncExternalStore(finale.subscribe, () => state)

// ---------- the sky: a palette per moment, blended (Island's Atmosphere uses this while it runs)
const PAL = {
  day: { top: '#2f8fe0', mid: '#8fd3ff', low: '#e8f8ff', fog: '#bfe9ff', far: 330, hemi: 1.1, sun: 1.9, amb: 0.25, cloud: '#ffffff', stars: 0, moon: 0, sunBall: 1, sunCol: '#fff7c2', water: '#18bccb' },
  blood: { top: '#1a0006', mid: '#7a0f14', low: '#ff5a1f', fog: '#5a1a10', far: 230, hemi: 0.5, sun: 1.0, amb: 0.2, cloud: '#3a0a0a', stars: 0, moon: 0, sunBall: 1, sunCol: '#ff3a1a', water: '#5a1a2a' },
  royal: { top: '#1a0640', mid: '#8a2a8a', low: '#ffb03a', fog: '#7a3a6a', far: 300, hemi: 0.8, sun: 1.4, amb: 0.22, cloud: '#ffb0d0', stars: 0.25, moon: 0, sunBall: 1, sunCol: '#ffc070', water: '#4a3a8a' },
  night: { top: '#04051a', mid: '#141a4a', low: '#3a2a5a', fog: '#141a3a', far: 260, hemi: 0.3, sun: 0.25, amb: 0.16, cloud: '#3a3f66', stars: 1, moon: 1, sunBall: 0, sunCol: '#9fb4ff', water: '#0c3d66' },
  storm: { top: '#05050a', mid: '#2a1036', low: '#5a1a1a', fog: '#1a0f1f', far: 210, hemi: 0.32, sun: 0.35, amb: 0.16, cloud: '#1a1420', stars: 0, moon: 0, sunBall: 0, sunCol: '#a07aff', water: '#0a2a3a' },
  space: { top: '#000000', mid: '#02020a', low: '#0a0a2a', fog: '#000000', far: 900, hemi: 0.45, sun: 1.7, amb: 0.18, cloud: '#ffffff', stars: 1, moon: 1, sunBall: 1, sunCol: '#ffffff', water: '#0c3d66' },
  sunset: { top: '#2a3a8a', mid: '#ff7a5a', low: '#ffd27a', fog: '#ffb08a', far: 330, hemi: 0.95, sun: 1.5, amb: 0.22, cloud: '#ffc0a0', stars: 0, moon: 0, sunBall: 1, sunCol: '#ffb070', water: '#2f8fb0' },
}
const SKY = [
  [0, 'day'], [2.5, 'blood'], [10, 'blood'], [13.5, 'royal'], [30, 'royal'], [33, 'night'], [57, 'night'], [58.5, 'storm'],
  [69.5, 'storm'], [73.5, 'space'], [83, 'space'], [87, 'sunset'], [92, 'sunset'], [95, 'day'],
]
const mixHex = (a, b, k, c1, c2) => '#' + c1.set(a).lerp(c2.set(b), k).getHexString()
export function finaleSky(e, THREE) {
  let i = 0
  while (i < SKY.length - 2 && e >= SKY[i + 1][0]) i++
  const [ta, a] = SKY[i]
  const [tb, b] = SKY[i + 1]
  const k = smooth((e - ta) / (tb - ta))
  const A = PAL[a]
  const B = PAL[b]
  const c1 = new THREE.Color()
  const c2 = new THREE.Color()
  const out = {}
  for (const key of Object.keys(A)) out[key] = typeof A[key] === 'number' ? A[key] + (B[key] - A[key]) * k : mixHex(A[key], B[key], k, c1, c2)
  return out
}
