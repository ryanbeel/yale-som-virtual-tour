import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RyanJr } from './Allison.jsx'
import { GEO as DINO_GEO, dinoParts } from './TikiParty.jsx'
import { textBubble } from './Concert.jsx'
import { T, press } from './donotpress.js'
import { useTalkable } from './talkable.js'
import { BUTTON, GIANT, heightAt, inland } from './island.js'

// DO NOT PRESS. A big red button on the south beach. Press it and, over 30 seconds: alarms, the sea
// boils, a 30-meter Ryan Jr. rises out of the ocean, shakes off like a wet cat (raining hundreds of
// mini clones onto the beach), sneezes so hard every cat on the island goes flying, purrs under a
// giant rainbow, and sinks back into the sea. (The HUD banners and screen shake live in App.)

export const BUTTON_PROF = {
  id: 'do-not-press',
  name: 'the button',
  action: () => press.start(),
  hint: 'Click the button… if you dare 😈',
  talk: 'PRESS IT 😈',
}

const SPH = new THREE.SphereGeometry(1, 14, 10)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const CONE = new THREE.ConeGeometry(1, 1, 14)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const GIANT_SCALE = 92
const GIANT_H = 0.62 * GIANT_SCALE // ~57 m from paws to ear tips
const SUNK = -GIANT_H - 6 // fully hidden under the sea floor
const UP = -4 // standing in the sea
const N_MINI = 160
const N_BUBBLES = 40
const N_DROPS = 60
const N_WIND = 70

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }))
  return mats.get(k)
}
const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (v) => {
  const x = clamp01(v)
  return x * x * (3 - 2 * x)
}

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function DoNotPress() {
  useEffect(() => () => press.reset(), []) // leaving the island ends the event
  useFrame(() => press.tick())
  return (
    <>
      <Button />
      <SeaBoil />
      <Giant />
      <MiniClones />
      <Sneeze />
      <Rainbow />
      <DinoPanic />
    </>
  )
}

