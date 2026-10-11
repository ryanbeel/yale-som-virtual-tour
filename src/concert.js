import { useSyncExternalStore } from 'react'
import * as music from './music.js'

// The island concert: Golden Ryan Jr. starts a 20-second countdown, then the band plays a 90-second
// show. Night falls for the show and day comes back after. 45 s in, the crater erupts into a volcano
// and the party goes wild. Everything (band, crowd, effects, sky, music) reads the same clock here.
//   idle -> countdown (20 s) -> show (90 s, eruption at 45 s) -> idle
export const COUNTDOWN = 20
export const SHOW = 90
export const BPM = 128
export const ERUPT_AT = 45 // seconds into the show (bar 24 of the song)
// the shark's big moment: it races in behind the stage, leaps, and lands on stage with an electric
// guitar right as the final chorus hits (bar 32 = 60 s)
export const SHARK_APPROACH = 55.5
export const SHARK_LEAP = 57.5
export const SHARK_LAND = 60
// where the shark is during its stunt (Shark writes it, the stage spotlights aim at it)
export const sharkSpot = { x: 0, y: 0, z: 0 }
const DUSK = 8 // seconds of sunset at the end of the countdown
const DAWN = 6 // seconds for daylight to come back after the show

let state = { phase: 'idle', start: 0, muted: false, erupted: false, shark: false, endedAt: -Infinity }
const listeners = new Set()
const emit = (patch) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const now = () => performance.now() / 1000

export const concert = {
  get: () => state,
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  // called from a click/tap, so the browser lets us start audio
  start() {
    if (state.phase !== 'idle') return
    music.prime()
    emit({ phase: 'countdown', start: now(), erupted: false, shark: false })
  },
  // advance the phases; Concert calls this every frame
  tick() {
    const t = now() - state.start
    if (state.phase === 'countdown' && t >= COUNTDOWN) {
      music.play(BPM)
      emit({ phase: 'show' })
    } else if (state.phase === 'show' && !state.erupted && t >= COUNTDOWN + ERUPT_AT) {
      emit({ erupted: true })
    } else if (state.phase === 'show' && !state.shark && t >= COUNTDOWN + SHARK_LAND) {
      emit({ shark: true })
    } else if (state.phase === 'show' && t >= COUNTDOWN + SHOW) {
      music.stop()
      emit({ phase: 'idle', erupted: false, shark: false, endedAt: now() })
    }
  },
  // where we are: seconds left in the countdown, seconds into the show, beat number, seconds since
  // the eruption (-1 before), how dark it is (0 day .. 1 night), seconds since the show ended
  timeline() {
    const n = now()
    const t = n - state.start
    const showT = state.phase === 'show' ? t - COUNTDOWN : -1
    const sinceEnd = n - state.endedAt
    const clamp = (v) => Math.min(1, Math.max(0, v))
    return {
      phase: state.phase,
      countdownLeft: state.phase === 'countdown' ? Math.max(0, COUNTDOWN - t) : 0,
      showT,
      beat: showT >= 0 ? (showT * BPM) / 60 : -1,
      erupt: showT >= ERUPT_AT ? showT - ERUPT_AT : -1,
      night: state.phase === 'show' ? 1 : state.phase === 'countdown' ? clamp((t - (COUNTDOWN - DUSK)) / DUSK) : clamp(1 - sinceEnd / DAWN),
      sinceEnd,
    }
  },
  setMuted(muted) {
    music.setMuted(muted)
    emit({ muted })
  },
  reset() {
    music.stop()
    if (state.phase !== 'idle') emit({ phase: 'idle', erupted: false, shark: false, endedAt: -Infinity })
  },
}

export const useConcert = () => useSyncExternalStore(concert.subscribe, () => state)
