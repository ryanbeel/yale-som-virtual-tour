import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bubbleMat } from './Allison.jsx'
import { SHORE, STAGE, heightAt, inWater } from './island.js'
import { concert } from './concert.js'

// A big cartoon shark. It patrols offshore with its fin above the waves; step into the water and it
// swims straight at you, then circles you, chomping (it's friendly... probably). Faces +z.

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

export default function Shark() {
  const { camera } = useThree()
  const root = useRef()
  const tail = useRef()
  const jaw = useRef()
  const bubble = useRef()
  const st = useRef({ x: 0, z: PATROL_R, yaw: Math.PI / 2, orbit: 0, rise: 0 })
  const teeth = useMemo(() => Array.from({ length: 9 }, (_, i) => (i - 4) * 0.09), [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const s = st.current
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
    root.current.position.set(s.x, -0.45 + s.rise * 0.55 + jump + Math.sin(t * 1.5) * 0.06, s.z)
    root.current.rotation.set(-s.rise * 0.18 + flip, s.yaw, Math.sin(t * 3) * 0.05)
    tail.current.rotation.y = Math.sin(t * (hunting ? 9 : 5)) * 0.45
    jaw.current.rotation.x = close ? 0.15 + Math.abs(Math.sin(t * 6)) * 0.45 : 0.08
    bubble.current.visible = close
    bubble.current.material = bubbles[Math.floor(t / 2.5) % bubbles.length]
  })

  return (
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
        {/* tail */}
        <group ref={tail} position={[0, 0.02, -1.6]}>
          <B c={GREY} p={[0, 0, -0.3]} s={[0.22, 0.25, 0.5]} />
          <B g={CONE} c={GREY} p={[0, 0.45, -0.75]} r={[-0.9, 0, 0]} s={[0.06, 0.8, 0.3]} />
          <B g={CONE} c={GREY} p={[0, -0.32, -0.7]} r={[-2.3, 0, 0]} s={[0.06, 0.55, 0.25]} />
        </group>
      </group>
      <sprite ref={bubble} material={bubbles[0]} position={[0, 2.2, 1.2]} scale={[1.6, 0.8, 1]} visible={false} />
    </group>
  )
}
