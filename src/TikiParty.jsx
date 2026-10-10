import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, TossBall } from './Labubu.jsx'
import { CONE, partsFor } from './DinoCrowd.jsx'

// A chaotic tiki volcano picnic on the courtyard lawn (ground floor, y = -5):
// cartoon dinos and friendly tiki monsters in a conga line, a chase around the volcano,
// hula dancers, a fire twirler, picnics, torches, and a volcano that erupts every 3 minutes.
// Courtyard trees stand at (-10,-9) (0,-11.5) (10,-8.5) (-12,3) (12,4) (-5,11) (7,11.5) (-2,1).

// ---------- volcano timing (shared by everything so the whole party panics together)
const FIRST = 20 // first eruption this many seconds after load
const PERIOD = 180 // then every 3 minutes
const ERUPT = 9 // eruption length
const RUMBLE = 8 // warning shake before each eruption
const VX = 4
const VZ = 3
const VH = 5.6 // crater height above the lawn (top pokes up near floor-2 eye level)

function volcano(t) {
  const since = t - FIRST
  if (since < -RUMBLE) return { mode: 'calm', c: Infinity, next: -since }
  if (since < 0) return { mode: 'rumble', c: Infinity, next: -since }
  const c = since % PERIOD
  if (c < ERUPT) return { mode: 'erupt', c, next: PERIOD - c }
  return { mode: PERIOD - c < RUMBLE ? 'rumble' : 'calm', c, next: PERIOD - c }
}
const panicOf = (v) => (v.mode === 'erupt' ? 1 : v.mode === 'rumble' ? 0.35 : 0)

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

// ---------- shared geometry + per-color materials
const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const M = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(V.set(...p), Q.setFromEuler(E.set(...r)), S.set(...s))
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b))

const SKIRT = new THREE.CylinderGeometry(0.8, 1, 1, 22, 1, true)
const GEO = { sphere: G.sphere, cone: CONE, cyl: G.cyl, limb: G.limb, box: G.box, skirt: SKIRT }
const mats = new Map()
function mat(color, glow = 0) {
  const k = color + glow
  if (!mats.has(k)) {
    mats.set(k, new THREE.MeshStandardMaterial({
      color, roughness: 0.6, emissive: glow ? color : '#000000', emissiveIntensity: glow, side: THREE.DoubleSide,
    }))
  }
  return mats.get(k)
}

function Parts({ parts }) {
  return parts.map((p, i) => (
    <mesh key={i} geometry={GEO[p.bucket]} material={mat(p.color, p.glow)} matrix={p.m} matrixAutoUpdate={false} />
  ))
}

const STRAW = '#d9b25f'
const LEAF = '#3f9b4a'
const FLOWERS = ['#ff4fa3', '#ffd23f', '#ff7a3d', '#ffffff', '#b48be0']

// ---------- party dino: a classroom dino plus a lei, a flower and maybe a grass skirt
function dinoParts(o) {
  const s = { kind: 'rex', skin: '#6cc46a', belly: '#fff3c4', accent: '#ff7a3d', tilt: 0, ...o }
  const out = partsFor(s)
  const add = (bucket, m, color) => out.push({ bucket, m, color })
  const [ly, lr, lz] = s.kind === 'neck' ? [0.5, 0.1, 0.08] : [0.52, 0.17, 0.04]
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    add('sphere', M([Math.sin(a) * lr, ly, lz + Math.cos(a) * lr], [0, 0, 0], [0.04, 0.04, 0.04]), FLOWERS[i % FLOWERS.length])
  }
  const fy = s.kind === 'neck' ? 1.0 : s.kind === 'tri' ? 0.78 : 0.86
  add('sphere', M([0.08, fy, s.kind === 'neck' ? 0.12 : 0.02], [0, 0, 0], [0.06, 0.06, 0.04]), s.flower || '#ff4fa3')
  add('sphere', M([0.08, fy, s.kind === 'neck' ? 0.15 : 0.05], [0, 0, 0], [0.025, 0.025, 0.02]), '#ffd23f')
  if (s.skirt) add('skirt', M([0, 0.2, 0.02], [0, 0, 0], [0.26, 0.16, 0.26]), STRAW)
  return out
}

