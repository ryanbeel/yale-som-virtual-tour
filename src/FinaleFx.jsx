import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RyanJr } from './Allison.jsx'
import { textBubble } from './Concert.jsx'
import { Parts, dinoParts, monsterParts } from './TikiParty.jsx'
import { CAT_PARTS, DINO_PARTS, TIKI_PARTS } from './War.jsx'
import {
  BEAT, CANNONS_F, CANNON_FLIGHT, CLONE_LAUNCH, F, FALL, LIGHTNING_F, METEORS, N_CLONES_F, SHOTS_F, SPACE_Y,
  TORNADO, finale, smooth, stagePoint, tornadoAt, waveZ, zeroG,
} from './finale.js'
import { CRATER, MACHINE, NORTH_GIANT, ROYAL_BOX, ROYAL_STAGE, SHORE, finaleLive, heightAt } from './island.js'

// THE FINALE's crowd and effects (the named characters, the king, the stage and the buttons are in
// Finale.jsx). <FinaleFx /> lives inside the island's lift group (it flies to space with the island);
// <FinaleSky /> stays behind in the world (fire rain, launch smoke, the splash, Earth, a ringed planet).

const SPH = new THREE.SphereGeometry(1, 12, 8)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12)
const CONE = new THREE.ConeGeometry(1, 1, 12)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const RING = new THREE.RingGeometry(0.85, 1, 64)
const TORUS = new THREE.TorusGeometry(1, 0.22, 6, 16)
const GEO = { sphere: SPH, cyl: CYL, cone: CONE, box: BOX }
const COLORS = ['#ff4fa3', '#ffd23f', '#2ec4a6', '#7a4fd1', '#ff7a3d', '#4fb3ff', '#ffffff']

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }))
  return mats.get(k)
}
const glow = (color, o = {}) => {
  const k = 'glow' + color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...o }))
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
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const on = (e, a, b) => e >= a && e < b

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function FinaleFx() {
  return (
    <>
      <Crowd />
      <CrowdCries />
      <Giants />
      <Meteors />
      <Lightning />
      <Fireworks />
      <GoldDust />
      <NorthGiant />
      <Tsunami />
      <Sharknado />
      <Cannons />
      <CloneOverload />
      <Rocketry />
      <Parachute />
      <SpaceGiant />
    </>
  )
}

// ---------- the crowd: 70 dinos (in party hats), 70 tikis and 40 cat knights march in with the parade;
// 60 clones get shot out of the Clone-O-Matic in the chaos. Instanced, like the war armies.
const HAT_DINO = DINO_PARTS.map((p) => (p[5] === 'helmet' ? ['cone', [0, 1.16, 0.15], [-0.2, 0, 0], [0.11, 0.32, 0.11], 'hat'] : p)).concat([['sphere', [0, 1.33, 0.1], 0, 0.05, 'white']])
const TYPES = {
  dino: { parts: HAT_DINO, scale: 1.35 },
  tiki: { parts: TIKI_PARTS, scale: 1.25 },
  knight: { parts: CAT_PARTS, scale: 2.4 },
  clone: { parts: CAT_PARTS.slice(0, 7), scale: 2.4 },
}
const V = new THREE.Vector3()
const S3 = new THREE.Vector3()
const Q = new THREE.Quaternion()
const EU = new THREE.Euler()
const M = (p, r, s) => new THREE.Matrix4().compose(V.set(...p), Q.setFromEuler(r ? EU.set(r[0], r[1], r[2], 'XYZ') : EU.set(0, 0, 0)), S3.set(...(typeof s === 'number' ? [s, s, s] : s)))
const SLOTS = Object.fromEntries(Object.entries(TYPES).map(([k, T]) => [k, T.parts.map(([g, p, r, s, c]) => ({ g, m: M(p, r, s), c }))]))
const FIXED = { white: '#ffffff', black: '#111111', dark: '#3a2416', mouth: '#3a1a12', silver: '#c9cdd2', gold: '#d9b45a', straw: '#d9b25f', cat: '#1d1d22', belly: '#fff3c4' }
const N_CROWD = 70 + 70 + 40 + N_CLONES_F
export const crowdPos = new Float32Array(N_CROWD * 3)
export const crowdOn = new Uint8Array(N_CROWD)
const MACH = [MACHINE.x, MACHINE.z - 0.5]
const STAGE_C = stagePoint(0, -2)

function buildCrowd() {
  const r = rand(2026)
  // a jittered grid filling the ground between the stage and the Royal Box
  const spots = []
  for (let i = 0; i < 24; i++) for (let j = 0; j < 10; j++) spots.push([-6 + (i + 0.5) * 1.5 + (r() - 0.5) * 0.7, -15.5 + (j + 0.5) * 1.65 + (r() - 0.5) * 0.7])
  for (let i = spots.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1))
    ;[spots[i], spots[k]] = [spots[k], spots[i]]
  }
  const skins = ['#6cc46a', '#4fb3c9', '#ff8fb0', '#b48be0', '#e6c84f', '#f2a65a', '#5fc9a8', '#7fb2ff', '#8fd14f', '#3fa66b']
  const woods = ['#a0673f', '#c4874f', '#7a4a2c', '#3fb6a8', '#e76f51', '#9b5de5', '#b8935a']
  const types = [...Array(70).fill('dino'), ...Array(70).fill('tiki'), ...Array(40).fill('knight'), ...Array(N_CLONES_F).fill('clone')]
  let clone = 0
  return types.map((type, i) => {
    const spot = spots[i]
    const start = [-54 + r() * 6, spot[1] + (r() - 0.5) * 6]
    const marchAt = F.PARADE + 1.5 + r() * 4.5
    const arrive = marchAt + Math.hypot(spot[0] - start[0], spot[1] - start[1]) / (7.5 + r() * 1.5)
    const a = r() * Math.PI * 2
    const flights = []
    for (let t = F.CHAOS + 0.3 + r() * 1.5; t < F.SNEEZE - 1.6; t += 1.8 + r() * 2.5) flights.push({ at: t, dur: 1.2 + r() * 0.8, h: 3 + r() * 7, spin: (r() - 0.5) * 14 })
    return {
      type,
      spot,
      start,
      marchAt: type === 'clone' ? CLONE_LAUNCH(clone) : marchAt,
      arrive: type === 'clone' ? CLONE_LAUNCH(clone++) + 1.5 : arrive,
      ph: r() * 6,
      seed: r(),
      run: [0.6 + r() * 0.8, 0.6 + r() * 0.8],
      flights,
      sneeze: { h: 9 + r() * 16, dx: (r() - 0.5) * 10, dz: 4 + r() * 12, dur: 1.5 + r() * 0.6, spin: [(r() - 0.5) * 12, (r() - 0.5) * 10, (r() - 0.5) * 12] },
      tornado: type !== 'clone' && r() < 0.09 ? { at: TORNADO.on + 0.5 + r() * 4, r: 2 + r() * 4, h: 3 + r() * 16, w: 2 + r() * 2 } : null,
      float: { h: 2 + r() * 11, spin: [(r() - 0.5) * 0.9, (r() - 0.5) * 0.8, (r() - 0.5) * 0.9], dx: Math.cos(a) * 3, dz: Math.sin(a) * 3 },
      colors: {
        skin: pick(skins, r),
        accent: pick(['#ff4fa3', '#ffd23f', '#2ec4a6', '#7a4fd1', '#ff7a3d'], r),
        hat: pick(COLORS.slice(0, 6), r),
        wood: pick(woods, r),
        leaf: pick(['#3f9b4a', '#7cc95a', '#2f6fd6', '#ff7a3d', '#ffd23f'], r),
      },
    }
  })
}

