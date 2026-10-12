import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { textBubble } from './Concert.jsx'
import { Parts, dinoParts, monsterParts } from './TikiParty.jsx'
import { useTalkable } from './talkable.js'
import { CANNONS, CANNON_SHOTS, FLIGHT, W, war } from './war.js'
import { GAME_TABLE, WAR, WAR_BUTTON, heightAt } from './island.js'

// THE GREAT TIKI-DINO WAR. Press GAME NIGHT: a dino and a tiki play rock-paper-scissors, the tiki
// cheats, the dino flips the table, and 100 dinos vs 100 tikis (swords, spears, clubs, shields,
// helmets, cannons) charge and battle, with everyone flying through the air. 30 s in, reinforcements
// (giant T. rexes, a giant tiki, a Ryan Jr. clone cavalry) double the chaos, then a mega-explosion
// launches everyone and they land in one big heap. (Score: warMusic in music.js; banners in App.)

export const WAR_PROF = {
  id: 'game-night',
  name: 'Game night',
  action: () => war.start(),
  hint: 'Click to start game night 🎲 (what could go wrong?)',
  talk: 'Game night! 🎲',
}

const SPH = new THREE.SphereGeometry(1, 12, 8)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12)
const CONE = new THREE.ConeGeometry(1, 1, 10)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const GEO = { sphere: SPH, cyl: CYL, cone: CONE, box: BOX }
const TORUS = new THREE.TorusGeometry(1, 0.22, 6, 16)

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }))
  return mats.get(k)
}
const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)]
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ground = (x, z) => Math.max(heightAt(x, z), 0)

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function War() {
  useEffect(() => () => war.reset(), []) // leaving the island ends the war
  useFrame(() => war.tick())
  return (
    <>
      <GameButton />
      <GameTable />
      <Armies />
      <Giants />
      <Cannons />
      <Flags />
      <Dust />
      <BattleCries />
    </>
  )
}

// ---------- the GAME NIGHT button
function GameButton() {
  const y = ground(WAR_BUTTON.x, WAR_BUTTON.z)
  const position = useMemo(() => [WAR_BUTTON.x, y, WAR_BUTTON.z], [y])
  const rotation = 0 // sign faces south, toward people coming from the plaza
  const root = useRef()
  const hit = useRef()
  const knob = useRef()
  useTalkable(WAR_PROF, { position, rotation, root, hit, sway: 0, anyRoom: true })
  const sign = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(768, 384, (g, w, h) => {
          g.fillStyle = '#2a1d4e'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#ffd23f'
          g.lineWidth = 18
          g.strokeRect(12, 12, w - 24, h - 24)
          g.textAlign = 'center'
          g.fillStyle = '#ffd23f'
          g.font = 'bold 110px "Arial Black", Impact, sans-serif'
          g.fillText('GAME NIGHT', w / 2, 170)
          g.fillStyle = '#ffffff'
          g.font = 'bold 54px system-ui, sans-serif'
          g.fillText('🦖 vs 🗿  (play nice!)', w / 2, 290)
        }),
      }),
    [],
  )
  useFrame(({ clock }) => {
    const on = war.t() >= 0
    knob.current.position.y = 1.3 - (on && war.t() < 0.4 ? 0.06 : 0)
    knob.current.material.emissiveIntensity = on ? 0.3 : 0.5 + Math.sin(clock.elapsedTime * 4) * 0.4
  })
  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      <mesh ref={hit} geometry={CYL} position={[0, 1, 0]} scale={[0.9, 2, 0.9]} visible={false} />
      <B g={CYL} c="#8a5a34" p={[0, 0.55, 0]} s={[0.5, 1.1, 0.5]} />
      {[0.3, 0.6, 0.9].map((yy) => (
        <B key={yy} g={CYL} c="#5a3a1c" p={[0, yy, 0]} s={[0.52, 0.05, 0.52]} />
      ))}
      <B g={CYL} c="#1d1d22" p={[0, 1.13, 0]} s={[0.55, 0.06, 0.55]} />
      <mesh ref={knob} geometry={SPH} position={[0, 1.3, 0]} scale={[0.32, 0.16, 0.32]}>
        <meshStandardMaterial color="#2ec44a" emissive="#2ec44a" emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
      <B g={CYL} c="#5a3a22" p={[1.05, 1.2, 0.12]} s={[0.05, 2.4, 0.05]} />
      <mesh material={sign} position={[1.05, 2.3, 0.2]}>
        <planeGeometry args={[1.6, 0.8]} />
      </mesh>
    </group>
  )
}

