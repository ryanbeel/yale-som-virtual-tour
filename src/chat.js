import { useSyncExternalStore } from 'react'

// Tiny shared store so 3D avatars (inside the Canvas) and the chat window (DOM) can talk.
//   open     { id, name, course } of the professor being chatted with, or null
//   aim      same shape when the crosshair is on a professor (desktop), else null
//   near     same shape when the player is standing close to one (phones get a Talk button)
let state = { open: null, aim: null, near: null }
const listeners = new Set()

export const chat = {
  get: () => state,
  set(patch) {
    const next = { ...state, ...patch }
    if (Object.keys(patch).every((k) => next[k] === state[k])) return
    state = next
    listeners.forEach((l) => l())
  },
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  speakUntil: 0, // clock time until which the open professor's mouth keeps moving
}

export const useChat = (select) => useSyncExternalStore(chat.subscribe, () => select(state))

// backend base URL: same origin in dev (Vite proxies /api), or VITE_API_URL for a deployed backend
export const API = import.meta.env.VITE_API_URL || ''