const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z)
// where a crowd member is at time e (island-local): { x, y (above ground), z, yaw, pitch, roll, squash, vis }
function crowdPose(c, e, o) {
  o.vis = e >= c.marchAt && e < F.END - 0.05
  o.pitch = 0
  o.roll = 0
  o.squash = 1
  o.y = 0
  if (!o.vis) return o
  let x = c.spot[0]
  let z = c.spot[1]
  let yaw = face(x, z, STAGE_C[0], STAGE_C[1])
  if (e < c.arrive) {
    if (c.type === 'clone') {
      // shot out of the overloaded Clone-O-Matic in a big arc
      const u = (e - c.marchAt) / 1.5
      o.x = MACH[0] + (x - MACH[0]) * u
      o.z = MACH[1] + (z - MACH[1]) * u
      o.y = 4.6 * (1 - u) + Math.sin(u * Math.PI) * 13
      o.pitch = u * 9
      o.yaw = u * 5
      return o
    }
    // marching in with the parade
    const u = (e - c.marchAt) / (c.arrive - c.marchAt)
    x = c.start[0] + (x - c.start[0]) * u
    z = c.start[1] + (z - c.start[1]) * u
    yaw = face(c.start[0], c.start[1], c.spot[0], c.spot[1])
    o.y = Math.abs(Math.sin(e * 9 + c.ph)) * 0.15
  } else if (e < F.SHOW) {
    o.y = Math.abs(Math.sin(e * 4 + c.ph)) * 0.12 // cheering for the king
  } else if (e < F.DROP) {
    const beat = (e - F.SHOW) / BEAT
    o.y = Math.abs(Math.sin(beat * Math.PI)) * 0.25
    yaw += Math.sin(beat * Math.PI * 0.5 + c.ph) * 0.3
  } else if (e < F.CHAOS) {
    // THE DROP: jumping on every beat, and the wave rolling across the crowd
    const beat = (e - F.SHOW) / BEAT
    o.y = Math.abs(Math.sin(beat * Math.PI)) * (0.5 + c.seed * 0.9)
    const w = Math.sin(x * 0.3 - (e - F.DROP) * 7)
    if (w > 0) o.y += w ** 6 * 2.6
    if (c.seed > 0.82) yaw += (e - F.DROP) * 6 // a few spin like tops
  } else {
    // chaos: run around in a panic, get launched now and then
    if (e < F.LIFTOFF) {
      x += Math.sin(e * c.run[0] * 2 + c.ph) * 3.2
      z += Math.sin(e * c.run[1] * 2 + c.ph * 1.7) * 3.2
      yaw = e * 2 + c.ph
      o.y = Math.abs(Math.sin(e * 11 + c.ph)) * 0.2
      for (const f of c.flights) {
        const u = (e - f.at) / f.dur
        if (u >= 0 && u < 1) {
          o.y = f.h * Math.sin(u * Math.PI)
          o.pitch = f.spin * u
          break
        }
      }
    }
    // ACHOO! everyone flies south and lands a few meters away (and stays there)
    const s = c.sneeze
    const u = (e - F.SNEEZE - 0.15 - (c.spot[1] + 20) * 0.01) / s.dur
    if (u >= 0) {
      const k = Math.min(1, u)
      x += s.dx * k
      z += s.dz * k
      if (u < 1) {
        o.y = s.h * Math.sin(u * Math.PI)
        o.pitch = s.spin[0] * u
        yaw += s.spin[1] * u
        o.roll = s.spin[2] * u
      }
    }
    // the tsunami: surf's up
    const wz = waveZ(e)
    if (wz != null && Math.abs(z - wz) < 6) o.y = Math.max(o.y, 5.5 * (1 - Math.abs(z - wz) / 6))
    // a few get sucked into the sharknado
    const tw = c.tornado
    if (tw && e >= tw.at && e < TORNADO.off - 0.5) {
      const T = tornadoAt(e)
      const a = (e - tw.at) * tw.w + c.ph
      const k = Math.min(1, (e - tw.at) / 0.8)
      x += (T.x + Math.cos(a) * tw.r - x) * k
      z += (T.z + Math.sin(a) * tw.r - z) * k
      o.y = tw.h * k + Math.sin(e * 3 + c.ph)
      o.pitch = e * 5
      o.roll = e * 3
    }
    if (e >= F.LIFTOFF && e < F.SPACE) {
      o.squash = 0.72 + Math.sin(e * 40 + c.ph) * 0.05 // squished by the g-force
      o.y = 0
    }
    // zero gravity
    const g = zeroG(e)
    if (g > 0) {
      const ft = e - F.SPACE
      o.y += g * c.float.h
      x += g * (c.float.dx + Math.sin(ft * 0.5 + c.ph) * 1.5)
      z += g * c.float.dz
      o.pitch += g * ft * c.float.spin[0] * 3
      yaw += g * ft * c.float.spin[1] * 3
      o.roll += g * ft * c.float.spin[2] * 3
    }
    // the splash bounce, then cheering at the Royal Box
    const sa = e - F.SPLASH
    if (sa >= 0 && sa < 0.8) o.y += Math.sin((sa / 0.8) * Math.PI) * 1.4
    if (sa >= 1) {
      o.y = Math.abs(Math.sin(e * 6 + c.ph)) * 0.5
      yaw = face(x, z, ROYAL_BOX.x, ROYAL_BOX.z)
    }
    // the Royal Box comes down after the splash: everyone steps back to make room for it
    if (sa >= 0) {
      const dx = x - ROYAL_BOX.x
      const dz = z - ROYAL_BOX.z
      const d = Math.hypot(dx, dz) || 1
      const R = ROYAL_BOX.r + 1.6 + c.seed * 2
      if (d < R) {
        const k = smooth((sa - 0.5) / 1.5)
        x += (dx / d) * (R - d) * k
        z += (dz / d) * (R - d) * k
      }
    }
  }
  o.x = x
  o.z = z
  o.yaw = yaw
  return o
}

function Crowd() {
  const meshes = useRef({})
  const crowd = useMemo(buildCrowd, [])
  const buckets = useMemo(() => {
    const out = {}
    crowd.forEach((c, i) => SLOTS[c.type].forEach((slot) => (out[slot.g] ??= []).push({ i, slot, color: FIXED[slot.c] ?? c.colors[slot.c] ?? '#ff00ff' })))
    return Object.entries(out)
  }, [crowd])
  const roots = useMemo(() => crowd.map(() => new THREE.Matrix4()), [crowd])
  const visible = useMemo(() => new Uint8Array(crowd.length), [crowd])
  const tmp = useMemo(() => new THREE.Matrix4(), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6 }), [])
  const pose = useMemo(() => ({}), [])
  const PV = useMemo(() => new THREE.Vector3(), [])
  const PQ = useMemo(() => new THREE.Quaternion(), [])
  const PE = useMemo(() => new THREE.Euler(), [])
  const PS = useMemo(() => new THREE.Vector3(), [])
  useLayoutEffect(() => {
    const c = new THREE.Color()
    for (const [g, list] of buckets) {
      list.forEach((en, k) => meshes.current[g].setColorAt(k, c.set(en.color)))
      meshes.current[g].instanceColor.needsUpdate = true
    }
  }, [buckets])
  useFrame(() => {
    const e = finale.t()
    const any = e >= 0
    crowd.forEach((c, i) => {
      const p = any ? crowdPose(c, e, pose) : null
      const vis = !!(p && p.vis)
      visible[i] = vis
      crowdOn[i] = vis
      if (!vis) return
      const y = p.y + ground(p.x, p.z)
      const sc = TYPES[c.type].scale * clamp01((F.END - 0.05 - e) / 0.6)
      roots[i].compose(PV.set(p.x, y, p.z), PQ.setFromEuler(PE.set(p.pitch, p.yaw, p.roll, 'YXZ')), PS.set(sc, sc * p.squash, sc))
      crowdPos[i * 3] = p.x
      crowdPos[i * 3 + 1] = y
      crowdPos[i * 3 + 2] = p.z
    })
    for (const [g, list] of buckets) {
      const mesh = meshes.current[g]
      mesh.visible = any
      if (!any) continue
      list.forEach((en, k) => mesh.setMatrixAt(k, visible[en.i] ? tmp.multiplyMatrices(roots[en.i], en.slot.m) : ZERO))
      mesh.instanceMatrix.needsUpdate = true
    }
  })
  return buckets.map(([g, list]) => <instancedMesh key={g} ref={(el) => (meshes.current[g] = el)} args={[GEO[g], mat, list.length]} frustumCulled={false} visible={false} />)
}

