import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bubbleMat } from './Allison.jsx'
import { SHORE, STAGE, heightAt, inWater } from './island.js'
import { SHARK_APPROACH, SHARK_LAND, SHARK_LEAP, concert, sharkSpot } from './concert.js'
import { textBubble } from './Concert.jsx'
import { T as PRESS, press } from './donotpress.js'
import { GIANT } from './island.js'

// A big cartoon shark. It patrols offshore with its fin above the waves; step into the water and it
// swims straight at you, then circles you, chomping (it's friendly... probably). Faces +z.
// During the concert it breaches behind the stage after the eruption, then makes a giant slow-motion
// leap onto the stage with an electric guitar, rocks out, bows, and leaps back into the sea.

export const sharkPos = { x: 0, z: 85 } // read by the minimap

const SPH = new THREE.SphereGeometry(1, 24, 16)
const CONE = new THREE.ConeGeometry(1, 1, 16)
const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o }))
  return mats.get(k)
}
const B = ({ g = SPH, c, p, s, r = [0, 0, 0] }) => <mesh geometry={g} material={m(c)} position={p} scale={s} rotation={r} />
const GREY = '#71808f'
const BELLY = '#eef2f4'
const bubbles = ['Hi friend!', 'nom nom?', 'just a hug!'].map((t) => bubbleMat(t, '#1d6fa8'))

const ease = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k
const PATROL_R = 80

// the stage stunt: take off just past the beach behind the stage, land front-left of center on stage
// (stage local x -1.3, z 2.1 -> world, since the stage is turned to face east)
const TAKEOFF = { x: -57, z: STAGE.z }
const LAND = { x: STAGE.x + 2.1, z: STAGE.z + 1.3 }
const DECK_Y = () => Math.max(heightAt(STAGE.x, STAGE.z), 0.5) + 0.93
const LEAP_DUR = SHARK_LAND - SHARK_LEAP
const STAND_PITCH = -0.8 // standing on its tail, leaning back like a rock star (face toward the crowd)
const STAGE_SCALE = 0.6
const ROCK_LINES = ["IT'S TIME TO ROCK OUT!!! 🎸", 'SHARK SOLO!!!', 'I CAME FOR THE MOSH PIT!', 'Jaws? More like APPLAUSE!']
// hang time: slow at the top of the arc
const hang = (u) => 0.5 + 4 * (u - 0.5) ** 3 + 0.25 * (u - 0.5)
const N_SPLASH = 24

// where the shark is in its stage stunt right now (null = normal shark life)
function stunt() {
  const { phase, showT, beat, sinceEnd } = concert.timeline()
  if (phase === 'show' && showT >= SHARK_APPROACH && showT < SHARK_LEAP) return { mode: 'approach', u: (showT - SHARK_APPROACH) / (SHARK_LEAP - SHARK_APPROACH), showT, beat }
  if (phase === 'show' && showT >= SHARK_LEAP && showT < SHARK_LAND) return { mode: 'leap', u: (showT - SHARK_LEAP) / LEAP_DUR, showT, beat }
  if (phase === 'show' && showT >= SHARK_LAND) return { mode: 'stage', u: 0, showT, beat }
  if (phase === 'idle' && sinceEnd < LEAP_DUR) return { mode: 'return', u: sinceEnd / LEAP_DUR, showT, beat }
  return null
}

