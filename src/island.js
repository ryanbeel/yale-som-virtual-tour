// Ryan Jr. Island: terrain + layout. Units are meters; same axes as Evans Hall (+x east, -z north).
// Sea level is y = 0. You arrive on the south plaza facing north, toward the giant sign and the
// Clone-O-Matic. A Diamond-Head-style crater sits on the northeast coast.

export const SHORE = (th) => 58 + 5 * Math.sin(3 * th + 0.4) + 3 * Math.sin(5 * th + 1.3) + 2 * Math.sin(7 * th + 2)
export const CRATER = { x: 30, z: -28, r: 13, h: 12 }
export const EDGE = 115 // invisible wall out in the ocean
export const SWIM_FLOOR = -1.0 // in deep water you "swim" with your head above the waves

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// meters inland from the shoreline (negative = out in the water)
export function inland(x, z) {
  return SHORE(Math.atan2(z, x)) - Math.hypot(x, z)
}

// actual ground height (sea floor under water)
export function heightAt(x, z) {
  const d = inland(x, z)
  let h = d >= 0 ? 0.1 + 1.2 * smooth(0, 16, d) + 0.5 * Math.sin(x * 0.08) * Math.cos(z * 0.07) * smooth(14, 30, d) : Math.max(-2.4, d * 0.2)
  const dc = Math.hypot(x - CRATER.x, z - CRATER.z)
  const ridge = CRATER.h * Math.exp(-(((dc - CRATER.r) / 5.5) ** 2)) - 0.4
  const bowl = dc < CRATER.r ? 3.2 + (CRATER.h - 3.2) * (dc / CRATER.r) ** 4 : -Infinity // grassy crater floor
  if (ridge > 0) h = Math.max(h, ridge) // the ridge only ever raises ground (out at sea it's ~0)
  h = Math.max(h, Math.min(bowl, CRATER.h))
  return h
}

// ---------- where everything is
export const SPAWN = { x: 0, z: 35, yaw: 0 } // facing north at the sign + cloning machine
export const PLAZA = { x: 0, z: 18, r: 12 }
export const MACHINE = { x: 0, z: 13 }
export const SIGN = { x: 0, z: 4 }
export const RETURN_PORTAL = { x: 0, z: 42 }
export const STAGE = { x: -24, z: 17, w: 11, d: 7, rot: Math.PI / 2 } // faces east toward the plaza
export const BAR = { x: 22, z: 20, rot: -Math.PI / 2 } // faces west toward the plaza
export const HUTS = [[-32, -6, 0.6], [-14, -28, 0.2], [-40, 30, 2.4], [38, 10, -1.2], [10, -46, 0.1]]
export const HAMMOCK = { a: [16, 42], b: [21, 40] }

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

const clear = (x, z, pad = 0) => {
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 3 + pad) return false
  if (Math.hypot(x - SIGN.x, z - SIGN.z) < 9 + pad) return false
  if (Math.abs(x - STAGE.x) < STAGE.d / 2 + 4 + pad && Math.abs(z - STAGE.z) < STAGE.w / 2 + 4 + pad) return false
  if (Math.hypot(x - BAR.x, z - BAR.z) < 7 + pad) return false
  if (Math.hypot(x - RETURN_PORTAL.x, z - RETURN_PORTAL.z) < 5 + pad) return false
  if (Math.hypot(x - CRATER.x, z - CRATER.z) < CRATER.r + 7 + pad) return false
  if (HUTS.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 5 + pad)) return false
  return true
}

// palms ring the beach, plus a few inland; two hold up the hammock
export const PALMS = (() => {
  const r = rand(77)
  const out = [[...HAMMOCK.a, 0.3], [...HAMMOCK.b, -0.4]]
  for (let i = 0; i < 70 && out.length < 46; i++) {
    const th = (i / 70) * Math.PI * 2 + r() * 0.05
    const d = 4 + r() * 9
    const R = SHORE(th) - d
    const x = Math.cos(th) * R
    const z = Math.sin(th) * R
    if (clear(x, z) && out.every(([px, pz]) => Math.hypot(x - px, z - pz) > 4)) out.push([x, z, r() * Math.PI * 2])
  }
  for (const [x, z] of [[-20, -8], [-6, -14], [12, -6], [-30, 8], [30, 32], [-8, 46]]) if (clear(x, z)) out.push([x, z, r() * 6])
  return out
})()