// ---------- the button: hazard-striped pedestal, glass flip cover, a sign, and alarm beacons
function Button() {
  const y = heightAt(BUTTON.x, BUTTON.z)
  const position = useMemo(() => [BUTTON.x, y, BUTTON.z], [y])
  const rotation = Math.PI // sign faces north, toward people coming from the plaza
  const root = useRef()
  const hit = useRef()
  const cover = useRef()
  const knob = useRef()
  const beacons = useRef([])
  const alarm = useRef()
  useTalkable(BUTTON_PROF, { position, rotation, root, hit, sway: 0, anyRoom: true })
  const stripes = useMemo(() => {
    const t = canvasTex(128, 128, (g) => {
      g.fillStyle = '#ffd23f'
      g.fillRect(0, 0, 128, 128)
      g.fillStyle = '#1d1d22'
      for (let i = -128; i < 256; i += 32) {
        g.beginPath()
        g.moveTo(i, 0)
        g.lineTo(i + 16, 0)
        g.lineTo(i + 16 + 128, 128)
        g.lineTo(i + 128, 128)
        g.fill()
      }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(3, 1)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })
  }, [])
  const signMats = useMemo(() => {
    const make = (l1, l2) =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(768, 384, (g, w, h) => {
          g.fillStyle = '#d62839'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#ffffff'
          g.lineWidth = 20
          g.strokeRect(14, 14, w - 28, h - 28)
          g.fillStyle = '#ffffff'
          g.textAlign = 'center'
          g.font = 'bold 140px "Arial Black", Impact, sans-serif'
          g.fillText(l1, w / 2, 190)
          g.font = 'bold 54px system-ui, sans-serif'
          g.fillText(l2, w / 2, 300)
        }),
      })
    return { idle: make('DO NOT', 'PRESS. seriously.'), used: make('DO NOT', 'PRESS. AGAIN?!') }
  }, [])
  const sign = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const e = press.t()
    const on = e >= 0
    cover.current.rotation.x = on ? -1.7 : -0.0
    knob.current.position.y = 1.32 - (on && e < 0.4 ? 0.06 : 0)
    knob.current.material.emissiveIntensity = on ? 0.4 : 0.6 + Math.sin(t * 4) * 0.4
    const spin = on && e < T.RISEN
    beacons.current.forEach((b, i) => b && (b.rotation.y = spin ? t * 9 + i * Math.PI : 0))
    alarm.current.intensity = spin ? 25 + Math.sin(t * 18) * 20 : 0
    sign.current.material = press.get().presses > 0 ? signMats.used : signMats.idle
  })
  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      <mesh ref={hit} geometry={CYL} position={[0, 1, 0]} scale={[0.9, 2, 0.9]} visible={false} />
      <mesh geometry={CYL} material={stripes} position={[0, 0.55, 0]} scale={[0.55, 1.1, 0.55]} />
      <B g={CYL} c="#1d1d22" p={[0, 1.13, 0]} s={[0.62, 0.08, 0.62]} />
      <B g={CYL} c="#3a3a40" o={{ metalness: 0.6 }} p={[0, 1.2, 0]} s={[0.36, 0.08, 0.36]} />
      <mesh ref={knob} geometry={SPH} position={[0, 1.32, 0]} scale={[0.3, 0.16, 0.3]}>
        <meshStandardMaterial color="#e8222e" emissive="#e8222e" emissiveIntensity={0.6} roughness={0.3} />
      </mesh>
      {/* hinged glass cover (flips open when pressed) */}
      <group ref={cover} position={[0, 1.18, -0.38]}>
        <mesh position={[0, 0.12, 0.38]} scale={[0.4, 0.22, 0.4]}>
          <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#bff6ff" transparent opacity={0.35} roughness={0.05} depthWrite={false} />
        </mesh>
      </group>
      {/* the sign */}
      <B g={CYL} c="#5a3a22" p={[0.95, 1.2, 0.12]} s={[0.05, 2.4, 0.05]} />
      <mesh ref={sign} material={signMats.idle} position={[0.95, 2.3, 0.23]}>
        <planeGeometry args={[1.5, 0.75]} />
      </mesh>
      {/* alarm beacons */}
      {[-1, 1].map((sx, i) => (
        <group key={sx} position={[0.95 + sx * 0.55, 2.82, 0.2]}>
          <B g={CYL} c="#3a3a40" p={[0, -0.06, 0]} s={[0.1, 0.06, 0.1]} />
          <group ref={(el) => (beacons.current[i] = el)}>
            <B c="#ff2a2a" o={{ emissive: '#ff2a2a', emissiveIntensity: 1.5 }} p={[0, 0.06, 0]} s={[0.09, 0.11, 0.09]} />
            <B g={CONE} c="#ff5a5a" o={{ emissive: '#ff2a2a', emissiveIntensity: 2, transparent: true, opacity: 0.6 }} p={[0.25, 0.06, 0]} r={[0, 0, Math.PI / 2]} s={[0.12, 0.4, 0.12]} />
          </group>
        </group>
      ))}
      <pointLight ref={alarm} color="#ff2a2a" intensity={0} distance={16} decay={1.3} position={[0.95, 3, 0.2]} />
    </group>
  )
}