// ---------- what the crowd is shouting (a few bubbles hop between random members)
const CRIES = {
  parade: ['ALL HAIL THE KING!', 'Long live Ryan Jr.!', 'Peace! (for now)', 'We are friends now!', 'Is that a CROWN?!', 'Kneel! KNEEL!', 'I brought tuna for the king'],
  show: ['BEST. CONCERT. EVER!', 'ROSE!!! ROSE!!!', 'Is that the SHARK on guitar?!', 'DJ ZAMAN!!!', 'Schott is conducting US?!', 'Allison is DRUMMING again!', 'I can see my house from here'],
  drop: ['DROP IT!!!', 'THE WAVE!!!', 'I CAN FEEL THE BASS', 'MY TAIL IS DANCING', 'VOLCANO MOSH PIT!', 'Turn it up to MAGMA!'],
  chaos: ['SHARKNADO?!', 'WHY IS IT RAINING CATS', 'A GIANT RYAN JR.?!', 'Who fired the cannon?!', 'TSUNAMI!!!', 'This escalated QUICKLY', 'RUN!!! (to the snacks)'],
  space: ['WHEEEEE!', "I'M FLOATING!", 'Is this allowed?!', 'Space snacks!', 'Houston, we have a cat-astrophe', 'I can see Earth!', 'zero gravity, zero problems'],
  end: ['…again! AGAIN!', 'best day ever', 'my everything is spinning', 'long live the king!', 'what did I just watch?!', 'worth it'],
}
const N_CRIES = 12
const cryColor = (pool) => (pool === CRIES.chaos ? '#d62839' : pool === CRIES.space ? '#4f6fff' : '#7a4fd1')
// every crowd line, made up front (so a new bubble never stalls the show)
export const crowdBubbles = () => Object.values(CRIES).flatMap((pool) => pool.map((text) => textBubble(text, cryColor(pool))))
function CrowdCries() {
  const sprites = useRef([])
  const assigned = useRef([])
  useFrame(() => {
    const e = finale.t()
    const pool = e < F.SHOW ? CRIES.parade : e < F.DROP ? CRIES.show : e < F.CHAOS ? CRIES.drop : e < F.LIFTOFF ? CRIES.chaos : e < F.CHUTE ? CRIES.space : CRIES.end
    const active = e >= F.PARADE + 4 && e < F.END - 0.6 && !on(e, F.LIFTOFF, F.SPACE)
    sprites.current.forEach((sp, k) => {
      if (!sp) return
      const slot = Math.floor((e + k * 0.41) / 2.8)
      if (!active || (e + k * 0.41) % 2.8 > 2.1) {
        sp.visible = false
        return
      }
      const key = `${slot}-${k}`
      if (assigned.current[k]?.key !== key) {
        const r = rand(slot * 977 + k * 131)
        let i = Math.floor(r() * N_CROWD)
        for (let tries = 0; tries < 10 && !crowdOn[i]; tries++) i = Math.floor(r() * N_CROWD)
        assigned.current[k] = { key, i }
        sp.material = textBubble(pool[Math.floor(r() * pool.length)], cryColor(pool))
      }
      const i = assigned.current[k].i
      sp.visible = !!crowdOn[i]
      sp.position.set(crowdPos[i * 3], crowdPos[i * 3 + 1] + 2.8, crowdPos[i * 3 + 2])
    })
  })
  return Array.from({ length: N_CRIES }, (_, k) => <sprite key={k} ref={(el) => (sprites.current[k] = el)} scale={[2.8, 1.3, 1]} visible={false} />)
}

// ---------- the war's giants march in with the parade and stand guard (and dance) by the crowd
const GIANTS = [
  { kind: 'rex', from: [-60, -26], to: [-9, -22], scale: 5, skin: '#3fa66b', line: 'ROAR! (respectfully)' },
  { kind: 'rex', from: [-62, -8], to: [33, -6], scale: 4.6, skin: '#b48be0', line: 'ALL HAIL!!!' },
  { kind: 'tiki', from: [-58, 4], to: [-8, 0], scale: 3.6, wood: '#e76f51', line: 'TIKI PARTY!!!' },
]
function Giants() {
  const refs = useRef([])
  const says = useRef([])
  const parts = useMemo(() => GIANTS.map((g) => (g.kind === 'rex' ? dinoParts({ kind: 'rex', skin: g.skin, accent: '#ffd23f' }) : monsterParts({ wood: g.wood, leaf: '#ffd23f', flower: '#ffffff' }))), [])
  useFrame(({ clock }) => {
    const e = finale.t()
    const t = clock.elapsedTime
    GIANTS.forEach((gi, i) => {
      const g = refs.current[i]
      if (!g) return
      const vis = e >= F.PARADE + 3 && e < F.END - 0.05
      g.visible = vis
      says.current[i].visible = vis && e > F.PARADE + 8 && (e + i * 2.3) % 8 < 2.5 && !on(e, F.LIFTOFF, F.SPACE)
      if (!vis) return
      const u = smooth((e - F.PARADE - 3) / 9)
      let x = gi.from[0] + (gi.to[0] - gi.from[0]) * u
      let z = gi.from[1] + (gi.to[1] - gi.from[1]) * u
      let y = ground(x, z)
      let pitch = 0
      let roll = Math.sin(t * 3 + i) * 0.08
      let yaw = u < 1 ? Math.atan2(gi.to[0] - gi.from[0], gi.to[1] - gi.from[1]) : Math.atan2(ROYAL_STAGE.x - x, ROYAL_STAGE.z - z)
      if (e >= F.SHOW) y += Math.abs(Math.sin(((e - F.SHOW) / BEAT) * Math.PI)) * (e >= F.DROP ? 1.4 : 0.5) // dancing
      // the sneeze knocks even the giants over
      const a = (e - F.SNEEZE - 0.3) / 2.2
      if (a >= 0 && a < 1) {
        y += Math.sin(a * Math.PI) * 9
        pitch = a * Math.PI * 2
      }
      const g0 = zeroG(e)
      if (g0 > 0) {
        y += g0 * (12 + i * 5)
        pitch += g0 * (e - F.SPACE) * 0.4
        roll += g0 * (e - F.SPACE) * 0.3
      }
      if (e > F.LIFTOFF && e < F.SPACE) y -= 0.3
      g.position.set(x, y, z)
      g.rotation.set(pitch, yaw, roll, 'YXZ')
      g.scale.setScalar(gi.scale * clamp01((F.END - 0.05 - e) / 0.6))
      says.current[i].position.set(x, y + gi.scale * 1.2 + 1.5, z)
    })
  })
  return GIANTS.map((gi, i) => (
    <group key={i}>
      <group ref={(el) => (refs.current[i] = el)} visible={false}>
        <Parts parts={parts[i]} />
      </group>
      <sprite ref={(el) => (says.current[i] = el)} material={textBubble(gi.line, '#7a4fd1')} scale={[5, 2.3, 1]} visible={false} />
    </group>
  ))
}