// ---------- friendly tiki monster: a carved wooden totem-blob with a leafy headdress
function monsterParts({ wood = '#a0673f', leaf = LEAF, flower = '#ff4fa3', skirt = true, torch = false }) {
  const out = []
  const add = (bucket, m, color, glow) => out.push({ bucket, m, color, glow })
  const dark = new THREE.Color(wood).multiplyScalar(0.6).getStyle()
  // feet + body
  for (const x of [-0.18, 0.18]) add('sphere', M([x, 0.08, 0.08], [0, 0, 0], [0.13, 0.08, 0.17]), dark)
  add('cyl', M([0, 0.72, 0], [0, 0, 0], [0.42, 1.0, 0.4]), wood)
  add('sphere', M([0, 1.22, 0], [0, 0, 0], [0.42, 0.2, 0.4]), wood)
  add('sphere', M([0, 0.22, 0], [0, 0, 0], [0.42, 0.14, 0.4]), wood)
  // carved bands
  for (const y of [0.6, 1.12]) add('cyl', M([0, y, 0], [0, 0, 0], [0.435, 0.03, 0.415]), dark)
  // face: big happy eyes, brow ridges, round nose, open grin with tongue and teeth
  for (const side of [-1, 1]) {
    add('sphere', M([0.15 * side, 0.95, 0.36], [0, 0, 0], [0.12, 0.13, 0.08]), '#ffffff')
    add('sphere', M([0.14 * side, 0.94, 0.43], [0, 0, 0], [0.065, 0.075, 0.04]), '#1b1b1f')
    add('sphere', M([0.12 * side, 0.97, 0.465], [0, 0, 0], [0.02, 0.02, 0.01]), '#ffffff')
    add('box', M([0.15 * side, 1.1, 0.4], [0, 0, 0.3 * side], [0.2, 0.045, 0.05]), dark)
    add('sphere', M([0.27 * side, 0.74, 0.34], [0, 0, 0], [0.07, 0.045, 0.03]), '#ff9aa8')
  }
  add('sphere', M([0, 0.82, 0.42], [0, 0, 0], [0.11, 0.07, 0.07]), dark)
  add('sphere', M([0, 0.62, 0.38], [0, 0, 0], [0.2, 0.1, 0.06]), '#3a1a12')
  add('sphere', M([0, 0.58, 0.41], [0, 0, 0], [0.11, 0.05, 0.03]), '#ff6b8a')
  for (const x of [-0.12, -0.04, 0.04, 0.12]) add('box', M([x, 0.68, 0.43], [0, 0, 0], [0.06, 0.05, 0.02]), '#ffffff')
  // leafy headdress fanned across the top, with a flower
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.3
    const fan = M([0, 1.32, -0.05], [-0.15, 0, a])
    add('cone', mul(fan, M([0, 0.25, 0], [0, 0, 0], [0.07, 0.5, 0.03])), i % 2 ? leaf : '#7cc95a')
  }
  add('sphere', M([0.28, 1.3, 0.2], [0, 0, 0], [0.09, 0.09, 0.06]), flower)
  add('sphere', M([0.28, 1.3, 0.25], [0, 0, 0], [0.04, 0.04, 0.03]), '#ffd23f')
  // stubby arms thrown up in celebration
  for (const side of [-1, 1]) add('limb', M([0.48 * side, 0.95, 0.05], [0, 0, -2.4 * side], [0.08, 0.15, 0.08]), wood)
  if (skirt) add('skirt', M([0, 0.36, 0], [0, 0, 0], [0.46, 0.3, 0.44]), STRAW)
  if (torch) {
    add('cyl', M([0.62, 1.5, 0.05], [0, 0, -0.5], [0.03, 0.9, 0.03]), '#5a3a22')
    add('cone', M([0.86, 1.98, 0.05], [0, 0, -0.5], [0.09, 0.25, 0.09]), '#ff7a1a', 1.5)
  }
  return out
}

