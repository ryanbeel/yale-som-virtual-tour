import { useSyncExternalStore } from 'react'
import { chat } from './chat.js'

// Which world you're in ('evans' or 'island'), shared by the Canvas, the player, the map and the HUD.
// Portals call go(name, spawn?); the player teleports to `spawn` (or the world's default spawn) and a
// white flash covers the swap.
let state = { name: 'evans', flash: 0, spawn: null }
const listeners = new Set()

export const world = {
  get: () => state,
  go(name, spawn = null) {
    if (name === state.name) return
    state = { name, flash: performance.now(), spawn }
    chat.set({ open: null, aim: null, near: null }) // nobody to talk to mid-teleport
    listeners.forEach((l) => l())
  },
  // teleport within the current world (with the same white flash)
  beam(spawn) {
    state = { ...state, flash: performance.now(), spawn }
    listeners.forEach((l) => l())
  },
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export const useWorld = () => useSyncExternalStore(world.subscribe, () => state)