// ---------- the sea boils where the giant is about to come up
function SeaBoil() {
  const bubbles = useRef()
  const ring = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const data = useMemo(() => {
    const r = rand(3)
    return Array.from({ length: N_BUBBLES }, () => ({ a: r() * Math.PI * 2, d: Math.sqrt(r()) * 22, p: 0.6 + r() * 0.9, o: r() * 2, s: 0.5 + r() * 1.3 }))
  }, [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }), [])
  useFrame(() => {
    const e = press.t()
    const on = e >= T.BOIL && e < T.SINK + 3
    const k = smooth((e - T.BOIL) / 3) * (1 - smooth((e - T.SINK) / 3))
    data.forEach((b, i) => {
      if (!on) tmp.scale.setScalar(0)
      else {
        const u = ((e + b.o) % b.p) / b.p // each bubble rises, swells and pops
        tmp.position.set(GIANT.x + Math.cos(b.a) * b.d, 0.1 + u * 0.8, GIANT.z + Math.sin(b.a) * b.d)
        tmp.scale.setScalar(b.s * k * (0.4 + u))
      }
      tmp.updateMatrix()
      bubbles.current.setMatrixAt(i, tmp.matrix)
    })
    bubbles.current.instanceMatrix.needsUpdate = true
    ring.current.visible = on
    ring.current.scale.setScalar(8 + k * 22 + Math.sin(e * 3) * 1.5)
    ringMat.opacity = 0.55 * k
  })
  return (
    <>
      <instancedMesh ref={bubbles} args={[SPH, m('#eaffff', { transparent: true, opacity: 0.85 }), N_BUBBLES]} frustumCulled={false} />
      <mesh ref={ring} material={ringMat} position={[GIANT.x, 0.12, GIANT.z]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.85, 1, 64]} />
      </mesh>
    </>
  )
}

// ---------- GIANT RYAN JR.
export function giantPose(e) {
  // how high he's risen (0 underwater .. 1 standing), plus head tilt and shake
  const rise = smooth((e - T.RISE) / (T.RISEN - T.RISE)) * (1 - smooth((e - T.SINK) / (T.END - T.SINK)))
  const shake = e >= T.SHAKE && e < T.AHH ? Math.sin(e * 38) * 0.22 * Math.sin(((e - T.SHAKE) / (T.AHH - T.SHAKE)) * Math.PI) : 0
  let tilt = 0
  if (e >= T.AHH && e < T.SNEEZE) tilt = -0.35 * smooth((e - T.AHH) / (T.SNEEZE - T.AHH)) // head back... ah... ahh...
  else if (e >= T.SNEEZE && e < T.SNEEZE + 1.5) tilt = 0.4 * Math.sin(((e - T.SNEEZE) / 1.5) * Math.PI) // CHOO!
  return { rise, shake, tilt }
}