// ---------- the game table: rock-paper-scissors, the cheat, the flip, and the rematch
function GameTable() {
  const table = useRef()
  const dino = useRef()
  const tiki = useRef()
  const dinoSay = useRef()
  const tikiSay = useRef()
  const ref = useRef()
  const y0 = ground(GAME_TABLE.x, GAME_TABLE.z)
  const dinoParts1 = useMemo(() => dinoParts({ kind: 'tri', skin: '#4fb3c9', accent: '#ffd23f' }), [])
  const tikiParts1 = useMemo(() => monsterParts({ wood: '#c4874f', flower: '#ff4fa3', skirt: true }), [])
  useFrame(({ clock }) => {
    const e = war.t()
    const t = clock.elapsedTime
    // countdown over the table
    let call = null
    if (e >= W.ROCK && e < W.PAPER) call = 'ROCK…'
    else if (e >= W.PAPER && e < W.SCISSORS) call = 'PAPER…'
    else if (e >= W.SCISSORS && e < W.SHOOT) call = 'SCISSORS…'
    else if (e >= W.SHOOT && e < W.SHOOT + 0.9) call = 'SHOOT!'
    ref.current.visible = !!call
    if (call) ref.current.material = textBubble(call, '#2a1d4e')
    // what each player says / shows
    let d = null
    let k = null
    if (e >= 0.3 && e < 1.9) {
      d = 'Game night! 🎲'
      k = 'Let us play! 😇'
    }
    if (e >= W.SHOOT && e < W.CHEAT + 1.6) d = '✊'
    if (e >= W.SHOOT && e < W.TIKI_LATE) k = '…'
    if (e >= W.TIKI_LATE && e < W.TIKI_LATE + 0.5) k = '✋'
    if (e >= W.TIKI_LATE + 0.5 && e < W.CHEAT) k = 'I WIN!! ✋'
    if (e >= W.CHEAT && e < W.FLIP) d = 'YOU WAITED!!! CHEATER!!!'
    if (e >= W.CHEAT + 0.9 && e < W.FLIP + 0.6) k = '…prove it. 😏'
    if (e >= W.FLIP + 0.3 && e < W.MARCH + 1.5) d = 'THIS. MEANS. WAR!!!'
    if (e >= W.HEAP + 2 && e < W.END - 0.3) d = 'Rematch?'
    if (e >= W.HEAP + 3.5 && e < W.END - 0.3) k = '…best 2 out of 3.'
    dinoSay.current.visible = !!d
    if (d) dinoSay.current.material = textBubble(d, '#2ec4a6')
    tikiSay.current.visible = !!k
    if (k) tikiSay.current.material = textBubble(k, '#ff7a3d')
    // the dino flips the table: it tumbles away, then lies upside down until the event ends
    const f = e - W.FLIP
    if (f >= 0 && e < W.END) {
      const u = Math.min(1, f / 1.2)
      table.current.position.set(GAME_TABLE.x + u * 3, y0 + Math.sin(u * Math.PI) * 2.5, GAME_TABLE.z - u * 2)
      table.current.rotation.set(0, 0, u * Math.PI)
    } else {
      table.current.position.set(GAME_TABLE.x, y0, GAME_TABLE.z)
      table.current.rotation.set(0, 0, 0)
    }
    const hop = (ph) => Math.abs(Math.sin(t * 2 + ph)) * 0.05
    dino.current.position.y = y0 + 0.2 + hop(0) + (e >= W.CHEAT && e < W.FLIP + 1 ? Math.abs(Math.sin(t * 12)) * 0.25 : 0)
    tiki.current.position.y = y0 + hop(1)
  })
  return (
    <>
      <group ref={table}>
        <B g={BOX} c="#8a5a34" p={[0, 0.75, 0]} s={[1.6, 0.08, 1.0]} />
        {[[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]].map(([x, z]) => (
          <B key={`${x}${z}`} g={CYL} c="#5a3a22" p={[x, 0.37, z]} s={[0.05, 0.74, 0.05]} />
        ))}
        <B g={BOX} c="#ffffff" p={[-0.3, 0.81, 0.1]} r={[0, 0.4, 0]} s={[0.22, 0.03, 0.3]} />
        <B g={BOX} c="#ff4fa3" p={[0.35, 0.81, -0.15]} r={[0, -0.3, 0]} s={[0.22, 0.03, 0.3]} />
      </group>
      <group ref={dino} position={[GAME_TABLE.x - 1.4, y0 + 0.2, GAME_TABLE.z]} rotation={[0, Math.PI / 2, 0]} scale={1.5}>
        <Parts parts={dinoParts1} />
      </group>
      <group ref={tiki} position={[GAME_TABLE.x + 1.5, y0, GAME_TABLE.z]} rotation={[0, -Math.PI / 2, 0]} scale={1.05}>
        <Parts parts={tikiParts1} />
      </group>
      <sprite ref={ref} position={[GAME_TABLE.x, y0 + 3.2, GAME_TABLE.z]} scale={[2.6, 1.22, 1]} visible={false} />
      <sprite ref={dinoSay} position={[GAME_TABLE.x - 1.6, y0 + 2.6, GAME_TABLE.z]} scale={[2.6, 1.22, 1]} visible={false} />
      <sprite ref={tikiSay} position={[GAME_TABLE.x + 1.7, y0 + 2.7, GAME_TABLE.z]} scale={[2.6, 1.22, 1]} visible={false} />
    </>
  )
}

// ---------- the armies: 100 dinos, 100 tikis, and (as reinforcements) a 60-cat clone cavalry.
// Low-part warriors, all drawn as one instanced mesh per shape. Every warrior's whole battle is a
// function of time: march to its rank, charge, melee, get launched now and then, mega-launch, heap.
const N_DINO = 100
const N_TIKI = 100
const N_CAT = 60
const N_ALL = N_DINO + N_TIKI + N_CAT
// shared with the battle-cry bubbles: [x, y, z] per warrior, and whether it's on the field
export const warriorPos = new Float32Array(N_ALL * 3)
export const warriorOn = new Uint8Array(N_ALL)