// ---------- fire falling from the sky: fireballs with flaming tails, exploding where they land
const N_MET = 24 // at most this many in the air / exploding at once
function Meteors() {
  const balls = useRef()
  const tails = useRef()
  const fire = useRef()
  const smoke = useRef()
  const rings = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  useFrame(({ clock }) => {
    const e = finale.t()
    let nb = 0
    let nf = 0
    if (e >= 0) {
      for (const mt of METEORS) {
        const a = e - mt.at
        if (a < 0 || a > FALL + 1.6) continue
        const gy = ground(mt.x, mt.z)
        const from = [mt.x + 22, 125, mt.z - 70]
        if (a < FALL && nb < N_MET) {
          const u = a / FALL
          const x = from[0] + (mt.x - from[0]) * u
          const y = from[1] + (gy - from[1]) * u
          const z = from[2] + (mt.z - from[2]) * u
          tmp.position.set(x, y, z)
          tmp.rotation.set(0, 0, 0)
          tmp.scale.setScalar(mt.s * (1 + Math.sin(clock.elapsedTime * 30 + mt.at) * 0.1))
          tmp.updateMatrix()
          balls.current.setMatrixAt(nb, tmp.matrix)
          // the tail points back up the way it came
          dir.set(from[0] - mt.x, from[1] - gy, from[2] - mt.z).normalize()
          tmp.quaternion.setFromUnitVectors(up, dir)
          tmp.position.set(x + dir.x * mt.s * 4, y + dir.y * mt.s * 4, z + dir.z * mt.s * 4)
          tmp.scale.set(mt.s * 0.9, mt.s * 8, mt.s * 0.9)
          tmp.updateMatrix()
          tails.current.setMatrixAt(nb++, tmp.matrix)
          tmp.quaternion.identity()
        } else if (a >= FALL && nf < N_MET) {
          const b = a - FALL
          tmp.position.set(mt.x, gy + 1 + b * 2, mt.z)
          tmp.rotation.set(0, 0, 0)
          tmp.scale.setScalar(Math.max(0.001, (1 + b * 6) * (1 - b / 1.6)) * mt.s)
          tmp.updateMatrix()
          fire.current.setMatrixAt(nf, tmp.matrix)
          tmp.position.set(mt.x, gy + 2 + b * 4, mt.z)
          tmp.scale.setScalar((1.5 + b * 3) * mt.s)
          tmp.updateMatrix()
          smoke.current.setMatrixAt(nf, tmp.matrix)
          tmp.position.set(mt.x, gy + 0.2, mt.z)
          tmp.rotation.set(-Math.PI / 2, 0, 0)
          tmp.scale.setScalar(1 + b * 14)
          tmp.updateMatrix()
          rings.current.setMatrixAt(nf++, tmp.matrix)
        }
      }
    }
    for (let k = nb; k < N_MET; k++) {
      balls.current.setMatrixAt(k, ZERO)
      tails.current.setMatrixAt(k, ZERO)
    }
    for (let k = nf; k < N_MET; k++) {
      fire.current.setMatrixAt(k, ZERO)
      smoke.current.setMatrixAt(k, ZERO)
      rings.current.setMatrixAt(k, ZERO)
    }
    for (const r of [balls, tails, fire, smoke, rings]) r.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={balls} args={[SPH, m('#ffd23f', { emissive: '#ff8a1a', emissiveIntensity: 2.5 }), N_MET]} frustumCulled={false} />
      <instancedMesh ref={tails} args={[CONE, glow('#ff6a1a', { opacity: 0.8 }), N_MET]} frustumCulled={false} />
      <instancedMesh ref={fire} args={[SPH, m('#ff8a1a', { emissive: '#ff5a1f', emissiveIntensity: 2 }), N_MET]} frustumCulled={false} />
      <instancedMesh ref={smoke} args={[SPH, m('#2e2628', { transparent: true, opacity: 0.6, depthWrite: false }), N_MET]} frustumCulled={false} />
      <instancedMesh ref={rings} args={[RING, glow('#ffb03a', { opacity: 0.7 }), N_MET]} frustumCulled={false} />
    </>
  )
}

// ---------- lightning: jagged bolts hit the island, and everything flashes
function Lightning() {
  const bolts = useRef([])
  const flash = useRef()
  const strikes = useMemo(() => {
    const r = rand(13)
    return LIGHTNING_F.map((at) => {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.4
      const d = 30 + r() * 70
      const x = ROYAL_BOX.x + Math.cos(a) * d
      const z = ROYAL_BOX.z + Math.sin(a) * d
      const pts = [[x + (r() - 0.5) * 30, 110, z - 20]]
      for (let k = 1; k <= 9; k++) {
        const u = k / 9
        pts.push([pts[0][0] + (x - pts[0][0]) * u + (r() - 0.5) * 10 * (1 - u), 110 - u * (110 - ground(x, z)), pts[0][2] + (z - pts[0][2]) * u + (r() - 0.5) * 8 * (1 - u)])
      }
      return { at, pts }
    })
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f4eaff', fog: false }), [])
  useFrame(() => {
    const e = finale.t()
    let lit = 0
    strikes.forEach((s, i) => {
      const a = e - s.at
      const vis = a >= 0 && (a < 0.09 || (a > 0.15 && a < 0.28))
      if (bolts.current[i]) bolts.current[i].visible = vis
      if (vis) lit = 1
    })
    flash.current.intensity = lit * 2.4
  })
  return (
    <>
      {strikes.map((s, i) => (
        <group key={i} ref={(el) => (bolts.current[i] = el)} visible={false}>
          {s.pts.slice(1).map((p, k) => {
            const a = s.pts[k]
            const len = Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2])
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(p[0] - a[0], p[1] - a[1], p[2] - a[2]).normalize())
            return <mesh key={k} geometry={BOX} material={mat} position={[(a[0] + p[0]) / 2, (a[1] + p[1]) / 2, (a[2] + p[2]) / 2]} quaternion={q} scale={[0.7, len, 0.7]} />
          })}
        </group>
      ))}
      <ambientLight ref={flash} color="#efe3ff" intensity={0} />
    </>
  )
}

// ---------- fireworks: gold ones for the coronation, everything for the drop, and a few after the splash
const N_ROCKETS = 18
const SPARKS = 40
const LAUNCHES = (() => {
  const r = rand(808)
  const out = []
  for (let t = F.CROWN; t < F.CROWN + 2.5; t += 0.3) out.push({ at: t, gold: true })
  for (let t = F.DROP; t < F.CHAOS; t += 0.28) out.push({ at: t })
  for (let t = F.SPLASH + 0.5; t < F.END - 2; t += 0.45) out.push({ at: t })
  return out.map((l) => ({ ...l, x: 2 + r() * 40, z: -48 + r() * 30, h: 32 + r() * 26, color: l.gold ? '#ffd23f' : pick(COLORS, r) }))
})()
function Fireworks() {
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const dirs = useMemo(() => {
    const r = rand(5)
    return Array.from({ length: SPARKS }, () => new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(9 + r() * 5))
  }, [])
  const color = useMemo(() => new THREE.Color(), [])
  const lastColor = useRef([])
  useFrame(() => {
    const e = finale.t()
    let slot = 0
    if (e >= 0) {
      for (const l of LAUNCHES) {
        const a = e - l.at
        if (a < 0 || a > 3.2 || slot >= N_ROCKETS) continue
        const base = slot * (SPARKS + 1)
        if (lastColor.current[slot] !== l.color) {
          lastColor.current[slot] = l.color
          for (let i = 0; i <= SPARKS; i++) ref.current.setColorAt(base + i, color.set(i === SPARKS ? '#fff3b0' : l.color))
          ref.current.instanceColor.needsUpdate = true
        }
        const rise = 1.1
        if (a < rise) {
          tmp.position.set(l.x, 3 + (l.h - 3) * (a / rise), l.z)
          tmp.scale.setScalar(0.35)
        } else tmp.scale.setScalar(0)
        tmp.updateMatrix()
        ref.current.setMatrixAt(base + SPARKS, tmp.matrix)
        const b = a - rise
        for (let i = 0; i < SPARKS; i++) {
          if (b >= 0 && b < 2) {
            const v = dirs[i]
            tmp.position.set(l.x + v.x * b, l.h + v.y * b - 3 * b * b, l.z + v.z * b)
            tmp.scale.setScalar(0.5 * (1 - b / 2))
          } else tmp.scale.setScalar(0)
          tmp.updateMatrix()
          ref.current.setMatrixAt(base + i, tmp.matrix)
        }
        slot++
      }
    }
    for (let s = slot; s < N_ROCKETS; s++) for (let i = 0; i <= SPARKS; i++) ref.current.setMatrixAt(s * (SPARKS + 1) + i, ZERO)
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[SPH, useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), []), N_ROCKETS * (SPARKS + 1)]} frustumCulled={false} />
}

