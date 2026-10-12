import { useSyncExternalStore } from 'react'
import { pressSfx } from './music.js'

// DO NOT PRESS: a 30-second event on the south beach. The alarm goes off, the sea boils, a giant
// Ryan Jr. rises out of the ocean, shakes off hundreds of mini clones, sneezes (he's allergic to
// himself) and blows every cat on the island into the air, then purrs, and sinks back down.
export const T = {
  BOIL: 3, // sea starts bubbling
  RISE: 8, // giant starts rising
  RISEN: 13,
  SHAKE: 13, // shakes off like a wet cat, flinging mini clones
  AHH: 17, // nose twitch
  SNEEZE: 19.5, // ACHOO
  BLESS: 25,
  SINK: 27,
  END: 30,
}
// HUD stages, in order (App shows a banner for each)
const STAGES = [
  [0, 'alarm'],
  [T.RISE, 'giant'],
  [T.SNEEZE, 'sneeze'],
  [T.BLESS, 'bless'],
]

let state = { active: false, start: 0, stage: null, presses: 0 }
const listeners = new Set()
const emit = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const now = () => performance.now() / 1000

export const press = {
  get: () => state,
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  // called from a click/tap so the browser lets the sound play
  start() {
    if (state.active) return
    pressSfx()
    emit({ active: true, start: now(), stage: 'alarm', presses: state.presses + 1 })
  },
  tick() {
    if (!state.active) return
    const t = now() - state.start
    if (t >= T.END) return emit({ active: false, stage: null })
    const stage = STAGES.filter(([at]) => t >= at).pop()[1]
    if (stage !== state.stage) emit({ stage })
  },
  // seconds since the button was pressed (-1 when nothing is happening)
  t: () => (state.active ? now() - state.start : -1),
  reset() {
    if (state.active) emit({ active: false, stage: null })
  },
}

export const usePress = () => useSyncExternalStore(press.subscribe, () => state)