// part: [shape, position, rotation, scale, color key, option] (option: weapon/shield/helmet slot)
export const DINO_PARTS = [
  ['sphere', [0, 0.45, 0], 0, [0.3, 0.32, 0.36], 'skin'],
  ['sphere', [0, 0.42, 0.13], 0, [0.22, 0.25, 0.25], 'belly'],
  ['sphere', [0, 0.88, 0.18], 0, [0.22, 0.2, 0.24], 'skin'],
  ['sphere', [0, 0.82, 0.37], 0, [0.16, 0.12, 0.16], 'skin'],
  ['sphere', [-0.09, 0.96, 0.35], 0, 0.065, 'white'],
  ['sphere', [0.09, 0.96, 0.35], 0, 0.065, 'white'],
  ['sphere', [-0.09, 0.96, 0.41], 0, 0.035, 'black'],
  ['sphere', [0.09, 0.96, 0.41], 0, 0.035, 'black'],
  ['cyl', [-0.14, 0.12, 0.02], 0, [0.09, 0.25, 0.09], 'skin'],
  ['cyl', [0.14, 0.12, 0.02], 0, [0.09, 0.25, 0.09], 'skin'],
  ['sphere', [0, 0.36, -0.38], 0, [0.12, 0.12, 0.3], 'skin'],
  ['sphere', [0, 0.3, -0.66], 0, [0.07, 0.07, 0.16], 'skin'],
  ['cone', [0, 0.8, -0.04], [-0.5, 0, 0], [0.06, 0.13, 0.06], 'accent'],
  ['cone', [0, 0.7, -0.24], [-0.7, 0, 0], [0.06, 0.13, 0.06], 'accent'],
  ['cone', [0, 1.1, 0.16], 0, [0.2, 0.24, 0.2], 'silver', 'helmet'],
]
export const TIKI_PARTS = [
  ['cyl', [0, 0.62, 0], 0, [0.34, 1.0, 0.32], 'wood'],
  ['sphere', [0, 1.12, 0], 0, [0.34, 0.16, 0.32], 'wood'],
  ['sphere', [-0.13, 0.84, 0.29], 0, [0.1, 0.11, 0.06], 'white'],
  ['sphere', [0.13, 0.84, 0.29], 0, [0.1, 0.11, 0.06], 'white'],
  ['sphere', [-0.12, 0.83, 0.34], 0, 0.05, 'black'],
  ['sphere', [0.12, 0.83, 0.34], 0, 0.05, 'black'],
  ['box', [-0.13, 0.97, 0.3], [0, 0, -0.3], [0.16, 0.04, 0.04], 'dark'],
  ['box', [0.13, 0.97, 0.3], [0, 0, 0.3], [0.16, 0.04, 0.04], 'dark'],
  ['sphere', [0, 0.52, 0.3], 0, [0.17, 0.08, 0.05], 'mouth'],
  ['box', [0, 0.57, 0.33], 0, [0.2, 0.04, 0.02], 'white'],
  ['cone', [-0.12, 1.42, 0], [0, 0, 0.45], [0.07, 0.42, 0.03], 'leaf'],
  ['cone', [0, 1.48, 0], 0, [0.07, 0.45, 0.03], 'leaf'],
  ['cone', [0.12, 1.42, 0], [0, 0, -0.45], [0.07, 0.42, 0.03], 'leaf'],
  ['cyl', [0, 0.3, 0], 0, [0.37, 0.25, 0.35], 'straw'],
  ['sphere', [-0.14, 0.06, 0.08], 0, [0.11, 0.07, 0.15], 'dark'],
  ['sphere', [0.14, 0.06, 0.08], 0, [0.11, 0.07, 0.15], 'dark'],
]
export const CAT_PARTS = [
  ['sphere', [0, 0.24, -0.02], 0, [0.12, 0.11, 0.2], 'cat'],
  ['sphere', [0, 0.21, 0.08], 0, [0.085, 0.09, 0.1], 'white'],
  ['sphere', [0, 0.42, 0.15], 0, [0.1, 0.09, 0.09], 'cat'],
  ['sphere', [0, 0.385, 0.21], 0, [0.055, 0.042, 0.04], 'white'],
  ['cone', [-0.06, 0.505, 0.15], 0, [0.035, 0.07, 0.025], 'cat'],
  ['cone', [0.06, 0.505, 0.15], 0, [0.035, 0.07, 0.025], 'cat'],
  ['sphere', [0, 0.36, -0.26], 0, [0.03, 0.09, 0.03], 'cat'],
  ['cone', [0, 0.53, 0.14], 0, [0.11, 0.14, 0.11], 'silver'], // knight helmet
  ['cyl', [0.1, 0.3, 0.3], [1.2, 0, 0], [0.012, 0.6, 0.012], 'wood'], // tiny lance
]
// weapons hang off a pivot at the right hand (handle at the origin, pointing up), shields on the left
const WEAPON_PARTS = [
  ['box', [0, 0.55, 0], 0, [0.06, 0.9, 0.02], 'silver', 'sword'],
  ['box', [0, 0.1, 0], 0, [0.24, 0.04, 0.05], 'gold', 'sword'],
  ['cyl', [0, -0.03, 0], 0, [0.03, 0.2, 0.03], 'wood', 'sword'],
  ['cyl', [0, 0.45, 0], 0, [0.025, 1.6, 0.025], 'wood', 'spear'],
  ['cone', [0, 1.3, 0], 0, [0.06, 0.2, 0.06], 'silver', 'spear'],
  ['cyl', [0, 0.35, 0], 0, [0.05, 0.75, 0.05], 'wood', 'club'],
  ['sphere', [0, 0.8, 0], 0, [0.13, 0.19, 0.13], 'clubhead', 'club'],
]
const SHIELD_PARTS = [
  ['cyl', [0, 0, 0], [Math.PI / 2, 0, 0], [0.28, 0.04, 0.28], 'shield', 'shield'],
  ['sphere', [0, 0, 0.03], 0, [0.07, 0.07, 0.05], 'gold', 'shield'],
]
const TYPES = {
  dino: { body: DINO_PARTS, pivot: [-0.36, 0.55, 0.15], shield: [0.36, 0.5, 0.2], scale: 1.35, weapons: true },
  tiki: { body: TIKI_PARTS, pivot: [-0.44, 0.65, 0.15], shield: [0.44, 0.62, 0.22], scale: 1.25, weapons: true },
  cat: { body: CAT_PARTS, pivot: null, shield: null, scale: 2.4, weapons: false },
}