// ---------- gold glitter bursting from the king when he's crowned, drifting down over everyone
const N_GOLD = 140
function GoldDust() {
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const bits = useMemo(() => {
    const r = rand(24)
    return Array.from({ length: N_GOLD }, () => ({ a: r() * Math.PI * 2, v: 6 + r() * 14, up: 6 + r() * 12, spin: r() * 9, d: r() * 0.4 }))
  }, [])
  useFrame(() => {
    const e = finale.t()
    const a0 = e - F.CROWN
    const vis = a0 >= 0 && a0 < 8
    ref.current.visible = vis
    if (!vis) return
    bits.forEach((b, i) => {
      const a = Math.max(0, a0 - b.d)
      const out = Math.min(a, 1.2)
      const x = CRATER.x + Math.cos(b.a) * b.v * out + Math.sin(a * 2 + i) * 0.6
      const z = CRATER.z + Math.sin(b.a) * b.v * out
      const y = 30 + b.up * out - 4.9 * out * out - Math.max(0, a - 1.2) * 2.2
      tmp.position.set(x, Math.max(y, ground(x, z) + 0.05), z)
      tmp.rotation.set(a * b.spin, a * b.spin * 0.7, 0)
      tmp.scale.set(0.35, 0.03, 0.25)
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[BOX, m('#ffd23f', { metalness: 1, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.6, side: THREE.DoubleSide }), N_GOLD]} frustumCulled={false} visible={false} />
}

// ---------- a giant Ryan Jr. rises out of the north sea... ah... ah... ACHOO! (facing the Royal Box,
// and the shockwave rings fly right at you)
const GS = 92
const GD = (() => {
  const dx = ROYAL_BOX.x - NORTH_GIANT.x
  const dz = ROYAL_BOX.z - NORTH_GIANT.z
  const d = Math.hypot(dx, dz)
  return { x: dx / d, z: dz / d, yaw: Math.atan2(dx, dz) }
})()
function NorthGiant() {
  const root = useRef()
  const body = useRef()
  const bubble = useRef()
  const rings = useRef([])
  const lines = useMemo(() => ({ hi: textBubble('MRRROW? (is that a PARTY?)', '#1d1d22'), ahh: textBubble('ah… AH… AAAHHH…', '#d62839'), choo: textBubble('ACHOOOOOO!!!', '#d62839'), bye: textBubble('…sorry. 🐾', '#1d1d22') }), [])
  useFrame(() => {
    const e = finale.t()
    const vis = e >= F.CHAOS - 0.2 && e < F.LIFTOFF
    root.current.visible = vis
    rings.current.forEach((r, i) => {
      if (!r) return
      const a = e - F.SNEEZE - i * 0.2
      r.visible = a >= 0 && a < 2.2
      if (r.visible) {
        const d = 20 + a * 60
        r.position.set(NORTH_GIANT.x + GD.x * d, 40 - a * 14, NORTH_GIANT.z + GD.z * d)
        r.rotation.y = GD.yaw
        r.scale.setScalar(6 + a * 30)
        r.material.opacity = 0.75 * (1 - a / 2.2)
      }
    })
    if (!vis) return
    const rise = smooth((e - F.CHAOS) / 3.2) * (1 - smooth((e - F.TOSPACE) / 3.5))
    root.current.position.set(NORTH_GIANT.x, -70 + rise * 66, NORTH_GIANT.z)
    root.current.rotation.y = GD.yaw
    let tilt = 0
    if (e >= F.SNEEZE - 1.4 && e < F.SNEEZE) tilt = -0.35 * smooth((e - F.SNEEZE + 1.4) / 1.4)
    else if (e >= F.SNEEZE && e < F.SNEEZE + 1.5) tilt = 0.55 * Math.sin(((e - F.SNEEZE) / 1.5) * Math.PI)
    body.current.rotation.set(tilt, 0, 0)
    let line = null
    if (e >= F.CHAOS + 1.5 && e < F.SNEEZE - 1.4) line = lines.hi
    else if (e >= F.SNEEZE - 1.4 && e < F.SNEEZE) line = lines.ahh
    else if (e >= F.SNEEZE && e < F.SNEEZE + 2.2) line = lines.choo
    else if (e >= F.SNEEZE + 2.2 && e < F.TOSPACE + 1) line = lines.bye
    bubble.current.visible = !!line
    if (line) bubble.current.material = line
  })
  return (
    <>
      <group ref={root} visible={false}>
        <group ref={body} position={[0, 22, 0]}>
          <group position={[0, -22, 0]} scale={GS}>
            <RyanJr />
          </group>
        </group>
        <sprite ref={bubble} position={[0, 0.62 * GS + 10, 0]} scale={[40, 19, 1]} visible={false} />
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} geometry={RING} material={glow('#ffffff', { opacity: 0.7 }).clone()} visible={false} />
      ))}
    </>
  )
}