// umbrellas + loungers + towels on the south and west beaches
export const BEACH_SPOTS = (() => {
  const r = rand(5)
  const out = []
  for (const th of [1.1, 1.3, 1.5, 1.75, 1.95, 2.3, 2.6, 2.9, 3.3, 0.85]) {
    const R = SHORE(th) - 3.5 - r() * 2
    const x = Math.cos(th) * R
    const z = Math.sin(th) * R
    if (clear(x, z, -2)) out.push([x, z, th + Math.PI, r()])
  }
  return out
})()

export const TORCHES = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2
  return [PLAZA.x + Math.cos(a) * (PLAZA.r + 1), PLAZA.z + Math.sin(a) * (PLAZA.r + 1)]
}).filter(([x, z]) => !(Math.abs(x) < 3.5 && z > MACHINE.z)) // keep the walkway from the arrival spot clear

// ---------- player physics hooks (same shape as layout.js: collide / floorAt / locate)
const R_PLAYER = 0.35
const POSTS = () => [
  ...PALMS.map(([x, z]) => [x, z, 0.35]),
  ...HUTS.map(([x, z]) => [x, z, 2.2]),
  [MACHINE.x, MACHINE.z - 0.5, 2.6],
  [SIGN.x - 6.5, SIGN.z, 0.4],
  [SIGN.x + 6.5, SIGN.z, 0.4],
  [BAR.x, BAR.z, 2.6],
]
let posts
export function collide(pos) {
  posts ??= POSTS()
  for (const [x, z, r] of posts) {
    const dx = pos.x - x
    const dz = pos.z - z
    const d = Math.hypot(dx, dz)
    const rr = r + R_PLAYER
    if (d < rr && d > 1e-6) {
      pos.x = x + (dx / d) * rr
      pos.z = z + (dz / d) * rr
    }
  }
  // the stage is a solid box (walk around it, or hop up the front steps later)
  const d = Math.hypot(pos.x, pos.z)
  if (d > EDGE) {
    pos.x *= EDGE / d
    pos.z *= EDGE / d
  }
  return pos
}

export function floorAt(x, z) {
  if (Math.abs(x - STAGE.x) < STAGE.d / 2 && Math.abs(z - STAGE.z) < STAGE.w / 2) return Math.max(heightAt(x, z), 0.5) + 0.9
  return Math.max(heightAt(x, z), SWIM_FLOOR)
}

// sandy plaza + a sand path from the plaza down to the south beach
export function onPath(x, z) {
  return Math.abs(x - PLAZA.x) < 3.5 && z > PLAZA.z && inland(x, z) > 0
}
export function sandy(x, z) {
  return Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 5 || onPath(x, z)
}

export function inWater(x, z) {
  return heightAt(x, z) < -0.15
}

export function locate(x, z) {
  const at = (p, r) => Math.hypot(x - p.x, z - p.z) < r
  let where = 'Beach'
  if (inWater(x, z)) where = 'In the water… watch out for the shark!'
  else if (at(MACHINE, 5)) where = 'Clone-O-Matic 3000'
  else if (Math.abs(x - STAGE.x) < STAGE.d / 2 + 3 && Math.abs(z - STAGE.z) < STAGE.w / 2 + 3) where = 'The Stage · band coming soon'
  else if (at(BAR, 7)) where = 'Tiki Bar'
  else if (at(CRATER, CRATER.r + 6)) where = 'Diamond Head crater'
  else if (at(PLAZA, PLAZA.r + 6) || onPath(x, z)) where = 'Arrival Plaza'
  else if (inland(x, z) > 22) where = 'Jungle'
  else if (inland(x, z) > 11) where = 'Palm grove'
  return `Ryan Jr. Island · ${where}`
}