// ---------- a moving party-goer
function Actor({ parts, scale = 1.6, move, seed = 0, children }) {
  const ref = useRef()
  const clock = useRef(seed)
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = st.clock.elapsedTime
    const p = panicOf(volcano(t))
    clock.current += dt * (1 + 2.2 * p) // everyone speeds up when the volcano goes off
    const r = move(clock.current, p, t)
    const jump = p * Math.abs(Math.sin(clock.current * 7 + seed)) * 0.6
    const g = ref.current
    g.rotation.order = 'YXZ'
    g.position.set(r.x, (r.y || 0) + jump, r.z)
    g.rotation.set(r.pitch || 0, (r.yaw || 0) + p * Math.sin(t * 13 + seed) * 0.4, (r.roll || 0) + p * Math.sin(t * 17 + seed) * 0.25)
  })
  return (
    <group ref={ref} scale={scale}>
      <Parts parts={parts} />
      {children}
    </group>
  )
}

const hop = (t, k = 6, h = 0.22) => Math.abs(Math.sin(t * k)) * h
const heading = (dx, dz) => Math.atan2(dx, dz)

// conga line weaving a figure-8 on the west lawn
function congaAt(u) {
  const cx = -6
  const cz = -3
  const x = cx + 6 * Math.sin(u)
  const z = cz + 5 * Math.sin(u) * Math.cos(u)
  const dx = 6 * Math.cos(u)
  const dz = 5 * Math.cos(2 * u)
  return { x, z, yaw: heading(dx, dz) }
}
const conga = (offset) => (t) => {
  const p = congaAt(t * 0.35 - offset)
  return { ...p, y: hop(t, 5, 0.18), roll: Math.sin(t * 2.5) * 0.25 }
}

// laps around the volcano
const lap = (radius, speed, offset) => (t) => {
  const a = t * speed + offset
  const dir = Math.sign(speed)
  return {
    x: VX + Math.cos(a) * radius,
    z: VZ + Math.sin(a) * radius,
    yaw: heading(-Math.sin(a) * dir, Math.cos(a) * dir),
    y: hop(t, 9, 0.25),
    roll: Math.sin(t * 9) * 0.15,
  }
}

const hula = (x, z, yaw) => (t) => ({ x: x + Math.sin(t * 2) * 0.15, z, yaw: yaw + Math.sin(t * 1.3) * 0.5, roll: Math.sin(t * 6) * 0.22, y: hop(t, 3, 0.05) })
const sit = (x, z, yaw) => (t) => ({ x, z, yaw, y: hop(t, 2.5, 0.04), roll: Math.sin(t * 1.7) * 0.06 })
const twirl = (x, z) => (t) => ({ x, z, yaw: t * 4, y: hop(t, 4, 0.15) })
const stomp = (x, z, yaw) => (t) => ({ x, z, yaw, y: hop(t, 4, 0.3), roll: Math.sin(t * 4) * 0.2 })

