import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { concert } from './concert.js'
import { LAST_SNEEZE, press } from './donotpress.js'
import { CRATER, heightAt } from './island.js'

// Halfway through the concert the Diamond Head crater wakes up: it rumbles and smokes, then a
// volcano cone rises out of it and erupts (a lava fountain, glowing lava rivers, lava bombs raining
// across the island, a towering ash column, and an orange glow over everything). When the show
// ends, the volcano sinks back into the crater.

const RUMBLE = 6 // seconds of rumbling before the eruption
const GROW = 3 // seconds for the cone to rise
const SINK = 6 // seconds to sink back after the show
const BASE = 2.5 // cone bottom (inside the crater bowl)
const TOP = 23 // cone summit
const N_BOMBS = 70
const N_ASH = 26

const SPH = new THREE.SphereGeometry(1, 14, 10)

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

function rockMat() {
  // dark rock with glowing cracks (the same picture drives the glow)
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#2a1d18'
  g.fillRect(0, 0, 256, 256)
  const r = rand(5)
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 3 ? '#ff5a1f' : '#ffb03a'
    g.lineWidth = 1 + r() * 3
    g.beginPath()
    let x = r() * 256
    let y = r() * 256
    g.moveTo(x, y)
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 50
      y += r() * 40
      g.lineTo(x, y)
    }
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(4, 2)
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ff6a2a', emissiveIntensity: 0.9, roughness: 0.9, flatShading: true })
}

// eruption level 0..1 (and how far the cone has grown) for the current moment
function levels() {
  const { phase, showT, erupt, sinceEnd } = concert.timeline()
  const rumble = phase === 'show' ? Math.min(1, Math.max(0, (showT - (45 - RUMBLE)) / RUMBLE)) : 0
  let grow = 0
  if (erupt >= 0) grow = Math.min(1, erupt / GROW)
  else if (phase === 'idle' && sinceEnd < SINK) grow = 1 - sinceEnd / SINK
  // the giant's mega-sneeze knocks the volcano awake for ~9 seconds
  const pe = press.t() - LAST_SNEEZE
  if (pe >= 0 && pe < 10) {
    const g = Math.min(1, pe / 1.5) * (1 - Math.min(1, Math.max(0, (pe - 8) / 2)))
    if (g > grow) return { rumble, grow: g, erupting: pe }
  }
  return { rumble, grow, erupting: erupt >= 0 ? erupt : -1 }
}