const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const M = (p, r, s) => new THREE.Matrix4().compose(V.set(...p), Q.setFromEuler(r ? E.set(r[0], r[1], r[2], 'XYZ') : E.set(0, 0, 0, 'XYZ')), S.set(...(typeof s === 'number' ? [s, s, s] : s)))
// every warrior type uses the same slot layout: body parts, then (if armed) weapon + shield slots
const slots = (type) => {
  const T = TYPES[type]
  const list = T.body.map(([g, p, r, s, c, opt]) => ({ g, m: M(p, r, s), c, opt, kind: 'body' }))
  if (T.weapons) {
    WEAPON_PARTS.forEach(([g, p, r, s, c, opt]) => list.push({ g, m: M(p, r, s), c, opt, kind: 'weapon' }))
    SHIELD_PARTS.forEach(([g, p, r, s, c, opt]) => list.push({ g, m: M([p[0] + T.shield[0], p[1] + T.shield[1], p[2] + T.shield[2]], r, s), c, opt, kind: 'body' }))
  }
  return list
}
const SLOTS = { dino: slots('dino'), tiki: slots('tiki'), cat: slots('cat') }

function buildWarriors() {
  const r = rand(1066)
  const skins = ['#6cc46a', '#4fb3c9', '#ff8fb0', '#b48be0', '#e6c84f', '#f2a65a', '#5fc9a8', '#7fb2ff', '#8fd14f', '#3fa66b']
  const woods = ['#a0673f', '#c4874f', '#7a4a2c', '#3fb6a8', '#e76f51', '#9b5de5', '#b8935a']
  const out = []
  const flightsFor = (from, to, n, hMin, hMax) => {
    const list = []
    let t = from + r() * 3
    for (let k = 0; k < n && t < to; k++) {
      const dur = 1.4 + r() * 1.2
      const a = r() * Math.PI * 2
      list.push({ at: t, dur, h: hMin + r() * (hMax - hMin), dx: Math.cos(a) * (3 + r() * 9), dz: Math.sin(a) * (3 + r() * 9), spin: [(r() - 0.5) * 14, (r() - 0.5) * 10, (r() - 0.5) * 14] })
      t += dur + 1.5 + r() * ((to - from) / n)
    }
    return list
  }
  const make = (type, i) => {
    const isDino = type === 'dino'
    const isCat = type === 'cat'
    const col = i % 20
    const row = Math.floor(i / 20)
    const x = WAR.x0 + 1 + (col * (WAR.x1 - WAR.x0 - 2)) / 19 + (r() - 0.5) * 0.5
    let rank
    let from
    let marchAt
    if (isDino) {
      rank = [x, WAR.zDino + 3.2 - row * 1.6]
      from = [x + (r() - 0.5) * 4, rank[1] - 9 - r() * 5]
      marchAt = W.MARCH + row * 0.5 + r() * 0.6
    } else if (type === 'tiki') {
      rank = [x, WAR.zTiki - 3.2 + row * 1.6]
      from = [x + (r() - 0.5) * 4, rank[1] + 10 + r() * 5]
      marchAt = W.MARCH + row * 0.5 + r() * 0.6
    } else {
      // the cavalry charges in from behind the tikis when the reinforcements arrive
      rank = [WAR.x0 + 2 + r() * (WAR.x1 - WAR.x0 - 4), WAR.zTiki + 8 + r() * 6]
      from = rank
      marchAt = W.REINFORCE
    }
    const home = [WAR.x0 + 3 + r() * (WAR.x1 - WAR.x0 - 6), WAR.zMid + (isDino ? -2 : 2) + (r() - 0.5) * 14]
    const chargeAt = isCat ? W.REINFORCE + 0.3 + r() * 0.8 : W.CHARGE + r() * 0.5
    const speed = isCat ? 11 + r() * 3 : 7 + r() * 2.5
    const chargeDur = Math.hypot(home[0] - rank[0], home[1] - rank[1]) / speed
    const flights = [
      ...(isCat ? [] : flightsFor(W.CLASH + 1, W.REINFORCE - 2, 2, 5, 13)),
      ...flightsFor(Math.max(W.REINFORCE, chargeAt + chargeDur), W.MEGA - 2.5, isCat ? 3 : 3 + Math.floor(r() * 2), 9, 22),
    ]
    const a = r() * Math.PI * 2
    const megaAt = W.MEGA + r() * 0.4
    const T = TYPES[type]
    const weapon = !T.weapons ? null : isDino ? pick(['sword', 'sword', 'spear', 'spear', 'club'], r) : pick(['spear', 'spear', 'club', 'club', 'sword'], r)
    return {
      type,
      rank,
      from,
      marchAt,
      home,
      chargeAt,
      chargeDur,
      flights,
      wander: [0.3 + r() * 0.6, 0.3 + r() * 0.6, r() * 6],
      swingRate: 7 + r() * 5,
      phase: r() * 6,
      mega: { at: megaAt, h: 18 + r() * 24, dx: Math.cos(a) * (5 + r() * 16), dz: Math.sin(a) * (5 + r() * 12), spin: [(r() - 0.5) * 6, (r() - 0.5) * 5, (r() - 0.5) * 6] },
      opts: { helmet: isDino && r() < 0.35, shield: T.weapons && r() < (isDino ? 0.6 : 0.5), [weapon]: true },
      colors: {
        skin: pick(skins, r),
        belly: '#fff3c4',
        accent: pick(['#ff4fa3', '#ffd23f', '#2ec4a6', '#7a4fd1', '#ff7a3d'], r),
        wood: pick(woods, r),
        leaf: pick(['#3f9b4a', '#7cc95a', '#2f6fd6', '#ff7a3d', '#ffd23f'], r),
        shield: isDino ? pick(['#2f8a4a', '#2f6fd6', '#7a4fd1'], r) : pick(['#c0392b', '#ff7a3d', '#8a5a34'], r),
        clubhead: isDino ? '#6b4426' : '#8a5a34',
        straw: '#d9b25f',
        cat: '#1d1d22',
      },
    }
  }
  for (let i = 0; i < N_DINO; i++) out.push(make('dino', i))
  for (let i = 0; i < N_TIKI; i++) out.push(make('tiki', i))
  for (let i = 0; i < N_CAT; i++) out.push(make('cat', i))
  return out
}
const FIXED = { white: '#ffffff', black: '#111111', dark: '#3a2416', mouth: '#3a1a12', silver: '#c9cdd2', gold: '#d9b45a' }