// ---------- the cast
const CAST = [
  // conga line: dinos and monsters alternating
  { dino: { kind: 'rex', skin: '#6cc46a', accent: '#ffd23f', skirt: true }, move: conga(0) },
  { monster: { wood: '#c4874f', flower: '#ffd23f' }, move: conga(0.32), scale: 1.25 },
  { dino: { kind: 'tri', skin: '#4fb3c9', accent: '#ff4fa3', skirt: true }, move: conga(0.62) },
  { dino: { kind: 'neck', skin: '#e6c84f', accent: '#ff7a3d', flower: '#7a4fd1' }, move: conga(0.9) },
  { monster: { wood: '#3fb6a8', leaf: '#2f6fd6', flower: '#ff7a3d' }, move: conga(1.22), scale: 1.25 },
  { dino: { kind: 'rex', skin: '#ff8fb0', accent: '#7a4fd1', skirt: true }, move: conga(1.52) },
  { dino: { kind: 'tri', skin: '#b48be0', accent: '#ffd23f' }, move: conga(1.8) },
  // the chase: a monster sprinting around the volcano with a T. rex right behind it
  { monster: { wood: '#e76f51', flower: '#ffffff', skirt: false }, move: lap(6, 0.9, 0), scale: 1.2 },
  { dino: { kind: 'rex', skin: '#3fa66b', accent: '#e8462e' }, move: lap(6, 0.9, -0.6), scale: 1.8 },
  // ...and a tiny triceratops running the wrong way
  { dino: { kind: 'tri', skin: '#f2a65a', accent: '#2f6fd6' }, move: lap(7.2, -1.2, 2), scale: 1.2 },
  // hula dancers by the volcano
  { dino: { kind: 'neck', skin: '#5fc9a8', accent: '#ff4fa3', skirt: true, flower: '#ffd23f' }, move: hula(0.5, -5.5, Math.PI * 0.9) },
  { dino: { kind: 'rex', skin: '#7fb2ff', accent: '#ff7a3d', skirt: true }, move: hula(3, -6.2, Math.PI) },
  { monster: { wood: '#9b5de5', leaf: '#7cc95a' }, move: hula(5.5, -5.6, -Math.PI * 0.9), scale: 1.3 },
  // fire twirler on the east lawn
  { monster: { wood: '#7a4a2c', torch: true, flower: '#ff7a3d' }, move: twirl(14, -2), scale: 1.4 },
  // stompers on the south-west lawn
  { monster: { wood: '#a0673f' }, move: stomp(-14, 8, 0.6), scale: 1.5, seed: 1 },
  // coconut toss pair on the far west lawn
  { dino: { kind: 'tri', skin: '#8fd14f', accent: '#ff4fa3' }, move: stomp(-15.5, -3, Math.PI), seed: 2 },
  { monster: { wood: '#c4874f', leaf: '#3f9b4a' }, move: stomp(-15.5, -9.5, 0), scale: 1.3, seed: 3 },
  // picnic 1 (east): two dinos snacking
  { dino: { kind: 'rex', skin: '#ff8fb0', accent: '#ffd23f' }, move: sit(8.6, -4.2, -0.3), seed: 4 },
  { dino: { kind: 'neck', skin: '#b48be0', accent: '#5fc9a8' }, move: sit(10.4, -2, -2.2), seed: 5 },
  // picnic 2 (north-west): a monster and the marshmallow roaster facing the volcano
  { monster: { wood: '#3fb6a8', leaf: '#ff7a3d', skirt: false }, move: sit(-8.4, 6.2, 2.4), scale: 1.2, seed: 6 },
  { dino: { kind: 'tri', skin: '#e6c84f', accent: '#e8462e' }, move: sit(-6.2, 7.4, 1.9), seed: 7, marshmallow: true },
]

// a stick with a marshmallow that keeps bursting into flames
function Marshmallow() {
  const fire = useRef()
  const puff = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % 7
    const on = t > 4.5
    fire.current.visible = on
    fire.current.scale.setScalar(on ? 0.9 + Math.sin(clock.elapsedTime * 30) * 0.2 : 1)
    puff.current.material = on ? mat('#3a2a1a') : mat('#fff8ee')
  })
  return (
    <group position={[0.18, 0.42, 0.25]} rotation={[0.9, 0, 0]}>
      <mesh geometry={G.cyl} material={mat('#8a5a32')} scale={[0.008, 0.6, 0.008]} position={[0, 0.3, 0]} />
      <mesh ref={puff} geometry={G.cyl} material={mat('#fff8ee')} scale={[0.035, 0.07, 0.035]} position={[0, 0.62, 0]} />
      <mesh ref={fire} geometry={CONE} material={mat('#ff7a1a', 1.6)} scale={[0.045, 0.12, 0.045]} position={[0, 0.72, 0]} rotation={[-0.9, 0, 0]} />
    </group>
  )
}

// ---------- the volcano
const N_PUFFS = 14
const N_BLOBS = 40
const BLOBS = (() => {
  const r = rand(77)
  return Array.from({ length: N_BLOBS }, (_, i) => {
    const ang = r() * Math.PI * 2
    const sp = 1.5 + r() * 4.5
    const vy = 7 + r() * 5
    const launch = (i / N_BLOBS) * ERUPT * 0.85
    const land = (vy + Math.sqrt(vy * vy + 4 * 4.9 * VH)) / 9.8
    return { vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp, vy, launch, land, size: 0.2 + r() * 0.25 }
  })
})()