function Giant() {
  const root = useRef()
  const body = useRef()
  const bubble = useRef()
  const drops = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const dropData = useMemo(() => {
    const r = rand(8)
    return Array.from({ length: N_DROPS }, () => ({ x: (r() - 0.5) * 36, z: (r() - 0.5) * 22, y: 12 + r() * 38, p: 0.8 + r() * 0.8, o: r() }))
  }, [])
  const lines = useMemo(
    () => ({
      mrrow: textBubble('MRRROW?', '#1d1d22'),
      ahh: textBubble('ah… ahh… AHHH…', '#1d1d22'),
      choo: textBubble('ACHOO!!!', '#d62839'),
      purr: textBubble('purrrrrrr 😸', '#ff4fa3'),
    }),
    [],
  )
  useFrame(() => {
    const e = press.t()
    const on = e >= T.RISE - 0.5 && e < T.END
    root.current.visible = on
    if (!on) {
      drops.current.visible = false
      return
    }
    const { rise, shake, tilt } = giantPose(e)
    root.current.position.set(GIANT.x, SUNK + rise * (UP - SUNK), GIANT.z)
    body.current.rotation.set(tilt, 0, shake)
    // speech
    let line = null
    if (e >= 9.5 && e < 12.8) line = lines.mrrow
    else if (e >= T.AHH && e < T.SNEEZE) line = lines.ahh
    else if (e >= T.SNEEZE && e < T.SNEEZE + 2.2) line = lines.choo
    else if (e >= 22.5 && e < T.SINK + 0.5) line = lines.purr
    bubble.current.visible = !!line
    if (line) bubble.current.material = line
    // water pouring off him as he rises and shakes
    const wet = e < T.AHH
    drops.current.visible = wet
    dropData.forEach((d, i) => {
      const u = ((e + d.o) % d.p) / d.p
      tmp.position.set(GIANT.x + d.x * (1 + (shake ? 0.6 : 0)), SUNK + rise * (UP - SUNK) + d.y * (1 - u), GIANT.z + d.z)
      tmp.scale.setScalar(wet ? 0.6 + (1 - u) * 0.6 : 0)
      tmp.updateMatrix()
      drops.current.setMatrixAt(i, tmp.matrix)
    })
    drops.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <group ref={root} rotation={[0, Math.PI, 0]} visible={false}>
        {/* pivot at the waist so he can lean back and snap forward for the sneeze */}
        <group ref={body} position={[0, 22, 0]}>
          <group position={[0, -22, 0]} scale={GIANT_SCALE}>
            <RyanJr />
          </group>
        </group>
        <sprite ref={bubble} position={[0, GIANT_H + 10, 0]} scale={[38, 18, 1]} visible={false} />
      </group>
      <instancedMesh ref={drops} args={[SPH, m('#d8f6ff', { transparent: true, opacity: 0.8 }), N_DROPS]} frustumCulled={false} />
    </>
  )
}

// ---------- hundreds of mini clones flung onto the beach (simple 7-part cats, instanced)
const MINI_PARTS = [
  ['sphere', [0, 0.24, -0.02], [0.12, 0.11, 0.2], '#1d1d22'],
  ['sphere', [0, 0.21, 0.08], [0.085, 0.09, 0.1], '#f6f4ef'],
  ['sphere', [0, 0.42, 0.15], [0.1, 0.09, 0.09], '#1d1d22'],
  ['sphere', [0, 0.385, 0.21], [0.055, 0.042, 0.04], '#f6f4ef'],
  ['cone', [-0.06, 0.505, 0.15], [0.035, 0.07, 0.025], '#1d1d22'],
  ['cone', [0.06, 0.505, 0.15], [0.035, 0.07, 0.025], '#1d1d22'],
  ['sphere', [0, 0.36, -0.26], [0.03, 0.09, 0.03], '#1d1d22'],
  ['cyl', [0, 0.33, 0.12], [0.065, 0.02, 0.065], '#d62839'],
]
const MINI_GEO = { sphere: SPH, cone: CONE, cyl: CYL }

// sneeze launch: every cat goes up in slow motion and spins (also used by IslandCats)
export function sneezeLift(e, seed) {
  const s = (e - T.SNEEZE) * 0.55 // slow motion
  if (s < 0 || s > 2.6) return null
  const vy = 7 + (seed % 1) * 6
  const y = Math.max(0, vy * s - 4.9 * 0.55 * s * s * 2)
  return { y, spin: s * (4 + (seed % 1) * 6) }
}

function MiniClones() {
  const meshes = useRef([])
  const minis = useMemo(() => {
    const r = rand(77)
    const out = []
    while (out.length < N_MINI) {
      // land somewhere on the south beach / plaza, within ~24 m of the button
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * 24
      const x = BUTTON.x + Math.cos(a) * d
      const z = BUTTON.z - 8 + Math.sin(a) * d
      if (inland(x, z) < 1) continue
      out.push({
        to: [x, z],
        from: [GIANT.x + (r() - 0.5) * 26, 26 + r() * 22, GIANT.z - 8 + (r() - 0.5) * 10],
        launch: T.SHAKE + 0.3 + r() * 3.2,
        flight: 2 + r() * 1.2,
        yaw: r() * Math.PI * 2,
        seed: r(),
        hop: r() * 3,
      })
    }
    return out
  }, [])
  const root = useMemo(() => new THREE.Matrix4(), [])
  const local = useMemo(() => MINI_PARTS.map(([, p, s]) => new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(...s))), [])
  const V = useMemo(() => new THREE.Vector3(), [])
  const Q = useMemo(() => new THREE.Quaternion(), [])
  const E = useMemo(() => new THREE.Euler(), [])
  const S = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Matrix4(), [])
  const zero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6 }), [])
  useEffect(() => {
    const c = new THREE.Color()
    meshes.current.forEach((mesh, k) => {
      for (let i = 0; i < N_MINI; i++) mesh.setColorAt(i, c.set(MINI_PARTS[k][3]))
      mesh.instanceColor.needsUpdate = true
    })
  }, [])
  useFrame(() => {
    const e = press.t()
    minis.forEach((c, i) => {
      const a = e - c.launch
      let visible = e >= 0 && a >= 0 && e < T.END - 0.3
      if (visible) {
        let x
        let y
        let z
        let spin = 0
        if (a < c.flight) {
          // flung through the air from the giant's fur
          const u = a / c.flight
          x = c.from[0] + (c.to[0] - c.from[0]) * u
          z = c.from[2] + (c.to[1] - c.from[2]) * u
          y = c.from[1] + (heightAt(c.to[0], c.to[1]) - c.from[1]) * u + Math.sin(u * Math.PI) * 14
          spin = a * 7
        } else {
          x = c.to[0]
          z = c.to[1]
          y = heightAt(x, z) + Math.abs(Math.sin((e + c.hop) * 5)) * 0.15 // happy little hops
          const lift = sneezeLift(e, c.seed)
          if (lift) {
            y += lift.y
            spin = lift.spin
          }
        }
        const poof = clamp01((T.END - 0.3 - e) / 0.8) // shrink away at the very end
        root.compose(V.set(x, y, z), Q.setFromEuler(E.set(spin, c.yaw + spin * 0.5, spin * 0.3)), S.setScalar(1.3 * poof))
      }
      local.forEach((lm, k) => meshes.current[k].setMatrixAt(i, visible ? tmp.multiplyMatrices(root, lm) : zero))
    })
    meshes.current.forEach((mesh) => (mesh.instanceMatrix.needsUpdate = true))
  })
  return MINI_PARTS.map(([g], k) => <instancedMesh key={k} ref={(el) => (meshes.current[k] = el)} args={[MINI_GEO[g], mat, N_MINI]} frustumCulled={false} />)
}