// ---------- the tsunami: one huge wave rolls south across the whole island
function Tsunami() {
  const wave = useRef()
  const spray = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const drops = useMemo(() => {
    const r = rand(61)
    return Array.from({ length: 70 }, () => ({ x: -70 + r() * 150, o: r(), v: 4 + r() * 6, s: 0.4 + r() * 0.9 }))
  }, [])
  useFrame(({ clock }) => {
    const e = finale.t()
    const wz = waveZ(e)
    wave.current.visible = wz != null
    spray.current.visible = wz != null
    if (wz == null) return
    const a = e - F.WAVE
    const grow = Math.min(1, a / 0.8) * (1 - smooth((a - 3.4) / 1))
    wave.current.position.set(10, 0, wz)
    wave.current.scale.set(1, 0.2 + grow * 1.6, 1)
    drops.forEach((d, i) => {
      const u = ((clock.elapsedTime * 1.4 + d.o) % 1)
      tmp.position.set(d.x, 6 * grow + d.v * u - 6 * u * u, wz + 1 + u * 2)
      tmp.scale.setScalar(d.s * grow * (1 - u))
      tmp.updateMatrix()
      spray.current.setMatrixAt(i, tmp.matrix)
    })
    spray.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <group ref={wave} visible={false}>
        <mesh rotation={[0, 0, Math.PI / 2]} scale={[4.5, 180, 4.5]} material={m('#1fa4c4', { transparent: true, opacity: 0.85, roughness: 0.2 })}>
          <cylinderGeometry args={[1, 1.3, 1, 18, 1]} />
        </mesh>
        <mesh position={[0, 3.6, 1.2]} rotation={[0, 0, Math.PI / 2]} scale={[1.4, 180, 2]} material={m('#ffffff', { roughness: 0.4 })}>
          <cylinderGeometry args={[1, 1, 1, 12, 1]} />
        </mesh>
      </group>
      <instancedMesh ref={spray} args={[SPH, m('#ffffff'), drops.length]} frustumCulled={false} visible={false} />
    </>
  )
}

// ---------- the sharknado (the shark itself rides it: see Finale.jsx)
function Sharknado() {
  const funnel = useRef()
  const layers = useRef([])
  const debris = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const bits = useMemo(() => {
    const r = rand(99)
    return Array.from({ length: 40 }, () => ({ r: 2 + r() * 7, h: r() * 26, w: 2 + r() * 3, ph: r() * 6, s: 0.2 + r() * 0.5 }))
  }, [])
  const mats2 = useMemo(() => Array.from({ length: 9 }, (_, i) => new THREE.MeshStandardMaterial({ color: i % 2 ? '#5a5560' : '#7a7480', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide })), [])
  useFrame(({ clock }) => {
    const e = finale.t()
    const T = tornadoAt(e)
    const vis = T.k > 0.01 && e >= 0
    funnel.current.visible = vis
    debris.current.visible = vis
    if (!vis) return
    const t = clock.elapsedTime
    funnel.current.position.set(T.x, ground(T.x, T.z), T.z)
    funnel.current.scale.set(T.k, T.k, T.k)
    layers.current.forEach((l, i) => {
      if (!l) return
      l.rotation.y = t * (3 + i * 0.4)
      l.position.x = Math.sin(t * 1.3 + i * 0.6) * i * 0.35
      l.position.z = Math.cos(t * 1.1 + i * 0.6) * i * 0.3
    })
    bits.forEach((b, i) => {
      const a = t * b.w + b.ph
      const rr = b.r * (0.5 + b.h / 30)
      tmp.position.set(T.x + Math.cos(a) * rr, ground(T.x, T.z) + b.h * T.k, T.z + Math.sin(a) * rr)
      tmp.rotation.set(t * 4 + i, t * 3, 0)
      tmp.scale.setScalar(b.s * T.k)
      tmp.updateMatrix()
      debris.current.setMatrixAt(i, tmp.matrix)
    })
    debris.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <group ref={funnel} visible={false}>
        {mats2.map((mt, i) => (
          <mesh key={i} ref={(el) => (layers.current[i] = el)} material={mt} position={[0, 2 + i * 3.4, 0]} scale={[1.2 + i * 1.1, 3.6, 1.2 + i * 1.1]}>
            <cylinderGeometry args={[1, 0.75, 1, 14, 1, true]} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={debris} args={[BOX, m('#6b4a2e'), bits.length]} frustumCulled={false} visible={false} />
    </>
  )
}

// ---------- cannons (from the war) firing into the chaos
const MAX_BOOMS = 16
function Cannons() {
  const group = useRef()
  const barrels = useRef([])
  const balls = useRef()
  const fire = useRef()
  const smoke = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const aim = (c) => Math.atan2(12 - c.x, -8 - c.z)
  useFrame(() => {
    const e = finale.t()
    group.current.visible = e >= F.CHAOS - 0.5 && e < F.LIFTOFF
    let nb = 0
    let nf = 0
    const recoil = CANNONS_F.map(() => 0)
    if (group.current.visible) {
      for (const s of SHOTS_F) {
        const a = e - s.at
        if (a < 0 || a > CANNON_FLIGHT + 1.2) continue
        if (a < 0.25) recoil[s.cannon] = 1 - a / 0.25
        const c = CANNONS_F[s.cannon]
        const y0 = ground(c.x, c.z) + 1.4
        const gy = ground(s.to[0], s.to[1])
        if (a < CANNON_FLIGHT && nb < MAX_BOOMS) {
          const u = a / CANNON_FLIGHT
          tmp.position.set(c.x + (s.to[0] - c.x) * u, y0 + (gy - y0) * u + Math.sin(u * Math.PI) * 12, c.z + (s.to[1] - c.z) * u)
          tmp.scale.setScalar(0.35)
          tmp.updateMatrix()
          balls.current.setMatrixAt(nb++, tmp.matrix)
        } else if (a >= CANNON_FLIGHT && nf < MAX_BOOMS) {
          const b = a - CANNON_FLIGHT
          tmp.position.set(s.to[0], gy + 0.8 + b * 1.5, s.to[1])
          tmp.scale.setScalar(Math.max(0.001, (0.8 + b * 4.5) * (1 - b / 1.2)))
          tmp.updateMatrix()
          fire.current.setMatrixAt(nf, tmp.matrix)
          tmp.position.set(s.to[0], gy + 1.6 + b * 3, s.to[1])
          tmp.scale.setScalar(1.2 + b * 2.6)
          tmp.updateMatrix()
          smoke.current.setMatrixAt(nf++, tmp.matrix)
        }
      }
    }
    for (let k = nb; k < MAX_BOOMS; k++) balls.current.setMatrixAt(k, ZERO)
    for (let k = nf; k < MAX_BOOMS; k++) {
      fire.current.setMatrixAt(k, ZERO)
      smoke.current.setMatrixAt(k, ZERO)
    }
    for (const r of [balls, fire, smoke]) r.current.instanceMatrix.needsUpdate = true
    barrels.current.forEach((b, i) => b && (b.position.z = -recoil[i] * 0.4))
  })
  return (
    <>
      <group ref={group} visible={false}>
        {CANNONS_F.map((c, i) => (
          <group key={i} position={[c.x, ground(c.x, c.z), c.z]} rotation={[0, aim(c), 0]}>
            <B g={BOX} c="#6b4426" p={[0, 0.45, -0.2]} s={[0.9, 0.35, 1.4]} />
            {[-1, 1].map((sx) => (
              <mesh key={sx} geometry={TORUS} material={m('#3a2416')} position={[0.55 * sx, 0.45, -0.2]} rotation={[0, Math.PI / 2, 0]} scale={0.42} />
            ))}
            <group ref={(el) => (barrels.current[i] = el)}>
              <B g={CYL} c="#1d1d22" o={{ metalness: 0.6, roughness: 0.35 }} p={[0, 0.95, 0.2]} r={[Math.PI / 2 - 0.5, 0, 0]} s={[0.26, 1.7, 0.26]} />
            </group>
          </group>
        ))}
      </group>
      <instancedMesh ref={balls} args={[SPH, m('#1d1d22', { metalness: 0.5 }), MAX_BOOMS]} frustumCulled={false} />
      <instancedMesh ref={fire} args={[SPH, m('#ff8a1a', { emissive: '#ff5a1f', emissiveIntensity: 1.8 }), MAX_BOOMS]} frustumCulled={false} />
      <instancedMesh ref={smoke} args={[SPH, m('#4a4448', { transparent: true, opacity: 0.55, depthWrite: false }), MAX_BOOMS]} frustumCulled={false} />
    </>
  )
}

// ---------- the Clone-O-Matic overloads (the clones themselves are in the crowd)
function CloneOverload() {
  const sparks = useRef()
  const puffs = useRef()
  const bubble = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const data = useMemo(() => {
    const r = rand(5150)
    return Array.from({ length: 30 }, () => ({ a: r() * Math.PI * 2, v: 3 + r() * 5, up: 4 + r() * 6, o: r() }))
  }, [])
  const y0 = ground(MACHINE.x, MACHINE.z)
  useFrame(({ clock }) => {
    const e = finale.t()
    const vis = e >= F.CHAOS && e < F.COUNT
    sparks.current.visible = vis
    puffs.current.visible = vis
    bubble.current.visible = vis && e < F.CHAOS + 6
    if (!vis) return
    const t = clock.elapsedTime
    data.forEach((d, i) => {
      const u = (t * 1.3 + d.o) % 1
      tmp.position.set(MACHINE.x + Math.cos(d.a) * d.v * u, y0 + 5 + d.up * u - 6 * u * u, MACHINE.z + Math.sin(d.a) * d.v * u)
      tmp.scale.setScalar(0.12 * (1 - u))
      tmp.updateMatrix()
      sparks.current.setMatrixAt(i, tmp.matrix)
      const v = (t * 0.5 + d.o) % 1
      tmp.position.set(MACHINE.x + Math.cos(d.a) * 1.5, y0 + 5 + v * 9, MACHINE.z + Math.sin(d.a) * 1.5)
      tmp.scale.setScalar(0.8 + v * 2.5)
      tmp.updateMatrix()
      puffs.current.setMatrixAt(i, tmp.matrix)
    })
    sparks.current.instanceMatrix.needsUpdate = true
    puffs.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={sparks} args={[SPH, glow('#ffe066', { opacity: 1 }), data.length]} frustumCulled={false} visible={false} />
      <instancedMesh ref={puffs} args={[SPH, m('#5a5560', { transparent: true, opacity: 0.45, depthWrite: false }), data.length]} frustumCulled={false} visible={false} />
      <sprite ref={bubble} material={textBubble('⚠️ ERROR: TOO MANY CATS ⚠️', '#d62839')} position={[MACHINE.x, y0 + 8.5, MACHINE.z]} scale={[5, 2.3, 1]} visible={false} />
    </>
  )
}

// ---------- the island as a rocket: its own lagoon, waterfalls pouring off the edge, a rocky
// underside, and rocket engines (all hidden until it leaves the sea)
function Rocketry() {
  const group = useRef()
  const flames = useRef([])
  const fallTex = useMemo(() => {
    const t = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = '#2fb6d0'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 40; i++) {
        g.fillStyle = i % 3 ? 'rgba(255,255,255,0.5)' : 'rgba(180,240,255,0.7)'
        g.fillRect(Math.random() * w, Math.random() * h, 2, 20 + Math.random() * 40)
      }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(60, 1)
    return t
  }, [])
  const fallMat = useMemo(() => new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }), [fallTex])
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 1, flatShading: true }), [])
  const rockGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(140, 110, 40, 6, true)
    const p = g.attributes.position
    const r = rand(3)
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 54) {
        const k = 1 + (r() - 0.5) * 0.25
        p.setX(i, p.getX(i) * k)
        p.setZ(i, p.getZ(i) * k)
      }
    }
    g.rotateX(Math.PI) // point down
    g.translate(0, -2.8 - 55, 0)
    g.computeVertexNormals()
    return g
  }, [])
  const outer = glow('#ff7a1a', { opacity: 0.9 })
  const inner = glow('#ffe066', { opacity: 1 })
  useFrame(({ clock }) => {
    const e = finale.t()
    const vis = finaleLive.lift > 0.3
    group.current.visible = vis
    if (!vis) return
    fallTex.offset.y = (clock.elapsedTime * 1.6) % 1
    const burn = e < F.SPACE + 0.5 ? 1 : 0
    flames.current.forEach((f, i) => {
      if (!f) return
      f.visible = burn > 0
      f.scale.y = (i === 0 ? 70 : 34) * (1 + Math.sin(clock.elapsedTime * 40 + i) * 0.12)
    })
  })
  const engines = useMemo(() => [[0, 0, 140, 22], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * Math.PI * 2) * 60, Math.sin((i / 8) * Math.PI * 2) * 60, 60, 9])], [])
  return (
    <group ref={group} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={m('#1fa4c4', { transparent: true, opacity: 0.88, roughness: 0.15, depthWrite: false })}>
        <circleGeometry args={[139, 96]} />
      </mesh>
      <mesh position={[0, -20, 0]} material={fallMat}>
        <cylinderGeometry args={[139, 139, 40, 96, 1, true]} />
      </mesh>
      <mesh geometry={rockGeo} material={rockMat} />
      {engines.map(([x, z, depth, r], i) => (
        <group key={i} ref={(el) => (flames.current[i] = el)} position={[x, -2.8 - (i === 0 ? 108 : 40), z]} scale={[1, 1, 1]}>
          <mesh geometry={CONE} material={outer} position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]} scale={[r, 1, r]} />
          <mesh geometry={CONE} material={inner} position={[0, -0.35, 0]} rotation={[Math.PI, 0, 0]} scale={[r * 0.5, 0.7, r * 0.5]} />
        </group>
      ))}
    </group>
  )
}

