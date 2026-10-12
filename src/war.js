import { useSyncExternalStore } from 'react'
import { warMusic, stopWarMusic } from './music.js'
import { WAR, finaleLive } from './island.js'

// THE GREAT TIKI-DINO WAR (~72 s), started by the GAME NIGHT button.
// A dino and a tiki monster play rock-paper-scissors; the tiki cheats; the dino flips the table; then
// 100 dinos and 100 tikis form up, charge, and fight with swords, spears, clubs, shields and cannons.
// 30 s into the battle, reinforcements (giant T. rexes, giant tikis, a Ryan Jr. clone cavalry) make it
// twice as crazy, until a mega-explosion launches everyone into the sky and they land in one big heap.
export const W = {
  ROCK: 2,
  PAPER: 3,
  SCISSORS: 4,
  SHOOT: 5,
  TIKI_LATE: 5.9, // ...the tiki waits, THEN shows paper
  CHEAT: 7.2,
  FLIP: 9, // the dino flips the table
  MARCH: 10, // armies march in and form up
  CHARGE: 18,
  CLASH: 20.6,
  REINFORCE: 48, // 30 s into the battle
  MEGA: 62,
  HEAP: 66,
  END: 72,
}

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

// cannons: 4 per side behind each army; shots land somewhere in the melee (shared by visuals + sound)
export const CANNONS = [
  ...[-26, -14, -2, 6].map((x) => ({ side: 'dino', x, z: WAR.zDino - 6.5 })),
  ...[-30, -12, -4, 4].map((x) => ({ side: 'tiki', x, z: WAR.zTiki + 5.5 })),
]
export const FLIGHT = 1.5 // cannonball flight time
export const CANNON_SHOTS = (() => {
  const r = rand(1812)
  const out = []
  CANNONS.forEach((c, i) => {
    let t = W.CLASH + 0.5 + r() * 2
    while (t < W.MEGA - FLIGHT) {
      out.push({ at: t, cannon: i, to: [WAR.x0 + 4 + r() * (WAR.x1 - WAR.x0 - 8), WAR.zMid + (r() - 0.5) * 22] })
      t += t > W.REINFORCE ? 0.9 + r() * 1.1 : 2 + r() * 1.6
    }
  })
  return out.sort((a, b) => a.at - b.at)
})()

// HUD stages (App shows a banner for each)
const STAGES = [
  [0, 'game'],
  [W.CHEAT, 'cheat'],
  [W.MARCH, 'war'],
  [W.CHARGE, 'charge'],
  [W.CLASH + 2, 'battle'],
  [W.REINFORCE, 'reinforce'],
  [W.REINFORCE + 4, 'chaos'],
  [W.MEGA, 'mega'],
  [W.HEAP, 'heap'],
]

let state = { active: false, start: 0, stage: null, plays: 0 }
const listeners = new Set()
const emit = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const now = () => performance.now() / 1000

export const war = {
  get: () => state,
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  // called from a click/tap so the browser lets the music play
  start() {
    if (state.active || finaleLive.busy) return
    warMusic({ W, CANNON_SHOTS, FLIGHT })
    emit({ active: true, start: now(), stage: 'game', plays: state.plays + 1 })
  },
  tick() {
    if (!state.active) return
    const t = now() - state.start
    if (t >= W.END) return emit({ active: false, stage: null })
    const stage = STAGES.filter(([at]) => t >= at).pop()[1]
    if (stage !== state.stage) emit({ stage })
  },
  // seconds since GAME NIGHT was pressed (-1 when nothing is happening)
  t: () => (state.active ? now() - state.start : -1),
  reset() {
    stopWarMusic()
    if (state.active) emit({ active: false, stage: null })
  },
}

export const useWar = () => useSyncExternalStore(war.subscribe, () => state)
