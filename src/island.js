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
export const HUTS = [[-40, 30, 2.4], [38, 10, -1.2], [10, -46, 0.1], [-44, -2, 0.6]]
export const HAMMOCK = { a: [16, 42], b: [21, 40] }
// concert: Golden Ryan Jr. (talk to him to start the show) and the audience area in front of the stage
export const GOLDEN = { x: -14, z: 28 }
export const AUDIENCE = { x0: -18, x1: -8.5, z0: 10, z1: 24 }
// the DO NOT PRESS button on the south beach, and where the giant Ryan Jr. rises out of the sea
export const BUTTON = { x: 8, z: 46.5 }
export const GIANT = { x: 8, z: 108 }
// the Great Tiki-Dino War: a battlefield across the middle of the island (dinos form up near the north
// shore, tikis just north of the big sign), plus the game table and GAME NIGHT button beside the sign
export const WAR = { x0: -32, x1: 8, zDino: -40.5, zTiki: -4.5, zMid: -22 }
export const WAR_BUTTON = { x: -19, z: 7.5 }
export const GAME_TABLE = { x: -25, z: 6 }
// THE FINALE: a secret button in the middle of the crater. Say YES (twice) and you're beamed onto the
// floating Royal Box to watch: King Ryan Jr. rises out of the crater, the royal parade marches across
// the field, the band plays on a stage that rises in front of the crater, and the crowd fills the
// ground under the box. A giant Ryan Jr. rises in the north sea for the chaos.
export const FINALE_BUTTON = { x: CRATER.x, z: CRATER.z }
export const ROYAL_BOX = { x: 12, z: -4, y: 11, r: 4.2 } // y = deck height above sea level
export const ROYAL_STAGE = { x: 14, z: -22, y: 1.4, yaw: Math.atan2(ROYAL_BOX.x - 14, ROYAL_BOX.z + 22) } // faces the box
export const KING_YAW = Math.atan2(ROYAL_BOX.x - CRATER.x, ROYAL_BOX.z - CRATER.z) // the king faces the box too
export const NORTH_GIANT = { x: -62, z: -96 } // north-west sea, so the king and the stage don't hide him
export const TINY_BUTTON = { x: ROYAL_BOX.x, z: ROYAL_BOX.z + 2.6 } // "DO NOT PRESS THIS ONE EITHER."
// live finale state the player physics needs (Finale.jsx keeps it up to date every frame):
// box = standing on the Royal Box (deck at boxY), lift = how high the whole island has flown,
// tiny = the tiny button exists, busy = the finale is running (other events wait)
export const finaleLive = { box: false, boxY: ROYAL_BOX.y, lift: 0, tiny: false, busy: false }

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
  if (Math.hypot(x - GOLDEN.x, z - GOLDEN.z) < 4 + pad) return false
  if (Math.hypot(x - BUTTON.x, z - BUTTON.z) < 8 + pad) return false
  if (x > WAR.x0 - 4 + pad && x < WAR.x1 + 4 && z > WAR.zDino - 8 && z < WAR_BUTTON.z + 3) return false // battlefield
  if (x > AUDIENCE.x0 - 2 && x < AUDIENCE.x1 + 2 && z > AUDIENCE.z0 - 2 && z < AUDIENCE.z1 + 2) return false
  if (Math.hypot(x - CRATER.x, z - CRATER.z) < CRATER.r + 7 + pad) return false
  if (x > 0 && x < 27 && z > -30 && z < 2) return false // the finale's stage + crowd
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
  .filter(([x, z]) => !(x > AUDIENCE.x0 - 1 && x < AUDIENCE.x1 + 1.5 && z > AUDIENCE.z0 - 1 && z < AUDIENCE.z1 + 1)) // ...and the audience

// ---------- player physics hooks (same shape as layout.js: collide / floorAt / locate)
const R_PLAYER = 0.35
const POSTS = () => [
  ...PALMS.map(([x, z]) => [x, z, 0.35]),
  ...HUTS.map(([x, z]) => [x, z, 2.2]),
  [MACHINE.x, MACHINE.z - 0.5, 2.6],
  [SIGN.x - 6.5, SIGN.z, 0.4],
  [SIGN.x + 6.5, SIGN.z, 0.4],
  [BAR.x, BAR.z, 2.6],
  [GOLDEN.x, GOLDEN.z, 0.9],
  [BUTTON.x, BUTTON.z, 0.7],
  [WAR_BUTTON.x, WAR_BUTTON.z, 0.7],
  [GAME_TABLE.x, GAME_TABLE.z, 1.0],
  [FINALE_BUTTON.x, FINALE_BUTTON.z, 0.8],
]
let posts
export function collide(pos) {
  // on the Royal Box: the railing keeps you on board
  if (finaleLive.box) {
    const dx = pos.x - ROYAL_BOX.x
    const dz = pos.z - ROYAL_BOX.z
    const d = Math.hypot(dx, dz)
    const R = ROYAL_BOX.r - R_PLAYER
    if (d > R) {
      pos.x = ROYAL_BOX.x + (dx / d) * R
      pos.z = ROYAL_BOX.z + (dz / d) * R
    }
    return pos
  }
  posts ??= POSTS()
  if (finaleLive.tiny) {
    const dx = pos.x - TINY_BUTTON.x
    const dz = pos.z - TINY_BUTTON.z
    const d = Math.hypot(dx, dz)
    if (d < 0.3 + R_PLAYER && d > 1e-6) {
      pos.x = TINY_BUTTON.x + (dx / d) * (0.3 + R_PLAYER)
      pos.z = TINY_BUTTON.z + (dz / d) * (0.3 + R_PLAYER)
    }
  }
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
  if (finaleLive.box && Math.hypot(x - ROYAL_BOX.x, z - ROYAL_BOX.z) < ROYAL_BOX.r + 0.5) return finaleLive.boxY
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
  if (finaleLive.box) where = 'The Royal Box 👑'
  else if (inWater(x, z)) where = 'In the water… watch out for the shark!'
  else if (at(MACHINE, 5)) where = 'Clone-O-Matic 3000'
  else if (at(WAR_BUTTON, 4) || at(GAME_TABLE, 3)) where = 'Game night 🎲'
  else if (Math.abs(x - STAGE.x) < STAGE.d / 2 + 3 && Math.abs(z - STAGE.z) < STAGE.w / 2 + 3) where = 'The Stage'
  else if (at(GOLDEN, 3)) where = 'Golden Ryan Jr.'
  else if (at(BUTTON, 4)) where = 'DO NOT PRESS'
  else if (x > WAR.x0 && x < WAR.x1 && z > WAR.zDino - 4 && z < WAR.zTiki + 3) where = 'The Battlefield'
  else if (at(BAR, 7)) where = 'Tiki Bar'
  else if (at(FINALE_BUTTON, 4)) where = '??? 👑'
  else if (finaleLive.tiny && at(TINY_BUTTON, 2.5)) where = 'DO NOT PRESS (this one either)'
  else if (at(CRATER, CRATER.r + 6)) where = 'Diamond Head crater'
  else if (at(PLAZA, PLAZA.r + 6) || onPath(x, z)) where = 'Arrival Plaza'
  else if (inland(x, z) > 22) where = 'Jungle'
  else if (inland(x, z) > 11) where = 'Palm grove'
  return `Ryan Jr. Island · ${where}`
}