// ---------- the giant parachute that brings the island home
function Parachute() {
  const group = useRef()
  const canopy = useRef()
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        roughness: 0.8,
        map: canvasTex(1024, 256, (g, w, h) => {
          for (let i = 0; i < 16; i++) {
            g.fillStyle = i % 2 ? '#ffffff' : i % 4 === 0 ? '#e8222e' : '#ff4fa3'
            g.fillRect((i * w) / 16, 0, w / 16 + 1, h)
          }
          g.fillStyle = '#ffd23f'
          g.font = 'bold 60px "Arial Black", Impact, sans-serif'
          g.textAlign = 'center'
          for (let k = 0; k < 4; k++) g.fillText('RYAN JR. AIRLINES', (k + 0.5) * (w / 4), h * 0.75)
        }),
      }),
    [],
  )
  const ropes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        const R = SHORE(a) - 2
        const top = [Math.cos(a) * 80, 100, Math.sin(a) * 80]
        const bot = [Math.cos(a) * R, 0.5, Math.sin(a) * R]
        const len = Math.hypot(top[0] - bot[0], top[1] - bot[1], top[2] - bot[2])
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(top[0] - bot[0], top[1] - bot[1], top[2] - bot[2]).normalize())
        return { p: [(top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2], q, len }
      }),
    [],
  )
  useFrame(({ clock }) => {
    const e = finale.t()
    const vis = e >= F.CHUTE && e < F.SPLASH + 3
    group.current.visible = vis
    if (!vis) return
    const open = smooth((e - F.CHUTE) / 1.2)
    const deflate = smooth((e - F.SPLASH) / 2.5)
    canopy.current.scale.set(0.2 + open * 0.8 + deflate * 0.3, (0.2 + open * 0.8) * (1 - deflate * 0.9), 0.2 + open * 0.8 + deflate * 0.3)
    canopy.current.position.y = 100 - deflate * 80
    canopy.current.rotation.y = clock.elapsedTime * 0.1
    group.current.children.slice(1).forEach((r) => (r.visible = deflate < 0.2))
  })
  return (
    <group ref={group} visible={false}>
      <mesh ref={canopy} material={mat} position={[0, 100, 0]}>
        <sphereGeometry args={[85, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
      </mesh>
      {ropes.map((r, i) => (
        <mesh key={i} geometry={CYL} material={m('#f2f2f2')} position={r.p} quaternion={r.q} scale={[0.12, r.len, 0.12]} />
      ))}
    </group>
  )
}

// ---------- in space, the giant Ryan Jr. floats by in a space helmet
function SpaceGiant() {
  const root = useRef()
  const bubble = useRef()
  useFrame(() => {
    const e = finale.t()
    const vis = e >= F.SPACE - 1 && e < F.CHUTE + 1
    root.current.visible = vis
    bubble.current.visible = vis && e > F.SPACE + 1.5
    if (!vis) return
    const u = (e - F.SPACE + 1) / (F.CHUTE - F.SPACE + 2)
    root.current.position.set(-260 + u * 170, 40 - u * 10, -230 + u * 30)
    root.current.rotation.set(Math.sin(u * 3) * 0.3, 0.9 + u * 1.2, u * 0.8)
  })
  return (
    <group ref={root} visible={false}>
      <group scale={60}>
        <RyanJr />
        {/* the space helmet */}
        <mesh position={[0, 0.48, 0.17]}>
          <sphereGeometry args={[0.17, 24, 16]} />
          <meshPhysicalMaterial color="#cfefff" transparent opacity={0.3} roughness={0.05} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.36, 0.13]} rotation={[0.4, 0, 0]}>
          <torusGeometry args={[0.12, 0.02, 8, 24]} />
          <meshStandardMaterial color="#d0d4da" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <sprite ref={bubble} material={textBubble('Houston, we have a… ACHOO 🚀', '#4f6fff')} position={[0, 50, 0]} scale={[44, 20, 1]} visible={false} />
    </group>
  )
}