export default function Volcano() {
  const cone = useRef()
  const fountain = useRef()
  const glow = useRef()
  const rivers = useRef([])
  const bombs = useRef()
  const ash = useRef([])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const rock = useMemo(rockMat, [])
  const lava = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff7a1a' }), [])
  const lavaHot = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd23f' }), [])
  const ashMats = useMemo(() => Array.from({ length: N_ASH }, () => new THREE.MeshStandardMaterial({ color: '#3a3236', transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 })), [])
  const coneGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(4, 15, TOP - BASE, 36, 8, true)
    const p = g.attributes.position
    const r = rand(17)
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getY(i)) < (TOP - BASE) / 2 - 0.01) {
        const k = 1 + (r() - 0.5) * 0.16
        p.setX(i, p.getX(i) * k)
        p.setZ(i, p.getZ(i) * k)
      }
    }
    g.translate(0, (TOP - BASE) / 2, 0) // grow from the bottom
    g.computeVertexNormals()
    return g
  }, [])
  const bombData = useMemo(() => {
    const r = rand(31)
    return Array.from({ length: N_BOMBS }, () => {
      const a = r() * Math.PI * 2
      // most fly out over the island, a few lob toward the party near the stage
      const toParty = r() < 0.2
      const dir = toParty ? Math.atan2(17 - CRATER.z, -24 - CRATER.x) + (r() - 0.5) * 0.4 : a
      const speed = toParty ? 12 + r() * 4 : 6 + r() * 14
      return { vx: Math.cos(dir) * speed, vz: Math.sin(dir) * speed, vy: 18 + r() * 14, period: 4.5 + r() * 3, offset: r() * 8, size: 0.35 + r() * 0.5 }
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { rumble, grow, erupting } = levels()
    const active = grow > 0.001
    const shake = rumble > 0 && grow < 1 ? 0.25 * rumble : erupting >= 0 ? 0.12 : 0

    cone.current.visible = active
    cone.current.scale.set(0.4 + grow * 0.6, Math.max(0.001, grow), 0.4 + grow * 0.6)
    cone.current.position.set(CRATER.x + Math.sin(t * 37) * shake, BASE, CRATER.z + Math.cos(t * 41) * shake)
    rock.emissiveIntensity = 0.6 + (erupting >= 0 ? 0.5 + Math.sin(t * 6) * 0.3 : 0)

    const summit = BASE + (TOP - BASE) * grow
    fountain.current.visible = erupting >= 0 && grow > 0.95
    fountain.current.position.set(CRATER.x, summit, CRATER.z)
    fountain.current.scale.set(2.2 + Math.sin(t * 13) * 0.4, 6 + Math.sin(t * 9) * 2.5, 2.2 + Math.cos(t * 11) * 0.4)

    glow.current.position.set(CRATER.x, Math.max(6, summit + 4), CRATER.z)
    glow.current.intensity = erupting >= 0 ? 260 + Math.sin(t * 17) * 80 : rumble * 60
    glow.current.distance = 260

    rivers.current.forEach((rv, i) => rv && (rv.visible = erupting >= 0 && grow > 0.9))

    // lava bombs
    for (let i = 0; i < N_BOMBS; i++) {
      const b = bombData[i]
      let visible = false
      if (erupting >= 0 && grow > 0.95) {
        const a = (erupting + b.offset) % b.period
        const g = 9.8 * 0.7
        const y = summit + b.vy * a - 0.5 * g * a * a
        const x = CRATER.x + b.vx * a
        const z = CRATER.z + b.vz * a
        const ground = Math.max(heightAt(x, z), 0)
        if (y > ground) {
          tmp.position.set(x, y, z)
          tmp.scale.setScalar(b.size)
          visible = true
        } else {
          // splat: find roughly where it landed and let it glow there briefly
          const land = (b.vy + Math.sqrt(b.vy * b.vy + 2 * g * (summit - ground))) / g
          const fade = 1 - (a - land) / 1.5
          if (fade > 0) {
            const lx = CRATER.x + b.vx * land
            const lz = CRATER.z + b.vz * land
            tmp.position.set(lx, Math.max(heightAt(lx, lz), 0) + 0.05, lz)
            tmp.scale.set(b.size * 2.4 * fade, 0.08, b.size * 2.4 * fade)
            visible = true
          }
        }
      }
      if (!visible) tmp.scale.setScalar(0)
      tmp.updateMatrix()
      bombs.current.setMatrixAt(i, tmp.matrix)
    }
    bombs.current.instanceMatrix.needsUpdate = true

    // ash: a towering column while erupting, a few wisps while it rumbles
    ash.current.forEach((m, i) => {
      if (!m) return
      const on = (erupting >= 0 && active) || rumble > 0
      m.visible = on
      if (!on) return
      const P = 7
      const age = (t + (i * P) / N_ASH) % P
      const u = age / P
      const big = erupting >= 0 ? 1 : 0.35
      m.position.set(CRATER.x + Math.sin(i * 2.1 + t * 0.2) * u * 9, Math.max(summit, 8) + age * (erupting >= 0 ? 6 : 2), CRATER.z + Math.cos(i * 1.3) * u * 7)
      m.scale.setScalar((2 + u * 9) * big)
      ashMats[i].opacity = (1 - u) * (erupting >= 0 ? 0.7 : 0.4)
      ashMats[i].color.set(u < 0.15 && erupting >= 0 ? '#b8562a' : '#3a3236')
    })
  })

  return (
    <group>
      <mesh ref={cone} geometry={coneGeo} material={rock} visible={false} />
      <mesh ref={fountain} geometry={SPH} material={lavaHot} visible={false} />
      <pointLight ref={glow} color="#ff6a1a" intensity={0} decay={1.1} />
      {/* lava rivers pouring down the sides */}
      {Array.from({ length: 7 }, (_, i) => {
        // lying on the slope: midway up the cone, tilted so the top leans in toward the summit
        const a = (i / 7) * Math.PI * 2 + 0.3
        const slope = Math.atan2(15 - 4, TOP - BASE)
        const len = Math.hypot(15 - 4, TOP - BASE)
        return (
          <mesh
            key={i}
            ref={(el) => (rivers.current[i] = el)}
            material={i % 2 ? lava : lavaHot}
            position={[CRATER.x + Math.cos(a) * 9.9, BASE + (TOP - BASE) / 2, CRATER.z + Math.sin(a) * 9.9]}
            rotation={[0, -a, slope]}
            visible={false}
          >
            <boxGeometry args={[0.3, len, 1.1]} />
          </mesh>
        )
      })}
      <instancedMesh ref={bombs} args={[SPH, lava, N_BOMBS]} frustumCulled={false} />
      {ashMats.map((mat, i) => (
        <mesh key={i} ref={(el) => (ash.current[i] = el)} geometry={SPH} material={mat} visible={false} />
      ))}
    </group>
  )
}
