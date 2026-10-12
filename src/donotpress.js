import { useSyncExternalStore } from 'react'
import { finaleLive } from './island.js'
import { pressSfx } from './music.js'

// DO NOT PRESS: a ~50-second event on the south beach. The alarm goes off, a thunderstorm rolls in,
// the sea boils, a giant Ryan Jr. rises out of the ocean, shakes off hundreds of mini clones, and
// sneezes THREE times (he's allergic to himself), each bigger than the last; between sneezes he
// wades closer. The last one is a mega-sneeze that sets off the volcano. Then he purrs under a
// rainbow and sinks back down.
export const T = {
  BOIL: 3, // sea starts bubbling, storm rolls in
  RISE: 8, // giant starts rising
  RISEN: 13,
  SHAKE: 13, // shakes off like a wet cat, flinging mini clones
  CLOSER: 30.5, // after the 2nd sneeze he wades toward the beach
  CLOSE: 35,
  BLESS: 44,
  SINK: 46,
  END: 50,
}
// the three sneezes: when, how long the "ah… ahh…" build-up lasts, and how strong
export const SNEEZES = [
  { at: 20, build: 2.5, power: 1 },
  { at: 28.5, build: 2.5, power: 1.4 },
  { at: 38.5, build: 3.5, power: 2.2 },
]
export const LAST_SNEEZE = SNEEZES[SNEEZES.length - 1].at
// lightning strikes (seconds), shared by the sky and the thunder sound
export const LIGHTNING = [9.2, 11.6, 14.8, 16.9, 22.4, 24.6, 26.1, 31.2, 33.0, 34.6, 36.4, 37.6, 40.2, 41.5]

// HUD stages, in order (App shows a banner for each)
const STAGES = [
  [0, 'alarm'],
  [T.RISE, 'giant'],
  [SNEEZES[0].at, 'sneeze1'],
  [SNEEZES[0].at + 2.5, 'notdone'],
  [SNEEZES[1].at, 'sneeze2'],
  [T.CLOSER, 'closer'],
  [SNEEZES[2].at - SNEEZES[2].build, 'ahh'],
  [SNEEZES[2].at, 'sneeze3'],
  [T.BLESS, 'bless'],
]

// the sneeze that is "happening" at time e (latest one already started), with seconds since it
export function lastSneeze(e) {
  let found = null
  for (const s of SNEEZES) if (e >= s.at) found = s
  return found ? { ...found, since: e - found.at } : null
}

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
    if (state.active || finaleLive.busy) return
    pressSfx({ T, SNEEZES, LIGHTNING })
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