// ======================================================================
// <FinaleSky />: things that stay in the world while the island flies
export function FinaleSky() {
  return (
    <>
      <FireRain />
      <LaunchSmoke />
      <Splash />
      <Earth />
      <Planet />
      <FarCamera />
    </>
  )
}

// burning embers raining down around you during the awakening and the chaos
const N_EMBERS = 260
function FireRain() {
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const embers = useMemo(() => {
    const r = rand(66)
    return Array.from({ length: N_EMBERS }, () => ({ x: (r() - 0.5) * 80, z: (r() - 0.5) * 80, o: r(), v: 7 + r() * 7, s: 0.6 + r() * 0.8 }))
  }, [])
  useFrame(({ camera, clock }) => {
    const e = finale.t()
    const vis = on(e, F.FIRE - 0.5, F.RISE + 0.5) || on(e, F.CHAOS + 0.3, F.COUNT)
    ref.current.visible = vis
    if (!vis) return
    const t = clock.elapsedTime
    embers.forEach((d, i) => {
      const fall = (t * d.v + d.o * 50) % 50
      tmp.position.set(camera.position.x + d.x + Math.sin(t + i) * 1.5, camera.position.y + 35 - fall, camera.position.z + d.z)
      tmp.rotation.set(0.3, 0, 0.2)
      tmp.scale.set(0.09 * d.s, 0.35 * d.s, 0.09 * d.s)
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[SPH, glow('#ff8a2a', { opacity: 0.95 }), N_EMBERS]} frustumCulled={false} visible={false} />
}

// a ring of rocket smoke billowing over the sea at liftoff
function LaunchSmoke() {
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const puffs = useMemo(() => {
    const r = rand(72)
    return Array.from({ length: 48 }, (_, i) => ({ a: (i / 48) * Math.PI * 2 + r() * 0.1, d: 60 + r() * 30, v: 4 + r() * 8, s: 8 + r() * 10, up: 2 + r() * 5 }))
  }, [])
  useFrame(() => {
    const e = finale.t()
    const a = e - F.LIFTOFF
    const vis = a >= 0 && a < 11
    ref.current.visible = vis
    if (!vis) return
    puffs.forEach((p, i) => {
      const d = p.d + p.v * a
      tmp.position.set(Math.cos(p.a) * d, p.up * a, Math.sin(p.a) * d)
      tmp.scale.setScalar(p.s * (0.4 + Math.min(1, a / 1.5)) * (1 + a * 0.12))
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[SPH, m('#e8e4ea', { transparent: true, opacity: 0.7, depthWrite: false }), 48]} frustumCulled={false} visible={false} />
}

// SPLASHDOWN: a huge ring of spray all around the island
function Splash() {
  const ref = useRef()
  const ring = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const drops = useMemo(() => {
    const r = rand(88)
    return Array.from({ length: 150 }, () => {
      const a = r() * Math.PI * 2
      return { a, d: SHORE(a) + 4 + r() * 50, vy: 12 + r() * 22, vd: 4 + r() * 10, s: 0.8 + r() * 1.6 }
    })
  }, [])
  useFrame(() => {
    const e = finale.t()
    const a = e - F.SPLASH
    const vis = a >= 0 && a < 4
    ref.current.visible = vis
    ring.current.visible = vis
    if (!vis) return
    drops.forEach((d, i) => {
      const y = d.vy * a - 9.8 * a * a
      const r = d.d + d.vd * a
      tmp.position.set(Math.cos(d.a) * r, Math.max(-1, y), Math.sin(d.a) * r)
      tmp.scale.setScalar(y > -1 ? d.s : 0)
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ring.current.scale.setScalar(120 + a * 70)
    ring.current.material.opacity = 0.8 * (1 - a / 4)
  })
  return (
    <>
      <instancedMesh ref={ref} args={[SPH, m('#ffffff'), 150]} frustumCulled={false} visible={false} />
      <mesh ref={ring} geometry={RING} material={glow('#ffffff', { opacity: 0.8 }).clone()} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
    </>
  )
}

// Earth, seen from space (its surface is the sea you just left)
const EARTH_R = 2600
function Earth() {
  const ref = useRef()
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        fog: false,
        map: canvasTex(1024, 512, (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, 0, h)
          grad.addColorStop(0, '#2a7ab8')
          grad.addColorStop(0.5, '#1a6fa8')
          grad.addColorStop(1, '#2a7ab8')
          g.fillStyle = grad
          g.fillRect(0, 0, w, h)
          const r = rand(31)
          // continents
          for (let k = 0; k < 14; k++) {
            const cx = r() * w
            const cy = h * 0.2 + r() * h * 0.6
            g.fillStyle = pick(['#4f9a4a', '#6aa84f', '#b8a06a', '#5f8f3f'], r)
            g.beginPath()
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2
              const rr = 20 + r() * 50
              const x = cx + Math.cos(a) * rr * 1.4
              const y = cy + Math.sin(a) * rr
              if (i) g.lineTo(x, y)
              else g.moveTo(x, y)
            }
            g.fill()
          }
          // swirly clouds
          g.strokeStyle = 'rgba(255,255,255,0.75)'
          g.lineCap = 'round'
          for (let k = 0; k < 40; k++) {
            g.lineWidth = 3 + r() * 9
            g.beginPath()
            const x = r() * w
            const y = r() * h
            g.arc(x, y, 10 + r() * 40, r() * 6, r() * 6 + 2 + r() * 2)
            g.stroke()
          }
        }),
      }),
    [],
  )
  useFrame(() => {
    ref.current.visible = finaleLive.lift > 30
  })
  return (
    <mesh ref={ref} material={mat} position={[0, -EARTH_R - 1, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <sphereGeometry args={[EARTH_R, 96, 64]} />
    </mesh>
  )
}

// a ringed planet hanging in the sky while you're in space
function Planet() {
  const ref = useRef()
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        fog: false,
        map: canvasTex(256, 256, (g, w, h) => {
          for (let y = 0; y < h; y += 8) {
            g.fillStyle = ['#e8b77a', '#d99a5a', '#f2d1a0', '#c9844a'][(y / 8) % 4]
            g.fillRect(0, y, w, 8)
          }
        }),
      }),
    [],
  )
  useFrame(({ clock }) => {
    ref.current.visible = finaleLive.lift > 200
    ref.current.rotation.y = clock.elapsedTime * 0.05
  })
  return (
    <group ref={ref} position={[-900, SPACE_Y + 420, -1500]} visible={false}>
      <mesh material={mat}>
        <sphereGeometry args={[220, 48, 32]} />
      </mesh>
      <mesh rotation={[1.2, 0.3, 0]} material={new THREE.MeshBasicMaterial({ color: '#f2d9b0', side: THREE.DoubleSide, transparent: true, opacity: 0.75, fog: false })}>
        <ringGeometry args={[290, 460, 96]} />
      </mesh>
    </group>
  )
}

// while the island is up high, the camera needs to see much farther (Earth is huge)
function FarCamera() {
  const { camera } = useThree()
  const far = useRef(false)
  useFrame(() => {
    const want = finaleLive.lift > 30
    if (want !== far.current) {
      far.current = want
      camera.far = want ? 9000 : 800
      camera.updateProjectionMatrix()
    }
  })
  return null
}