export default function Shark() {
  const { camera } = useThree()
  const root = useRef()
  const tail = useRef()
  const jaw = useRef()
  const bubble = useRef()
  const st = useRef({ x: 0, z: PATROL_R, yaw: Math.PI / 2, orbit: 0, rise: 0 })
  const teeth = useMemo(() => Array.from({ length: 9 }, (_, i) => (i - 4) * 0.09), [])
  const guitar = useRef()
  const stageBubble = useRef()
  const spot = useRef()
  const splash = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const splashDirs = useMemo(() => Array.from({ length: N_SPLASH }, (_, i) => {
    const a = (i / N_SPLASH) * Math.PI * 2
    return [Math.cos(a) * (2 + (i % 3)), 5 + (i % 4) * 1.5, Math.sin(a) * (2 + (i % 3))]
  }), [])

  // white water bursting up where the shark leaves or re-enters the sea
  const updateSplash = (at, t) => {
    const a = t - (at ?? -99)
    splashDirs.forEach((d, i) => {
      if (a >= 0 && a < 1.3) {
        tmp.position.set(TAKEOFF.x + d[0] * a, d[1] * a - 4.9 * a * a, TAKEOFF.z + d[2] * a)
        tmp.scale.setScalar(0.45 * (1 - a / 1.3))
      } else tmp.scale.setScalar(0)
      tmp.updateMatrix()
      splash.current.setMatrixAt(i, tmp.matrix)
    })
    splash.current.instanceMatrix.needsUpdate = true
  }

  const flyStunt = ({ mode, u, showT, beat }, s, t) => {
    const deck = DECK_Y()
    // center height so the tail tip just touches the deck: tail reaches ~3.5 m behind center at full size
    const standY = deck + 3.5 * STAGE_SCALE * Math.sin(-STAND_PITCH) + 0.1
    const g = root.current
    g.rotation.order = 'YXZ'
    bubble.current.visible = false
    tail.current.rotation.y = Math.sin(t * 9) * 0.45
    if (mode === 'approach') {
      // racing in toward the takeoff spot, fin up
      s.x = TAKEOFF.x - 22 * (1 - u)
      s.z = TAKEOFF.z
      g.position.set(s.x, -0.35, s.z)
      g.rotation.set(0, Math.PI / 2, 0)
      g.scale.setScalar(1)
      guitar.current.visible = false
      stageBubble.current.visible = false
      spot.current.intensity = 0
      jaw.current.rotation.x = 0.1
      s.splashAt = undefined
    } else if (mode === 'leap' || mode === 'return') {
      const k = mode === 'leap' ? hang(u) : u
      const [from, to] = mode === 'leap' ? [[TAKEOFF.x, -0.4, TAKEOFF.z], [LAND.x, standY, LAND.z]] : [[LAND.x, standY, LAND.z], [TAKEOFF.x, -0.4, TAKEOFF.z]]
      const x = from[0] + (to[0] - from[0]) * k
      const z = from[2] + (to[2] - from[2]) * k
      const y = from[1] + (to[1] - from[1]) * k + Math.sin(k * Math.PI) * 14
      s.x = x
      s.z = z
      g.position.set(x, y, z)
      const dir = mode === 'leap' ? Math.PI / 2 : -Math.PI / 2
      // nose follows the arc, plus a full barrel roll on the way up to the stage
      const pitch = -Math.cos(k * Math.PI) * 0.9
      g.rotation.set(mode === 'leap' ? pitch + (STAND_PITCH - pitch) * Math.max(0, (u - 0.85) / 0.15) : pitch, dir, mode === 'leap' ? k * Math.PI * 2 : 0)
      const size = mode === 'leap' ? 1 + (STAGE_SCALE - 1) * k : STAGE_SCALE + (1 - STAGE_SCALE) * k
      g.scale.setScalar(size * (1 + Math.sin(k * Math.PI) * 0.5)) // bigger at the top of the arc
      guitar.current.visible = mode === 'leap' ? u > 0.5 : u < 0.5
      jaw.current.rotation.x = 0.5
      stageBubble.current.visible = false
      spot.current.intensity = mode === 'leap' ? 55 : 0
      spot.current.distance = 30
      spot.current.position.set(x + 4, y + 3, z)
      sharkSpot.x = x
      sharkSpot.y = y
      sharkSpot.z = z
      if (s.splashAt === undefined && mode === 'leap') s.splashAt = t // takeoff splash
      if (mode === 'return' && u > 0.95 && !s.returned) {
        s.splashAt = t
        s.returned = true
      }
      if (mode === 'leap') s.returned = false
    } else {
      // on stage: standing on its tail, head-banging with the guitar under a spotlight
      const bowing = Math.min(1, Math.max(0, (showT - 87.5) * 2)) * 0.6
      g.position.set(LAND.x, standY + Math.abs(Math.sin(beat * Math.PI)) * 0.25, LAND.z)
      g.rotation.set(STAND_PITCH + Math.abs(Math.sin(beat * Math.PI)) * 0.22 + bowing, Math.PI / 2 + Math.sin(beat * Math.PI * 0.5) * 0.25, Math.sin(beat * Math.PI) * 0.1)
      g.scale.setScalar(STAGE_SCALE)
      guitar.current.visible = true
      guitar.current.rotation.y = 0.7 + Math.sin(beat * Math.PI * 4) * 0.06
      jaw.current.rotation.x = 0.2 + Math.abs(Math.sin(t * 7)) * 0.35
      spot.current.intensity = 40
      spot.current.distance = 14
      spot.current.position.set(LAND.x + 3, standY + 4, LAND.z)
      sharkSpot.x = LAND.x
      sharkSpot.y = standY
      sharkSpot.z = LAND.z
      stageBubble.current.visible = (showT - SHARK_LAND) % 6 < 4
      stageBubble.current.material = textBubble(ROCK_LINES[Math.floor((showT - SHARK_LAND) / 6) % ROCK_LINES.length], '#1d6fa8')
      stageBubble.current.position.set(LAND.x, standY + 3.4, LAND.z)
      s.splashAt = s.splashAt ?? -99
    }
    sharkPos.x = s.x
    sharkPos.z = s.z
    updateSplash(s.splashAt, t)
  }

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const s = st.current
    const st8 = stunt()
    if (st8) {
      flyStunt(st8, s, t)
      return
    }
    guitar.current.visible = false
    stageBubble.current.visible = false
    spot.current.intensity = 0
    root.current.scale.setScalar(1)
    updateSplash(s.splashAt, t)
    const px = camera.position.x
    const pz = camera.position.z
    const hunting = inWater(px, pz)
    const close = hunting && Math.hypot(px - s.x, pz - s.z) < 9
    const party = !hunting && concert.timeline().erupt >= 0
    let tx
    let tz
    let speed
    if (hunting) {
      const d = Math.hypot(px - s.x, pz - s.z)
      if (d > 7.5) {
        tx = px
        tz = pz
        speed = 7
        s.orbit = Math.atan2(s.z - pz, s.x - px)
      } else {
        // slowly circle the swimmer, staying in front of them
        s.orbit += dt * 0.35
        tx = px + Math.cos(s.orbit) * 6.5
        tz = pz + Math.sin(s.orbit) * 6.5
        speed = 2.5
      }
    } else if (press.t() >= 4) {
      // something big is happening out there... go look
      tx = GIANT.x + 26
      tz = GIANT.z - 30
      speed = 12
    } else if (party) {
      // swim back and forth off the beach behind the stage, where the crowd can see it jump
      tx = STAGE.x - 46 + Math.sin(t * 0.15) * 4
      tz = STAGE.z + Math.sin(t * 0.21) * 22
      speed = 8
    } else {
      const a = t * 0.06
      const R = Math.max(PATROL_R, SHORE(a) + 18)
      tx = Math.cos(a) * R
      tz = Math.sin(a) * R
      speed = 5
    }
    const dx = tx - s.x
    const dz = tz - s.z
    const d = Math.hypot(dx, dz)
    if (d > 0.05) {
      const step = Math.min(d, speed * dt)
      const nx = s.x + (dx / d) * step
      const nz = s.z + (dz / d) * step
      if (heightAt(nx, nz) < -0.7) {
        // sharks don't do beaches
        s.x = nx
        s.z = nz
      }
      if (!close) s.yaw = ease(s.yaw, Math.atan2(dx, dz), Math.min(1, dt * 4))
    }
    // up close it turns to face you and rises out of the water to show off its grin
    if (close) s.yaw = ease(s.yaw, Math.atan2(px - s.x, pz - s.z), Math.min(1, dt * 5))
    s.rise += ((close ? 1 : 0) - s.rise) * Math.min(1, dt * 2)
    sharkPos.x = s.x
    sharkPos.z = s.z
    if (import.meta.env.DEV) document.body.dataset.shark = `${s.x.toFixed(2)},${s.z.toFixed(2)}`
    // during the eruption it breaches: a big leap every 4 seconds
    const leap = party ? (t % 4) / 1.5 : 1
    const jump = leap < 1 ? Math.sin(leap * Math.PI) * 6 : 0
    const flip = leap < 1 ? -Math.cos(leap * Math.PI) * 0.9 : 0
    // ACHOO: the sneeze launches the shark way up into the sky, spinning
    const sa = (press.t() - PRESS.SNEEZE - 0.3) * 0.55
    const launched = sa >= 0 && sa < 3.2
    const fly = launched ? 22 * sa - 6.9 * sa * sa : 0
    root.current.position.set(s.x, -0.45 + s.rise * 0.55 + jump + Math.max(0, fly) + Math.sin(t * 1.5) * 0.06, s.z)
    root.current.rotation.set(-s.rise * 0.18 + flip + (launched ? sa * 4 : 0), s.yaw, Math.sin(t * 3) * 0.05 + (launched ? sa * 2 : 0))
    if (launched && !close) {
      bubble.current.visible = true
      bubble.current.material = textBubble('WHEEEEEE!!!', '#1d6fa8')
      return
    }
    tail.current.rotation.y = Math.sin(t * (hunting ? 9 : 5)) * 0.45
    jaw.current.rotation.x = close ? 0.15 + Math.abs(Math.sin(t * 6)) * 0.45 : 0.08
    bubble.current.visible = close
    bubble.current.material = bubbles[Math.floor(t / 2.5) % bubbles.length]
  })

  return (
    <>
      <group ref={root}>
        <group scale={1.35}>
          {/* body + belly + snout */}
          <B c={GREY} p={[0, 0, 0]} s={[0.55, 0.5, 1.7]} />
          <B c={BELLY} p={[0, -0.18, 0.15]} s={[0.47, 0.33, 1.5]} />
          <B c={GREY} p={[0, 0.03, 1.45]} s={[0.4, 0.33, 0.55]} />
          {/* dorsal fin sticking out of the water */}
          <B g={CONE} c={GREY} p={[0, 0.72, -0.1]} r={[-0.35, 0, 0]} s={[0.08, 0.75, 0.4]} />
          {/* pectoral fins */}
          {[-1, 1].map((sx) => (
            <B key={sx} g={CONE} c={GREY} p={[0.55 * sx, -0.2, 0.4]} r={[0.9, 0, 1.4 * sx]} s={[0.06, 0.6, 0.28]} />
          ))}
          {/* eyes (big and friendly-ish) */}
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c="#ffffff" p={[0.3 * sx, 0.17, 1.55]} s={0.11} />
              <B c="#111418" p={[0.33 * sx, 0.18, 1.62]} s={0.06} />
              <B c="#ffffff" p={[0.34 * sx, 0.21, 1.66]} s={0.02} />
            </group>
          ))}
          {/* mouth: upper teeth on the head, lower jaw opens */}
          <B c="#7a2a35" p={[0, -0.13, 1.6]} s={[0.36, 0.08, 0.25]} />
          {teeth.map((x) => (
            <B key={x} g={CONE} c="#ffffff" p={[x, -0.12, 1.78 - Math.abs(x) * 0.6]} r={[Math.PI, 0, 0]} s={[0.035, 0.08, 0.035]} />
          ))}
          <group ref={jaw} position={[0, -0.15, 1.3]}>
            <B c={BELLY} p={[0, -0.05, 0.25]} s={[0.36, 0.1, 0.4]} />
            {teeth.map((x) => (
              <B key={x} g={CONE} c="#ffffff" p={[x * 0.9, 0.04, 0.5 - Math.abs(x) * 0.6]} s={[0.03, 0.07, 0.03]} />
            ))}
          </group>
          {/* red electric guitar strapped across its belly (only on stage) */}
          <group ref={guitar} position={[0, -0.62, -0.1]} rotation={[0, 0.7, 0]} visible={false}>
            <group rotation={[Math.PI / 2, 0, 0]}>
              <B c="#e8222e" p={[-0.12, 0, 0]} s={[0.32, 0.26, 0.07]} />
              <B c="#e8222e" p={[0.16, 0.04, 0]} s={[0.22, 0.19, 0.07]} />
              <B c="#ffffff" p={[-0.02, -0.04, 0.05]} s={[0.16, 0.12, 0.02]} />
              <B g={CONE} c="#1d1d22" p={[0.95, 0, 0]} r={[0, 0, -Math.PI / 2]} s={[0.035, 1.25, 0.03]} />
              <B c="#1d1d22" p={[1.6, 0, 0]} s={[0.12, 0.07, 0.03]} />
              <B c="#d9b45a" p={[-0.05, 0, 0.06]} s={[0.05, 0.05, 0.02]} />
            </group>
          </group>
          {/* tail */}
          <group ref={tail} position={[0, 0.02, -1.6]}>
            <B c={GREY} p={[0, 0, -0.3]} s={[0.22, 0.25, 0.5]} />
            <B g={CONE} c={GREY} p={[0, 0.45, -0.75]} r={[-0.9, 0, 0]} s={[0.06, 0.8, 0.3]} />
            <B g={CONE} c={GREY} p={[0, -0.32, -0.7]} r={[-2.3, 0, 0]} s={[0.06, 0.55, 0.25]} />
          </group>
        </group>
        <sprite ref={bubble} material={bubbles[0]} position={[0, 2.2, 1.2]} scale={[1.6, 0.8, 1]} visible={false} />
      </group>
      {/* stage extras live in world space: its rock-star speech bubble, a spotlight, takeoff splash */}
      <sprite ref={stageBubble} scale={[2.6, 1.22, 1]} visible={false} />
      <pointLight ref={spot} color="#ffffff" intensity={0} distance={14} decay={1.2} />
      <instancedMesh ref={splash} args={[SPH, m('#ffffff'), N_SPLASH]} frustumCulled={false} />
    </>
  )
}