// ---------- ACHOO: a shockwave rolls across the island with a blast of wind
function Sneeze() {
  const rings = useRef([])
  const wind = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const ringMats = useMemo(() => ['#ffffff', '#bff6ff'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })), [])
  const windData = useMemo(() => {
    const r = rand(12)
    return Array.from({ length: N_WIND }, () => ({ x: (r() - 0.5) * 60, y: 1 + r() * 18, o: r() * 0.6, v: 70 + r() * 40 }))
  }, [])
  useFrame(() => {
    const e = press.t()
    const a = e - T.SNEEZE
    rings.current.forEach((r, i) => {
      if (!r) return
      const u = a - i * 0.25
      r.visible = u >= 0 && u < 2.4
      r.scale.setScalar(4 + u * 110)
      ringMats[i].opacity = 0.85 * (1 - u / 2.4)
    })
    windData.forEach((w, i) => {
      const u = a - w.o
      if (u >= 0 && u < 1.8) {
        tmp.position.set(GIANT.x + w.x, w.y, GIANT.z - 10 - u * w.v)
        tmp.scale.set(0.12, 0.12, 4 + u * 3)
      } else tmp.scale.setScalar(0)
      tmp.updateMatrix()
      wind.current.setMatrixAt(i, tmp.matrix)
    })
    wind.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      {ringMats.map((mt, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} material={mt} position={[GIANT.x, 0.6 + i * 3, GIANT.z - 6]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.9, 1, 96]} />
        </mesh>
      ))}
      <instancedMesh ref={wind} args={[BOX, m('#ffffff', { transparent: true, opacity: 0.7 }), N_WIND]} frustumCulled={false} />
    </>
  )
}