// where a warrior is at time e: { x, y, z, yaw, pitch, roll, swing, visible }
function poseAt(w, e) {
  const out = { y: 0, pitch: 0, roll: 0, swing: 0.15, visible: e >= w.marchAt && e < W.END - 0.2 }
  const toward = w.type === 'dino' ? 0 : Math.PI // dinos face south (+z), tikis and cats north
  let x
  let z
  let yaw = toward
  const charging = e >= w.chargeAt
  if (!charging) {
    // marching into the ranks
    const u = clamp01((e - w.marchAt) / 4)
    x = w.from[0] + (w.rank[0] - w.from[0]) * u
    z = w.from[1] + (w.rank[1] - w.from[1]) * u
    out.y = u < 1 ? Math.abs(Math.sin(e * 7 + w.phase)) * 0.12 : 0
    out.swing = u < 1 ? 0.2 : Math.sin(e * 2 + w.phase) * 0.15 + 0.2 // shaking weapons at the enemy
  } else if (e < w.chargeAt + w.chargeDur) {
    // CHARGE
    const u = (e - w.chargeAt) / w.chargeDur
    x = w.rank[0] + (w.home[0] - w.rank[0]) * u
    z = w.rank[1] + (w.home[1] - w.rank[1]) * u
    yaw = Math.atan2(w.home[0] - w.rank[0], w.home[1] - w.rank[1])
    out.y = Math.abs(Math.sin(e * 12 + w.phase)) * 0.22
    out.swing = -1.3 // weapons forward
  } else {
    // melee: shuffle around the home spot, swinging
    const [fx, fz, ph] = w.wander
    x = w.home[0] + Math.sin(e * fx + ph) * 2.5
    z = w.home[1] + Math.sin(e * fz + ph * 1.7) * 2.5
    yaw = toward + Math.sin(e * 1.3 + ph) * 0.8
    out.y = Math.abs(Math.sin(e * 6 + w.phase)) * 0.12
    out.swing = Math.sin(e * w.swingRate + w.phase) * 1.1 - 0.4
  }
  // knocked into the air now and then
  for (const f of w.flights) {
    const u = (e - f.at) / f.dur
    if (u >= 0 && u < 1) {
      const lift = Math.sin(u * Math.PI)
      x += f.dx * lift
      z += f.dz * lift
      out.y = f.h * lift
      out.pitch = f.spin[0] * u
      yaw += f.spin[1] * u
      out.roll = f.spin[2] * u
      out.swing = 1.2
      break
    }
  }
  // the mega-explosion launches everyone (slow motion), then they lie in a heap
  if (e >= w.mega.at) {
    const dur = W.HEAP - w.mega.at
    const u = Math.min(1, (e - w.mega.at) / dur)
    const [hx, hz] = [w.home[0] + w.mega.dx, w.home[1] + w.mega.dz]
    const [sx, sz] = [x, z]
    x = sx + (hx - sx) * u
    z = sz + (hz - sz) * u
    if (u < 1) {
      out.y = w.mega.h * Math.sin(u * Math.PI)
      out.pitch = w.mega.spin[0] * u * 4
      yaw += w.mega.spin[1] * u * 4
      out.roll = w.mega.spin[2] * u * 4
    } else {
      x = hx
      z = hz
      out.y = 0
      out.pitch = 0
      out.roll = 1.45 // flat on its side
    }
    out.swing = 0.8
  }
  out.x = x
  out.z = z
  out.yaw = yaw
  return out
}