function Volcano() {
  const mountain = useRef()
  const light = useRef()
  const crater = useRef()
  const puffs = useRef([])
  const blobs = useRef([])

  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(1.15, 4.2, VH, 30, 8)
    const p = g.attributes.position
    const r = rand(9)
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      if (Math.abs(y) < VH / 2 - 0.01) {
        const k = 1 + (r() - 0.5) * 0.12
        p.setX(i, p.getX(i) * k)
        p.setZ(i, p.getZ(i) * k)
      }
    }
    g.computeVertexNormals()
    return g
  }, [])
  const rock = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4a3a', roughness: 0.95, flatShading: true }), [])
  const smoke = useMemo(() => Array.from({ length: N_PUFFS }, () => new THREE.MeshStandardMaterial({ color: '#eeeeee', transparent: true, depthWrite: false, roughness: 1 })), [])
  const lava = mat('#ff5a1f', 1.4)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const v = volcano(t)
    const erupting = v.mode === 'erupt'
    const rumble = v.mode === 'rumble'
    const shake = erupting ? 0.12 : rumble ? 0.05 : 0
    mountain.current.position.set(VX + Math.sin(t * 41) * shake, 0, VZ + Math.cos(t * 37) * shake)
    light.current.intensity = erupting ? 60 + Math.sin(t * 20) * 20 : rumble ? 15 + Math.sin(t * 9) * 6 : 4 + Math.sin(t * 3) * 1.5
    crater.current.scale.y = erupting ? 1.5 + Math.sin(t * 15) * 0.4 : 1

    // smoke: lazy rings normally, a thick dark column during an eruption
    const heat = erupting ? 1 : rumble ? 0.4 : 0
    puffs.current.forEach((m, i) => {
      if (!m) return
      const P = 6
      const age = (t * (1 + heat * 1.5) + (i * P) / N_PUFFS) % P
      const u = age / P
      m.position.set(VX + Math.sin(i * 2.3 + t * 0.3) * u * 1.5, VH + 0.3 + age * (1.1 + heat * 1.6), VZ + Math.cos(i * 1.7) * u * 1.2)
      m.scale.setScalar((0.35 + u * 1.3) * (1 + heat * 0.9))
      smoke[i].opacity = (1 - u) * (0.55 + heat * 0.35)
      smoke[i].color.setScalar(0.93 - heat * 0.6)
    })

    // lava blobs fly, land, sizzle on the lawn, then fade
    blobs.current.forEach((m, i) => {
      if (!m) return
      const b = BLOBS[i]
      const a = v.c - b.launch
      if (!(a >= 0) || a > b.land + 6) {
        m.visible = false
        return
      }
      m.visible = true
      if (a < b.land) {
        m.position.set(VX + b.vx * a, VH + b.vy * a - 4.9 * a * a, VZ + b.vz * a)
        m.scale.setScalar(b.size)
      } else {
        const fade = Math.min(1, (b.land + 6 - a) / 2)
        m.position.set(VX + b.vx * b.land, 0.03, VZ + b.vz * b.land)
        m.scale.set(b.size * 2 * fade, 0.05 * fade, b.size * 2 * fade)
      }
    })
  })

  return (
    <group>
      <group ref={mountain}>
        <mesh geometry={geo} material={rock} position={[0, VH / 2, 0]} />
        <mesh ref={crater} geometry={G.cyl} material={lava} position={[0, VH, 0]} scale={[1.05, 0.12, 1.05]} />
        {/* lava drips down the sides */}
        {[0, 1.3, 2.5, 3.6, 4.9].map((a, i) => (
          <mesh key={i} geometry={G.sphere} material={lava}
            position={[Math.cos(a) * (1.5 + (i % 2) * 0.35), VH - 0.9 - (i % 3) * 0.3, Math.sin(a) * (1.5 + (i % 2) * 0.35)]}
            rotation={[Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]} scale={[0.16, 0.7, 0.16]} />
        ))}
        <pointLight ref={light} position={[0, VH + 1, 0]} color="#ff7a2a" distance={30} decay={1.5} />
      </group>
      {smoke.map((m, i) => (
        <mesh key={i} ref={(el) => (puffs.current[i] = el)} geometry={G.sphere} material={m} />
      ))}
      {BLOBS.map((_, i) => (
        <mesh key={i} ref={(el) => (blobs.current[i] = el)} geometry={G.sphere} material={lava} visible={false} />
      ))}
    </group>
  )
}