// ---------- a giant rainbow over him after the sneeze
const RAINBOW = ['#ff3b3b', '#ff9a2e', '#ffe23b', '#4cd964', '#2fa8ff', '#5a5aff', '#b04bff']
function Rainbow() {
  const group = useRef()
  const mats2 = useMemo(() => RAINBOW.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, fog: false })), [])
  useFrame(() => {
    const e = press.t()
    const k = smooth((e - (T.SNEEZE + 1)) / 2.5) * (1 - smooth((e - (T.END - 1.8)) / 1.6))
    group.current.visible = k > 0.001
    mats2.forEach((mt) => (mt.opacity = 0.75 * k))
  })
  return (
    <group ref={group} position={[GIANT.x, -6, GIANT.z + 22]} visible={false}>
      {RAINBOW.map((c, i) => (
        <mesh key={c} material={mats2[i]}>
          <torusGeometry args={[78 - i * 3.2, 1.7, 8, 96, Math.PI]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- a stampede of panicking dinosaurs: they flood the beach when the giant rises, run for
// their lives in every direction, then get launched sky-high by the sneeze and land dazed.
const N_PANIC = 30
const PANIC_LINES = [
  'RUN!!!', 'GIANT CAT!!!', 'HELP!!!', "I'm too young to be extinct!", 'WHERE IS THE EXIT?!',
  'Every dino for themselves!', 'MOMMY!!!', 'Not again!!', 'Who pressed the button?!', 'I KNEW IT. I KNEW IT.',
  'Is it friendly?! IS IT?!', 'Hide behind the palm tree!', 'AAAAAAAAH!', 'Call the shark!!',
]
const LANDED_LINES = ['@_@', "...I'm okay!", 'Again! AGAIN!', 'Best day ever??', 'My tail is in a tree', 'ow.']

function DinoPanic() {
  const meshes = useRef({})
  const sprites = useRef([])
  const said = useRef([])
  const dinos = useMemo(() => {
    const r = rand(404)
    const kinds = ['rex', 'tri', 'neck']
    const skins = ['#6cc46a', '#4fb3c9', '#ff8fb0', '#b48be0', '#e6c84f', '#f2a65a', '#5fc9a8', '#7fb2ff', '#8fd14f', '#3fa66b']
    const accents = ['#ff4fa3', '#ffd23f', '#2ec4a6', '#7a4fd1', '#ff7a3d']
    const spot = () => {
      for (;;) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * 26
        const x = BUTTON.x + Math.cos(a) * d
        const z = BUTTON.z - 10 + Math.sin(a) * d
        if (inland(x, z) > 1) return [x, z]
      }
    }
    return Array.from({ length: N_PANIC }, (_, i) => {
      // a precomputed zig-zag escape route (random waypoints a second apart)
      const route = [spot()]
      for (let k = 0; k < 14; k++) route.push(spot())
      return {
        parts: dinoParts({ kind: kinds[i % 3], skin: skins[Math.floor(r() * skins.length)], accent: accents[Math.floor(r() * accents.length)], skirt: r() < 0.3 }),
        appear: T.RISE + r() * 2.5,
        route,
        leg: 0.7 + r() * 0.6, // seconds per zig-zag
        circles: r() < 0.25, // some just run in circles
        cx: route[0][0],
        cz: route[0][1],
        seed: r(),
        push: 14 + r() * 18, // how far the sneeze blows it
        vy: 14 + r() * 9,
        line: Math.floor(r() * PANIC_LINES.length),
      }
    })
  }, [])
  const buckets = useMemo(() => {
    const out = {}
    dinos.forEach((d, i) => d.parts.forEach((p) => (out[p.bucket] ??= []).push({ i, m: p.m, color: p.color })))
    return Object.entries(out)
  }, [dinos])
  const roots = useMemo(() => dinos.map(() => new THREE.Matrix4()), [dinos])
  const shown = useMemo(() => dinos.map(() => false), [dinos])
  const V = useMemo(() => new THREE.Vector3(), [])
  const Q = useMemo(() => new THREE.Quaternion(), [])
  const E = useMemo(() => new THREE.Euler(), [])
  const S = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Matrix4(), [])
  const zero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }), [])
  useEffect(() => {
    const c = new THREE.Color()
    for (const [g, list] of buckets) {
      list.forEach((e, k) => meshes.current[g].setColorAt(k, c.set(e.color)))
      meshes.current[g].instanceColor.needsUpdate = true
    }
  }, [buckets])

  useFrame(() => {
    const e = press.t()
    dinos.forEach((d, i) => {
      shown[i] = e >= d.appear && e < T.END - 0.2
      const sp = sprites.current[i]
      if (!shown[i]) {
        if (sp) sp.visible = false
        return
      }
      const run = Math.min(e, T.SNEEZE) - d.appear
      let x
      let z
      let yaw
      if (d.circles) {
        const a = run * 3.2 + d.seed * 6
        x = d.cx + Math.cos(a) * 2.5
        z = d.cz + Math.sin(a) * 2.5
        yaw = a + Math.PI
      } else {
        const k = Math.min(d.route.length - 2, Math.floor(run / d.leg))
        const u = Math.min(1, run / d.leg - k)
        const [ax, az] = d.route[k]
        const [bx, bz] = d.route[k + 1]
        x = ax + (bx - ax) * u
        z = az + (bz - az) * u
        yaw = Math.atan2(bx - ax, bz - az)
      }
      let y = Math.abs(Math.sin(run * 14 + d.seed * 9)) * 0.35 // frantic little hops
      let pitch = 0
      let roll = Math.sin(run * 14) * 0.25
      let line = PANIC_LINES[(d.line + Math.floor(run / 2.2)) % PANIC_LINES.length]
      let talk = (run + d.seed * 3) % 2.2 < 1.4
      // ACHOO: blown sky-high and away from the giant (north), tumbling in slow motion
      const s = (e - T.SNEEZE) * 0.5
      if (s >= 0) {
        const flight = (2 * d.vy) / 9.8
        const f = Math.min(s, flight)
        z -= d.push * (f / flight)
        x += (d.seed - 0.5) * d.push * 0.5 * (f / flight)
        if (s < flight) {
          y = d.vy * f - 4.9 * f * f
          pitch = s * (5 + d.seed * 6)
          roll = s * 3
          line = 'WAAAAAAH!!!'
          talk = d.seed < 0.5
        } else {
          y = 0
          pitch = 0
          roll = 1.4 // landed in a dazed heap
          line = LANDED_LINES[Math.floor(d.seed * LANDED_LINES.length)]
          talk = true
        }
      }
      y += Math.max(heightAt(x, z), 0)
      roots[i].compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, yaw, roll, 'YXZ')), S.setScalar(1.6))
      if (sp) {
        sp.visible = talk
        if (talk && said.current[i] !== line) {
          said.current[i] = line
          sp.material = textBubble(line, '#d62839')
        }
        sp.position.set(x, y + 2.5, z)
      }
    })
    for (const [g, list] of buckets) {
      const mesh = meshes.current[g]
      list.forEach((en, k) => mesh.setMatrixAt(k, shown[en.i] ? tmp.multiplyMatrices(roots[en.i], en.m) : zero))
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      {buckets.map(([g, list]) => (
        <instancedMesh key={g} ref={(el) => (meshes.current[g] = el)} args={[DINO_GEO[g], mat, list.length]} frustumCulled={false} />
      ))}
      {dinos.map((_, i) => (
        <sprite key={i} ref={(el) => (sprites.current[i] = el)} scale={[2.2, 1.04, 1]} visible={false} />
      ))}
    </>
  )
}