function Armies() {
  const meshes = useRef({})
  const warriors = useMemo(buildWarriors, [])
  // one instanced mesh per shape for the whole battlefield
  const buckets = useMemo(() => {
    const out = {}
    warriors.forEach((w, i) =>
      SLOTS[w.type].forEach((slot) => {
        ;(out[slot.g] ??= []).push({ i, slot, color: FIXED[slot.c] ?? w.colors[slot.c], show: !slot.opt || !!w.opts[slot.opt] })
      }),
    )
    return Object.entries(out)
  }, [warriors])
  const roots = useMemo(() => warriors.map(() => new THREE.Matrix4()), [warriors])
  const pivots = useMemo(() => warriors.map(() => new THREE.Matrix4()), [warriors])
  const pivotBase = useMemo(() => Object.fromEntries(Object.entries(TYPES).map(([k, T]) => [k, T.pivot && new THREE.Vector3(...T.pivot)])), [])
  const visible = useMemo(() => new Uint8Array(warriors.length), [warriors])
  const tmp = useMemo(() => new THREE.Matrix4(), [])
  const tmp2 = useMemo(() => new THREE.Matrix4(), [])
  const zero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6 }), [])
  const PV = useMemo(() => new THREE.Vector3(), [])
  const PQ = useMemo(() => new THREE.Quaternion(), [])
  const PE = useMemo(() => new THREE.Euler(), [])
  const PS = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    for (const [g, list] of buckets) {
      list.forEach((en, k) => meshes.current[g].setColorAt(k, c.set(en.color)))
      meshes.current[g].instanceColor.needsUpdate = true
    }
  }, [buckets])

  useFrame(() => {
    const e = war.t()
    const on = e >= 0
    warriors.forEach((w, i) => {
      const p = on ? poseAt(w, e) : null
      const vis = !!(p && p.visible)
      visible[i] = vis
      warriorOn[i] = vis
      if (!vis) return
      const y = p.y + ground(p.x, p.z)
      const sc = TYPES[w.type].scale * clamp01((W.END - 0.2 - e) / 0.6) // poof at the very end
      roots[i].compose(PV.set(p.x, y, p.z), PQ.setFromEuler(PE.set(p.pitch, p.yaw, p.roll, 'YXZ')), PS.setScalar(sc))
      warriorPos[i * 3] = p.x
      warriorPos[i * 3 + 1] = y
      warriorPos[i * 3 + 2] = p.z
      const pb = pivotBase[w.type]
      if (pb) pivots[i].compose(pb, PQ.setFromEuler(PE.set(p.swing, 0, 0, 'XYZ')), PS.setScalar(1))
    })
    for (const [g, list] of buckets) {
      const mesh = meshes.current[g]
      list.forEach((en, k) => {
        if (!visible[en.i] || !en.show) return mesh.setMatrixAt(k, zero)
        if (en.slot.kind === 'weapon') mesh.setMatrixAt(k, tmp.multiplyMatrices(roots[en.i], tmp2.multiplyMatrices(pivots[en.i], en.slot.m)))
        else mesh.setMatrixAt(k, tmp.multiplyMatrices(roots[en.i], en.slot.m))
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return buckets.map(([g, list]) => <instancedMesh key={g} ref={(el) => (meshes.current[g] = el)} args={[GEO[g], mat, list.length]} frustumCulled={false} />)
}

// ---------- reinforcements: two giant T. rexes stomp in from the north, a giant tiki rises from the ground
const GIANTS = [
  { kind: 'rex', from: [-40, -52], to: [-20, -30], scale: 6, skin: '#3fa66b', line: 'ROOOOAAARRR!!!' },
  { kind: 'rex', from: [10, -54], to: [-4, -34], scale: 5.5, skin: '#b48be0', line: 'DINO POWER!!!' },
  { kind: 'tiki', from: [-12, -12], to: [-12, -14], scale: 4.2, wood: '#e76f51', line: 'TIKI SMAAASH!!!' },
]
function Giants() {
  const refs = useRef([])
  const says = useRef([])
  const parts = useMemo(
    () => GIANTS.map((gi) => (gi.kind === 'rex' ? dinoParts({ kind: 'rex', skin: gi.skin, accent: '#e8462e' }) : monsterParts({ wood: gi.wood, leaf: '#ffd23f', flower: '#ffffff' }))),
    [],
  )
  useFrame(({ clock }) => {
    const e = war.t()
    const t = clock.elapsedTime
    GIANTS.forEach((gi, i) => {
      const g = refs.current[i]
      if (!g) return
      const on = e >= W.REINFORCE && e < W.END - 0.2
      g.visible = on
      says.current[i].visible = on && e < W.MEGA && (e - W.REINFORCE + i * 2.3) % 7 < 3
      if (!on) return
      const u = clamp01((e - W.REINFORCE) / 4.5)
      let x = gi.from[0] + (gi.to[0] - gi.from[0]) * u
      let z = gi.from[1] + (gi.to[1] - gi.from[1]) * u
      let y = ground(x, z)
      let pitch = 0
      let roll = Math.sin(t * 3 + i) * 0.08 // stomp stomp
      if (gi.kind === 'tiki') y -= (1 - u) * 9 // rises out of the ground
      if (u >= 1) {
        x += Math.sin(t * 0.7 + i) * 3
        z += Math.cos(t * 0.5 + i) * 2
        y += Math.abs(Math.sin(t * 2.5 + i)) * 0.8
      }
      // even the giants get launched by the mega-explosion
      if (e >= W.MEGA) {
        const v = clamp01((e - W.MEGA) / (W.HEAP - W.MEGA))
        y += Math.sin(v * Math.PI) * 14
        pitch = v * 4
        if (v >= 1) {
          pitch = 0
          roll = 1.45
        }
      }
      g.position.set(x, y, z)
      g.rotation.set(pitch, gi.kind === 'rex' ? 0.3 : Math.PI, roll, 'YXZ')
      g.scale.setScalar(gi.scale * clamp01((W.END - 0.2 - e) / 0.6))
      says.current[i].position.set(x, y + gi.scale * 1.15 + 1, z)
    })
  })
  return GIANTS.map((gi, i) => (
    <group key={i}>
      <group ref={(el) => (refs.current[i] = el)} visible={false}>
        <Parts parts={parts[i]} />
      </group>
      <sprite ref={(el) => (says.current[i] = el)} material={textBubble(gi.line, '#d62839')} scale={[4.5, 2.1, 1]} visible={false} />
    </group>
  ))
}

// ---------- cannons, cannonballs, explosions (fireball, smoke, debris)
const MAX_BOOMS = 24
function Cannons() {
  const barrels = useRef([])
  const flashes = useRef([])
  const balls = useRef()
  const fire = useRef()
  const smoke = useRef()
  const debris = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const muzzle = (c) => {
    const dir = c.side === 'dino' ? 1 : -1
    return [c.x, ground(c.x, c.z) + 1.3, c.z + dir * 1.2]
  }
  useFrame(() => {
    const e = war.t()
    const show = e >= W.MARCH && e < W.END - 0.2
    CANNONS.forEach((c, i) => {
      if (barrels.current[i]) barrels.current[i].parent.visible = show
    })
    let nb = 0
    let nf = 0
    const recoil = new Array(CANNONS.length).fill(0)
    if (e >= 0) {
      for (const s of CANNON_SHOTS) {
        const a = e - s.at
        if (a < -0.1 || a > FLIGHT + 1.2) continue
        if (a >= 0 && a < 0.25) recoil[s.cannon] = 1 - a / 0.25
        const c = CANNONS[s.cannon]
        const [mx, my, mz] = muzzle(c)
        if (a >= 0 && a < FLIGHT && nb < MAX_BOOMS) {
          // the ball in flight
          const u = a / FLIGHT
          const gy = ground(s.to[0], s.to[1])
          tmp.position.set(mx + (s.to[0] - mx) * u, my + (gy - my) * u + Math.sin(u * Math.PI) * 11, mz + (s.to[1] - mz) * u)
          tmp.scale.setScalar(0.32)
          tmp.rotation.set(0, 0, 0)
          tmp.updateMatrix()
          balls.current.setMatrixAt(nb++, tmp.matrix)
        } else if (a >= FLIGHT && nf < MAX_BOOMS) {
          // boom: fireball, smoke and flying debris
          const b = a - FLIGHT
          const gy = ground(s.to[0], s.to[1])
          tmp.position.set(s.to[0], gy + 0.8 + b * 1.5, s.to[1])
          tmp.scale.setScalar(Math.max(0.001, (0.6 + b * 4) * (1 - b / 1.2)))
          tmp.rotation.set(0, 0, 0)
          tmp.updateMatrix()
          fire.current.setMatrixAt(nf, tmp.matrix)
          tmp.position.set(s.to[0], gy + 1.5 + b * 3, s.to[1])
          tmp.scale.setScalar(1 + b * 2.5)
          tmp.updateMatrix()
          smoke.current.setMatrixAt(nf, tmp.matrix)
          for (let k = 0; k < 6; k++) {
            const ang = (k / 6) * Math.PI * 2 + s.at
            tmp.position.set(s.to[0] + Math.cos(ang) * b * 6, gy + 7 * b - 9 * b * b + 0.3, s.to[1] + Math.sin(ang) * b * 6)
            tmp.rotation.set(b * 9, b * 7, 0)
            tmp.scale.setScalar(b < 1 ? 0.25 : 0)
            tmp.updateMatrix()
            debris.current.setMatrixAt(nf * 6 + k, tmp.matrix)
          }
          nf++
        }
      }
    }
    tmp.scale.setScalar(0)
    tmp.updateMatrix()
    for (let k = nb; k < MAX_BOOMS; k++) balls.current.setMatrixAt(k, tmp.matrix)
    for (let k = nf; k < MAX_BOOMS; k++) {
      fire.current.setMatrixAt(k, tmp.matrix)
      smoke.current.setMatrixAt(k, tmp.matrix)
      for (let j = 0; j < 6; j++) debris.current.setMatrixAt(k * 6 + j, tmp.matrix)
    }
    for (const r of [balls, fire, smoke, debris]) r.current.instanceMatrix.needsUpdate = true
    barrels.current.forEach((b, i) => {
      if (!b) return
      b.position.z = -recoil[i] * 0.4
      flashes.current[i].visible = recoil[i] > 0.6
    })
  })
  return (
    <>
      {CANNONS.map((c, i) => (
        <group key={i} position={[c.x, ground(c.x, c.z), c.z]} rotation={[0, c.side === 'dino' ? 0 : Math.PI, 0]} visible={false}>
          <B g={BOX} c="#6b4426" p={[0, 0.45, -0.2]} s={[0.9, 0.35, 1.4]} />
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={TORUS} material={m('#3a2416')} position={[0.55 * sx, 0.45, -0.2]} rotation={[0, Math.PI / 2, 0]} scale={0.42} />
          ))}
          <group ref={(el) => (barrels.current[i] = el)}>
            <B g={CYL} c="#1d1d22" o={{ metalness: 0.6, roughness: 0.35 }} p={[0, 0.95, 0.2]} r={[Math.PI / 2 - 0.45, 0, 0]} s={[0.24, 1.6, 0.24]} />
          </group>
          <mesh ref={(el) => (flashes.current[i] = el)} geometry={SPH} material={m('#ffd23f', { emissive: '#ff9a2e', emissiveIntensity: 2 })} position={[0, 1.3, 1.1]} scale={0.6} visible={false} />
        </group>
      ))}
      <instancedMesh ref={balls} args={[SPH, m('#1d1d22', { metalness: 0.5 }), MAX_BOOMS]} frustumCulled={false} />
      <instancedMesh ref={fire} args={[SPH, m('#ff8a1a', { emissive: '#ff5a1f', emissiveIntensity: 1.6 }), MAX_BOOMS]} frustumCulled={false} />
      <instancedMesh ref={smoke} args={[SPH, m('#4a4448', { transparent: true, opacity: 0.55, depthWrite: false }), MAX_BOOMS]} frustumCulled={false} />
      <instancedMesh ref={debris} args={[BOX, m('#8a6a45'), MAX_BOOMS * 6]} frustumCulled={false} />
    </>
  )
}

// ---------- war banners behind each army
function Flags() {
  const groups = useRef([])
  const flags = useMemo(() => {
    const make = (bg, emoji, label) =>
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        map: canvasTex(512, 320, (g, w, h) => {
          g.fillStyle = bg
          g.fillRect(0, 0, w, h)
          g.textAlign = 'center'
          g.font = '150px system-ui, sans-serif'
          g.fillText(emoji, w / 2, 170)
          g.fillStyle = '#ffffff'
          g.font = 'bold 60px "Arial Black", Impact, sans-serif'
          g.fillText(label, w / 2, 280)
        }),
      })
    return { dino: make('#2f8a4a', '🦖', 'TEAM SWAMP'), tiki: make('#c0392b', '🗿', 'TEAM TIKI') }
  }, [])
  const spots = useMemo(
    () => [
      ...[-24, -12, 2].map((x) => ({ side: 'dino', x, z: WAR.zDino - 4 })),
      ...[-24, -10, 4].map((x) => ({ side: 'tiki', x, z: WAR.zTiki + 3.5 })),
    ],
    [],
  )
  useFrame(({ clock }) => {
    const e = war.t()
    groups.current.forEach((g, i) => {
      if (!g) return
      g.visible = e >= W.MARCH && e < W.MEGA
      g.children[1].rotation.y = Math.sin(clock.elapsedTime * 3 + i) * 0.25
    })
  })
  return spots.map((s, i) => (
    <group key={i} ref={(el) => (groups.current[i] = el)} position={[s.x, ground(s.x, s.z), s.z]} visible={false}>
      <B g={CYL} c="#5a3a22" p={[0, 2.5, 0]} s={[0.06, 5, 0.06]} />
      <mesh material={flags[s.side]} position={[0.8, 4.3, 0]}>
        <planeGeometry args={[1.6, 1]} />
      </mesh>
    </group>
  ))
}