// ---------- spinning sign with a countdown to the next eruption
function CountdownSign({ position }) {
  const board = useRef()
  const last = useRef('')
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return { canvas, tex }
  }, [])
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), [tex])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    board.current.rotation.y = t * 0.5
    const v = volcano(t)
    const s = Math.ceil(v.next)
    const [l1, l2] = v.mode === 'erupt' ? ['ERUPTING!!', 'RUN!!!'] : v.mode === 'rumble' ? ['UH OH...', 'RUMBLING!'] : ['ERUPTION IN', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`]
    const key = l1 + l2
    if (key === last.current) return
    last.current = key
    const c = canvas.getContext('2d')
    c.fillStyle = '#7a4a2c'
    c.fillRect(0, 0, 512, 256)
    c.strokeStyle = '#3a2416'
    c.lineWidth = 6
    for (let y = 40; y < 256; y += 48) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(512, y)
      c.stroke()
    }
    c.lineWidth = 16
    c.strokeStyle = '#ffd23f'
    c.strokeRect(8, 8, 496, 240)
    c.textAlign = 'center'
    c.fillStyle = '#fff3c4'
    c.font = 'bold 54px Georgia, serif'
    c.fillText(l1, 256, 105)
    c.fillStyle = v.mode === 'calm' ? '#ffd23f' : '#ff5a1f'
    c.font = 'bold 84px Georgia, serif'
    c.fillText(l2, 256, 200)
    tex.needsUpdate = true
  })
  return (
    <group position={position}>
      <mesh geometry={G.cyl} material={mat('#5a3a22')} position={[0, 1.1, 0]} scale={[0.08, 2.2, 0.08]} />
      <group ref={board} position={[0, 2.5, 0]}>
        <mesh geometry={G.box} material={mat('#5a3a22')} scale={[2.1, 1.05, 0.06]} />
        <mesh material={face} position={[0, 0, 0.035]}>
          <planeGeometry args={[2, 1]} />
        </mesh>
        <mesh material={face} position={[0, 0, -0.035]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[2, 1]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------- props
function Torch({ position }) {
  const flame = useRef()
  const seed = position[0] * 3.1 + position[2]
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed
    flame.current.scale.set(1 + Math.sin(t * 17) * 0.12, 1 + Math.sin(t * 11) * 0.25, 1 + Math.cos(t * 13) * 0.12)
  })
  return (
    <group position={position}>
      <mesh geometry={G.cyl} material={mat('#6b4426')} position={[0, 1, 0]} scale={[0.06, 2, 0.06]} />
      {[0.5, 1.0, 1.5].map((y) => (
        <mesh key={y} geometry={G.cyl} material={mat(STRAW)} position={[0, y, 0]} scale={[0.075, 0.06, 0.075]} />
      ))}
      <mesh geometry={G.cyl} material={mat('#3a2416')} position={[0, 2.08, 0]} scale={[0.14, 0.18, 0.14]} />
      <group ref={flame} position={[0, 2.2, 0]}>
        <mesh geometry={CONE} material={mat('#ff6a1a', 1.5)} position={[0, 0.2, 0]} scale={[0.14, 0.42, 0.14]} />
        <mesh geometry={CONE} material={mat('#ffd23f', 1.8)} position={[0, 0.14, 0]} scale={[0.08, 0.26, 0.08]} />
      </group>
    </group>
  )
}

function Totem({ position, rotation = 0 }) {
  const faces = useMemo(() => [
    monsterParts({ wood: '#7a4a2c', skirt: false }),
    monsterParts({ wood: '#a0673f', skirt: false, leaf: '#ff7a3d' }),
    monsterParts({ wood: '#c4874f', skirt: false, leaf: '#ffd23f' }),
  ], [])
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={1.3}>
      {faces.map((p, i) => (
        <group key={i} position={[0, i * 1.15, 0]} scale={[1, 0.85, 1]}>
          <Parts parts={p.filter((x) => x.bucket !== 'cone' || i === 2)} />
        </group>
      ))}
    </group>
  )
}

function checkerTex(a, b) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.fillStyle = (i + j) % 2 ? a : b
    x.fillRect(i * 8, j * 8, 8, 8)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
}

const WEDGE = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI / 3)

function Picnic({ position, rotation = 0, colors }) {
  const blanket = useMemo(() => new THREE.MeshStandardMaterial({ map: checkerTex(...colors), roughness: 1 }), [colors])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={G.box} material={blanket} position={[0, 0.02, 0]} scale={[3.4, 0.03, 2.6]} />
      {/* pineapple */}
      <group position={[-0.9, 0, 0.5]}>
        <mesh geometry={G.sphere} material={mat('#e6b43a')} position={[0, 0.3, 0]} scale={[0.2, 0.28, 0.2]} />
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} geometry={CONE} material={mat(LEAF)} position={[0, 0.66, 0]} rotation={[Math.cos(i * 1.26) * 0.4, 0, Math.sin(i * 1.26) * 0.4]} scale={[0.05, 0.3, 0.03]} />
        ))}
      </group>
      {/* watermelon slices */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0.2 + i * 0.35, 0.08, -0.6]} rotation={[Math.PI / 2, 0, 0.5 + i]}>
          <mesh geometry={WEDGE} material={mat('#ff4f5e')} scale={[0.32, 0.08, 0.32]} />
          <mesh geometry={WEDGE} material={mat('#2f8a3a')} scale={[0.34, 0.07, 0.34]} />
        </group>
      ))}
      {/* coconut drinks with straws and paper umbrellas */}
      {[[0.9, 0.5, '#ff4fa3'], [0.4, 0.8, '#2f6fd6'], [-0.3, -0.2, '#ffd23f']].map(([x, z, u], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={G.sphere} material={mat('#6b4426')} position={[0, 0.14, 0]} scale={0.15} />
          <mesh geometry={G.cyl} material={mat('#ffffff')} position={[0.04, 0.33, 0]} rotation={[0, 0, -0.3]} scale={[0.012, 0.3, 0.012]} />
          <mesh geometry={G.cyl} material={mat('#5a3a22')} position={[-0.05, 0.38, 0]} rotation={[0, 0, 0.25]} scale={[0.008, 0.4, 0.008]} />
          <mesh geometry={CONE} material={mat(u)} position={[-0.1, 0.6, 0]} rotation={[0, 0, 0.25]} scale={[0.17, 0.08, 0.17]} />
        </group>
      ))}
    </group>
  )
}

function BeachBall() {
  const ref = useRef()
  const material = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const x = c.getContext('2d')
    const cols = ['#ff4f5e', '#ffffff', '#2f6fd6', '#ffffff', '#ffd23f', '#ffffff']
    cols.forEach((col, i) => {
      x.fillStyle = col
      x.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 64)
    })
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 })
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const p = panicOf(volcano(t))
    ref.current.position.set(
      2 + 9 * Math.sin(t * 0.37) + 4 * Math.sin(t * 1.13),
      0.45 + Math.abs(Math.sin(t * 2.6)) * (2.2 + p * 3),
      1 + 7 * Math.sin(t * 0.29 + 1) + 3 * Math.cos(t * 0.91),
    )
    ref.current.rotation.set(t * 2.1, t * 1.3, 0)
  })
  return <mesh ref={ref} geometry={G.sphere} material={material} scale={0.45} />
}

// ---------- the whole party
export default function TikiParty({ y = -5 }) {
  const cast = useMemo(() => CAST.map((c) => ({ ...c, parts: c.dino ? dinoParts(c.dino) : monsterParts(c.monster) })), [])
  const torches = [[-15, -12], [-16, 0], [-15, 12], [-4, 14.5], [8, 15], [16, 10], [17, -6], [9, -14], [-4, -15], [-1, -3.5], [9, 9.5]]
  return (
    <group position={[0, y, 0]}>
      <Volcano />
      <CountdownSign position={[-3, 0, 8.5]} />
      {torches.map(([x, z], i) => (
        <Torch key={i} position={[x, 0, z]} />
      ))}
      <Totem position={[-14.5, 0, 11]} rotation={2.3} />
      <Picnic position={[9.4, 0, -3.2]} rotation={0.3} colors={['#e8462e', '#fff3e6']} />
      <Picnic position={[-7.4, 0, 6.6]} rotation={-0.4} colors={['#2f6fd6', '#fff3e6']} />
      {cast.map((c, i) => (
        <Actor key={i} parts={c.parts} move={c.move} scale={c.scale ?? 1.6} seed={c.seed ?? i * 0.7}>
          {c.marshmallow && <Marshmallow />}
        </Actor>
      ))}
      <TossBall from={[-15.5, -3]} to={[-15.5, -9.5]} height={1.6} color="#6b4426" />
      <BeachBall />
    </group>
  )
}