// ---------- dust clouds over the melee
function Dust() {
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const puffs = useMemo(() => {
    const r = rand(77)
    return Array.from({ length: 30 }, () => ({ x: WAR.x0 + 3 + r() * (WAR.x1 - WAR.x0 - 6), z: WAR.zMid + (r() - 0.5) * 16, p: 2 + r() * 2, o: r() * 4 }))
  }, [])
  useFrame(() => {
    const e = war.t()
    const on = e >= W.CLASH - 0.3 && e < W.HEAP + 2
    ref.current.visible = on
    if (!on) return
    puffs.forEach((d, i) => {
      const u = ((e + d.o) % d.p) / d.p
      tmp.position.set(d.x, ground(d.x, d.z) + 0.5 + u * 2.5, d.z)
      tmp.scale.setScalar((1 + u * 2.5) * (e > W.REINFORCE ? 1.4 : 1))
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[SPH, m('#d9c08a', { transparent: true, opacity: 0.35, depthWrite: false }), puffs.length]} frustumCulled={false} visible={false} />
}

// ---------- battle cries: a handful of speech bubbles hop between random warriors
const CRIES = {
  march: ['FOR THE SWAMP!!!', 'FOR THE TIKI!!!', 'He WAITED!', 'Cheaters never win!', 'We did NOT cheat! (we did)', 'This is about a GAME?!'],
  battle: [
    'THIS IS FOR CHEATING!', 'NOT THE FACE!', 'MY SPEAR!', "I'M FLYING!", 'WHO BROUGHT A CANNON?!', 'Is this about rock paper scissors?',
    'I just came for snacks', 'RETREAT! no wait, CHARGE!', 'BEST. WAR. EVER.', 'OOF!', 'I regret NOTHING!', 'Rock beats EVERYTHING!',
  ],
  chaos: ['GIANT T. REX?!', 'IS THAT A CAT ON A HORSE?! wait no horse', 'TIKI SMASH?!', 'THE CATS ARE HERE!!!', 'Meow means CHARGE!', 'This escalated QUICKLY'],
  heap: ['ow.', '…rematch?', 'who won?', '@_@', 'my everything hurts', 'worth it'],
}
const N_CRIES = 14
function BattleCries() {
  const sprites = useRef([])
  const assigned = useRef([])
  useFrame(() => {
    const e = war.t()
    const pool = e < W.CHARGE ? CRIES.march : e < W.REINFORCE ? CRIES.battle : e < W.MEGA ? [...CRIES.battle, ...CRIES.chaos] : CRIES.heap
    const active = e >= W.MARCH + 3 && e < W.END - 0.5 && !(e >= W.MEGA && e < W.HEAP + 0.5)
    sprites.current.forEach((sp, k) => {
      if (!sp) return
      const slot = Math.floor((e + k * 0.37) / 2.6)
      const key = `${slot}-${k}`
      if (!active || (e + k * 0.37) % 2.6 > 2) {
        sp.visible = false
        return
      }
      if (assigned.current[k]?.key !== key) {
        const r = rand(slot * 977 + k * 131)
        let i = Math.floor(r() * N_ALL)
        for (let tries = 0; tries < 8 && !warriorOn[i]; tries++) i = Math.floor(r() * N_ALL)
        assigned.current[k] = { key, i }
        sp.material = textBubble(pool[Math.floor(r() * pool.length)], e >= W.REINFORCE && e < W.MEGA ? '#d62839' : '#2a1d4e')
      }
      const i = assigned.current[k].i
      sp.visible = !!warriorOn[i]
      sp.position.set(warriorPos[i * 3], warriorPos[i * 3 + 1] + 2.6, warriorPos[i * 3 + 2])
    })
  })
  return Array.from({ length: N_CRIES }, (_, k) => <sprite key={k} ref={(el) => (sprites.current[k] = el)} scale={[2.6, 1.22, 1]} visible={false} />)
}
