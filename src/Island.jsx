import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RyanJr } from './Allison.jsx'
import CloneMachine from './CloneMachine.jsx'
import IslandCats from './IslandCats.jsx'
import Portal from './Portal.jsx'
import Shark from './Shark.jsx'
import { Torch, Totem } from './TikiParty.jsx'
import {
  BAR, BEACH_SPOTS, CRATER, HAMMOCK, HUTS, MACHINE, PALMS, PLAZA, RETURN_PORTAL, SHORE, SIGN, STAGE, TORCHES,
  heightAt, inland, sandy,
} from './island.js'

// Ryan Jr. Island: a turquoise lagoon, white beaches, palms, a Diamond-Head-style crater, a tiki
// party, the Clone-O-Matic with its ever-growing clone army, a shark, and a stage waiting for a band.

const SPH = new THREE.SphereGeometry(1, 16, 12)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14)
const CONE = new THREE.ConeGeometry(1, 1, 18)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const GEO = { sphere: SPH, cyl: CYL, cone: CONE, box: BOX }

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o, mat }) => <mesh geometry={g} material={mat ?? m(c, o)} position={p} scale={s} rotation={r} />

const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const M = (p, r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(V.set(...p), Q.setFromEuler(r ? E.set(r[0], r[1], r[2], 'XYZ') : E.set(0, 0, 0, 'XYZ')), S.set(...(typeof s === 'number' ? [s, s, s] : s)))
const mul = (a, b) => a.clone().multiply(b)

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

// lots of static, same-shaped pieces (palm fronds, hut posts...) drawn as one instanced mesh per shape
function StaticParts({ parts }) {
  const groups = useMemo(() => {
    const out = {}
    for (const p of parts) (out[p.g] ??= []).push(p)
    return Object.entries(out)
  }, [parts])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), [])
  return groups.map(([g, list]) => <Instanced key={g} geo={GEO[g]} mat={mat} list={list} />)
}
function Instanced({ geo, mat, list }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const c = new THREE.Color()
    list.forEach((p, i) => {
      ref.current.setMatrixAt(i, p.m)
      ref.current.setColorAt(i, c.set(p.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
  }, [list])
  return <instancedMesh ref={ref} args={[geo, mat, list.length]} />
}

// ---------- sky, sun, fog
function Atmosphere() {
  const { scene } = useThree()
  useLayoutEffect(() => {
    const prev = { bg: scene.background, fog: scene.fog, env: scene.environmentIntensity }
    scene.background = canvasTex(4, 256, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, '#2f8fe0')
      grad.addColorStop(0.55, '#8fd3ff')
      grad.addColorStop(1, '#e8f8ff')
      g.fillStyle = grad
      g.fillRect(0, 0, w, h)
    })
    scene.fog = new THREE.Fog('#bfe9ff', 90, 330)
    scene.environmentIntensity = 0.35
    return () => {
      scene.background = prev.bg
      scene.fog = prev.fog
      scene.environmentIntensity = prev.env
    }
  }, [scene])
  return (
    <>
      <hemisphereLight args={['#dff4ff', '#e9d9a8', 1.1]} />
      <directionalLight position={[40, 70, 30]} intensity={1.9} color="#fff3dc" />
      <ambientLight intensity={0.25} />
      {/* a big friendly sun + a few puffy clouds */}
      <mesh position={[120, 110, -260]}>
        <sphereGeometry args={[14, 24, 16]} />
        <meshBasicMaterial color="#fff7c2" fog={false} />
      </mesh>
      {[[-90, 70, -220], [40, 85, -280], [180, 60, -120], [-200, 65, 40], [60, 75, 240]].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          {[[0, 0, 0, 14], [12, -2, 3, 10], [-12, -3, -2, 11], [4, 6, 0, 9]].map(([dx, dy, dz, r], k) => (
            <mesh key={k} geometry={SPH} position={[dx, dy, dz]} scale={[r * 1.4, r * 0.8, r]}>
              <meshBasicMaterial color="#ffffff" fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

// ---------- island terrain (sand, grass, crater rock, sea floor) as one polar mesh
function Terrain() {
  const geo = useMemo(() => {
    const SEG = 220
    const radii = []
    for (let r = 0; r < 140; r += r < 40 ? 2.2 : r < 75 ? 0.9 : 3) radii.push(r)
    const pos = []
    const col = []
    const c = new THREE.Color()
    const sand = new THREE.Color('#f6e7bd')
    const wet = new THREE.Color('#d8bf86')
    const grass = new THREE.Color('#5fae4a')
    const jungle = new THREE.Color('#3f8f3a')
    const rock = new THREE.Color('#8f7a52')
    const shallow = new THREE.Color('#e9dcae')
    const deep = new THREE.Color('#1a6f86')
    for (const r of radii) {
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        const h = heightAt(x, z)
        pos.push(x, h, z)
        const d = inland(x, z)
        if (d < 0) c.copy(shallow).lerp(deep, Math.min(1, -d / 22))
        else if (d < 1.5) c.copy(wet)
        else if (d < 10) c.copy(sand)
        else if (sandy(x, z)) c.copy(sand)
        else c.copy(sand).lerp(d > 22 ? jungle : grass, Math.min(1, (d - 10) / 6))
        const dc = Math.hypot(x - CRATER.x, z - CRATER.z)
        if (h > 3 && dc > CRATER.r * 0.7) c.copy(rock).lerp(grass, Math.max(0, Math.min(1, (CRATER.h - h) / 9)) * 0.45)
        else if (dc < CRATER.r * 0.7 && h > 3) c.copy(grass)
        col.push(c.r, c.g, c.b)
      }
    }
    const idx = []
    for (let ri = 0; ri < radii.length - 1; ri++) {
      for (let i = 0; i < SEG; i++) {
        const a = ri * SEG + i
        const b = ri * SEG + ((i + 1) % SEG)
        const cc = (ri + 1) * SEG + i
        const dd = (ri + 1) * SEG + ((i + 1) % SEG)
        idx.push(a, b, cc, b, dd, cc) // counter-clockwise from above, so the ground faces up
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  return <mesh geometry={geo} material={useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), [])} />
}

// ---------- turquoise water + a foam line that laps the shore
function Water() {
  const water = useRef()
  const foam = useRef()
  const foamGeo = useMemo(() => {
    const pts = []
    const N = 240
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const R = SHORE(a)
      for (const dr of [-0.2, 1.6]) pts.push(Math.cos(a) * (R + dr), 0, Math.sin(a) * (R + dr))
    }
    const idx = []
    for (let i = 0; i < N; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    g.setIndex(idx)
    return g
  }, [])
  const foamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    water.current.position.y = Math.sin(t * 0.8) * 0.04
    foam.current.position.y = 0.05 + Math.sin(t * 0.8) * 0.04
    foam.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.006)
    foamMat.opacity = 0.35 + Math.sin(t * 1.6) * 0.2
  })
  return (
    <>
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[600, 96]} />
        <meshStandardMaterial color="#18bccb" transparent opacity={0.72} roughness={0.12} metalness={0.15} depthWrite={false} />
      </mesh>
      <mesh ref={foam} geometry={foamGeo} material={foamMat} />
      {/* deep ocean floor past the edge of the island mesh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.6, 0]}>
        <ringGeometry args={[130, 600, 96]} />
        <meshStandardMaterial color="#0f5a73" roughness={1} />
      </mesh>
    </>
  )
}

// ---------- palms, huts, umbrellas, loungers, towels (static instanced pieces)
function palmParts(x, z, yaw, size) {
  const out = []
  const y0 = heightAt(x, z)
  const base = M([x, y0, z], [0, yaw, 0], size)
  const add = (g, m, color) => out.push({ g, m: mul(base, m), color })
  let px = 0
  let py = 0
  for (let i = 0; i < 8; i++) {
    const lean = 0.035 * i
    add('cyl', M([px, py + 0.42, 0], [0, 0, -lean], [0.2 - i * 0.012, 0.88, 0.2 - i * 0.012]), i % 2 ? '#8a6a45' : '#7a5c3a')
    px += Math.sin(lean) * 0.85
    py += Math.cos(lean) * 0.82
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2
    const leaf = M([px, py + 0.1, 0], [0, a, 0])
    add('sphere', mul(leaf, M([0, -0.25, 1.35], [0.45, 0, 0], [0.32, 0.05, 1.5])), k % 2 ? '#2f9a46' : '#45b552')
  }
  for (let k = 0; k < 3; k++) add('sphere', M([px + Math.cos(k * 2.1) * 0.2, py - 0.15, Math.sin(k * 2.1) * 0.2], 0, 0.15), '#5a3d22')
  return out
}

function hutParts(x, z, yaw) {
  const out = []
  const base = M([x, heightAt(x, z), z], [0, yaw, 0])
  const add = (g, m, color) => out.push({ g, m: mul(base, m), color })
  for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) add('cyl', M([px, 1.2, pz], 0, [0.12, 2.4, 0.12]), '#b8935a')
  add('box', M([0, 0.35, 0], 0, [3.6, 0.15, 3.6]), '#a07a48')
  add('box', M([0, 1.1, -1.65], 0, [3.3, 1.4, 0.1]), '#c9a86a')
  add('cone', M([0, 3.2, 0], [0, Math.PI / 4, 0], [3.1, 1.9, 3.1]), '#d9b25f')
  add('cone', M([0, 2.75, 0], [0, 0, 0], [3.35, 0.9, 3.35]), '#c49a48')
  return out
}

function beachParts([x, z, yaw, r]) {
  const out = []
  const base = M([x, heightAt(x, z), z], [0, yaw, 0])
  const add = (g, m, color) => out.push({ g, m: mul(base, m), color })
  const colors = ['#ff4fa3', '#ffd23f', '#2ec4a6', '#ff7a3d', '#4fb3ff', '#7a4fd1']
  const c1 = colors[Math.floor(r * colors.length)]
  const c2 = colors[(Math.floor(r * colors.length) + 2) % colors.length]
  add('cyl', M([0, 1.15, 0], [0.12, 0, 0], [0.04, 2.3, 0.04]), '#f2f2f2')
  add('cone', M([0, 2.45, 0.12], [0.12, 0, 0], [1.6, 0.55, 1.6]), c1)
  add('sphere', M([0, 2.75, 0.15], 0, 0.08), c2)
  // lounger + towel
  add('box', M([1.4, 0.3, 0.4], [0, 0.2, 0], [0.7, 0.08, 1.8]), '#ffffff')
  add('box', M([1.32, 0.55, -0.35], [0.9, 0.2, 0], [0.7, 0.08, 0.6]), '#ffffff')
  add('box', M([-1.3, 0.04, 0.6], [0, -0.3, 0], [0.9, 0.02, 1.8]), c2)
  add('box', M([-1.3, 0.05, 0.6], [0, -0.3, 0], [0.9, 0.02, 0.25]), '#ffffff')
  return out
}

function Scenery() {
  const parts = useMemo(() => {
    const r = rand(42)
    const out = []
    for (const [x, z, yaw] of PALMS) out.push(...palmParts(x, z, yaw, 0.85 + r() * 0.35))
    for (const [x, z, yaw] of HUTS) out.push(...hutParts(x, z, yaw))
    for (const spot of BEACH_SPOTS) out.push(...beachParts(spot))
    // surfboards stuck in the sand
    for (const [x, z, c] of [[-14, 50, '#ff4fa3'], [-12.5, 50.5, '#2ec4a6'], [32, 44, '#ffd23f'], [-48, 18, '#ff7a3d']]) {
      out.push({ g: 'sphere', m: M([x, heightAt(x, z) + 1.0, z], [0.1, 0.4, 0.08], [0.32, 1.25, 0.06]), color: c })
      out.push({ g: 'box', m: M([x, heightAt(x, z) + 1.0, z], [0.1, 0.4, 0.08], [0.04, 2.2, 0.065]), color: '#ffffff' })
    }
    return out
  }, [])
  return <StaticParts parts={parts} />
}

// ---------- party lights strung between the plaza torches
function PartyLights() {
  const ref = useRef()
  const bulbs = useMemo(() => {
    const out = []
    const pts = TORCHES.map(([x, z]) => [x, heightAt(x, z) + 2.3, z])
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]
      for (let k = 0; k < 8; k++) {
        const u = k / 8
        out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * 0.55, a[2] + (b[2] - a[2]) * u])
      }
    })
    return out
  }, [])
  const colors = useMemo(() => ['#ff4fa3', '#ffd23f', '#2ec4a6', '#ff7a3d', '#7a4fd1'].map((c) => new THREE.Color(c)), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    bulbs.forEach((p, i) => {
      tmp.position.set(...p)
      tmp.scale.setScalar(0.09)
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [bulbs, tmp])
  useFrame(({ clock }) => {
    const shift = Math.floor(clock.elapsedTime * 2)
    bulbs.forEach((_, i) => ref.current.setColorAt(i, colors[(i + shift) % colors.length]))
    ref.current.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[SPH, useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []), bulbs.length]} />
}

// ---------- the giant welcome sign
function BigSign() {
  const y0 = heightAt(SIGN.x, SIGN.z)
  const board = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.7,
        map: canvasTex(2048, 640, (g, w, h) => {
          g.fillStyle = '#8a5a2e'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#6b4220'
          g.lineWidth = 6
          for (let y = 50; y < h; y += 70) {
            g.beginPath()
            g.moveTo(0, y + Math.sin(y) * 6)
            g.bezierCurveTo(w / 3, y - 10, (2 * w) / 3, y + 12, w, y)
            g.stroke()
          }
          g.strokeStyle = '#2ec4a6'
          g.lineWidth = 34
          g.strokeRect(20, 20, w - 40, h - 40)
          g.textAlign = 'center'
          g.lineJoin = 'round'
          g.font = 'bold 250px "Arial Black", Impact, sans-serif'
          g.lineWidth = 40
          g.strokeStyle = '#1d1d22'
          g.strokeText('RYAN JR.', w / 2, 300)
          g.fillStyle = '#ffd23f'
          g.fillText('RYAN JR.', w / 2, 300)
          g.font = 'bold 200px "Arial Black", Impact, sans-serif'
          g.strokeText('ISLAND', w / 2, 540)
          g.fillStyle = '#ff4fa3'
          g.fillText('ISLAND', w / 2, 540)
          // little cat faces in the corners
          for (const cx of [190, w - 190]) {
            g.fillStyle = '#1d1d22'
            g.beginPath()
            g.arc(cx, 330, 105, 0, Math.PI * 2)
            g.moveTo(cx - 95, 290)
            g.lineTo(cx - 70, 190)
            g.lineTo(cx - 30, 250)
            g.moveTo(cx + 95, 290)
            g.lineTo(cx + 70, 190)
            g.lineTo(cx + 30, 250)
            g.fill()
            g.fillStyle = '#f6f4ef'
            g.beginPath()
            g.ellipse(cx, 375, 55, 42, 0, 0, Math.PI * 2)
            g.fill()
            g.fillStyle = '#c8e04a'
            for (const ex of [-38, 38]) {
              g.beginPath()
              g.arc(cx + ex, 315, 20, 0, Math.PI * 2)
              g.fill()
            }
            g.fillStyle = '#ff8fa3'
            g.beginPath()
            g.arc(cx, 355, 10, 0, Math.PI * 2)
            g.fill()
          }
        }),
      }),
    [],
  )
  return (
    <group position={[SIGN.x, y0, SIGN.z]}>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[6.6 * sx, 0, 0]}>
          <B g={CYL} c="#6b4426" p={[0, 5.4, 0]} s={[0.35, 10.8, 0.35]} />
          <Totem position={[0, 0, 0.5]} rotation={0} />
          <B g={CONE} c="#3f9b4a" p={[0, 11.2, 0]} s={[0.9, 1.2, 0.9]} />
        </group>
      ))}
      <B g={BOX} c="#5a3a1c" p={[0, 8.6, -0.05]} s={[13.6, 4.4, 0.35]} />
      <mesh material={board} position={[0, 8.6, 0.14]}>
        <planeGeometry args={[13.2, 4.1]} />
      </mesh>
      {/* flower garland along the top */}
      {Array.from({ length: 22 }, (_, i) => (
        <B key={i} c={['#ff4fa3', '#ffd23f', '#ffffff', '#ff7a3d'][i % 4]} p={[-6.3 + i * 0.6, 10.85 - Math.sin((i / 21) * Math.PI) * 0.35, 0.2]} s={0.2} />
      ))}
    </group>
  )
}

// ---------- the empty stage, saved for the band
function Stage() {
  const y0 = Math.max(heightAt(STAGE.x, STAGE.z), 0.5)
  const banner = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(1024, 256, (g, w, h) => {
          g.fillStyle = '#1d1d22'
          g.fillRect(0, 0, w, h)
          g.textAlign = 'center'
          g.fillStyle = '#ffd23f'
          g.font = 'bold 92px "Arial Black", Impact, sans-serif'
          g.fillText('THE BAND', w / 2, 110)
          g.fillStyle = '#ff4fa3'
          g.font = 'bold 70px system-ui, sans-serif'
          g.fillText('COMING SOON', w / 2, 205)
        }),
      }),
    [],
  )
  const spots = useRef([])
  useFrame(({ clock }) => {
    spots.current.forEach((s, i) => s && (s.rotation.z = Math.sin(clock.elapsedTime * 0.8 + i * 1.3) * 0.35))
  })
  const { w, d } = STAGE
  return (
    <group position={[STAGE.x, y0, STAGE.z]} rotation={[0, STAGE.rot, 0]}>
      {/* deck (local x = along the front, +z = toward the audience) */}
      <B g={BOX} c="#3a2a1c" p={[0, 0.45, 0]} s={[w, 0.9, d]} />
      <B g={BOX} c="#6b4a2e" p={[0, 0.91, 0]} s={[w - 0.2, 0.04, d - 0.2]} />
      {[0, 1, 2].map((k) => (
        <B key={k} g={BOX} c="#5a3d22" p={[0, 0.15 + k * 0.3, d / 2 + 0.9 - k * 0.3]} s={[2.4, 0.3, 0.6]} />
      ))}
      {/* truss + lights */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={CYL} c="#c0c4c8" o={{ metalness: 0.8, roughness: 0.3 }} p={[(w / 2 - 0.3) * sx, 3.3, -d / 2 + 0.4]} s={[0.12, 5, 0.12]} />
          <B g={BOX} c="#1d1d22" p={[(w / 2 - 1.0) * sx, 1.7, -d / 2 + 1.2]} s={[1.0, 1.6, 0.8]} />
          <B g={CYL} c="#3a3a40" p={[(w / 2 - 1.0) * sx, 1.9, -d / 2 + 1.62]} r={[Math.PI / 2, 0, 0]} s={[0.32, 0.04, 0.32]} />
          <B g={CYL} c="#3a3a40" p={[(w / 2 - 1.0) * sx, 1.25, -d / 2 + 1.62]} r={[Math.PI / 2, 0, 0]} s={[0.2, 0.04, 0.2]} />
        </group>
      ))}
      <B g={BOX} c="#c0c4c8" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 5.75, -d / 2 + 0.4]} s={[w - 0.4, 0.2, 0.2]} />
      {[-3, -1, 1, 3].map((x, i) => (
        <group key={x} position={[x, 5.55, -d / 2 + 0.5]} ref={(el) => (spots.current[i] = el)}>
          <B g={CYL} c="#1d1d22" p={[0, -0.25, 0.2]} r={[0.7, 0, 0]} s={[0.18, 0.4, 0.18]} />
          <B c={['#ff4fa3', '#2ec4a6', '#ffd23f', '#7a4fd1'][i]} o={{ emissive: ['#ff4fa3', '#2ec4a6', '#ffd23f', '#7a4fd1'][i], emissiveIntensity: 2 }} p={[0, -0.4, 0.38]} s={0.12} />
        </group>
      ))}
      <mesh material={banner} position={[0, 4.4, -d / 2 + 0.3]}>
        <planeGeometry args={[5.2, 1.3]} />
      </mesh>
      {/* an empty mic stand, waiting */}
      <B g={CYL} c="#c0c4c8" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 1.65, 1.2]} s={[0.02, 1.5, 0.02]} />
      <B c="#3a3a40" p={[0, 2.45, 1.25]} s={[0.05, 0.08, 0.05]} />
    </group>
  )
}

// ---------- tiki bar (with a clone bartender)
function TikiBar() {
  const y0 = heightAt(BAR.x, BAR.z)
  const sign = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(768, 192, (g, w, h) => {
          g.fillStyle = '#5a3a1c'
          g.fillRect(0, 0, w, h)
          g.textAlign = 'center'
          g.fillStyle = '#ffd23f'
          g.font = 'bold 110px "Arial Black", Impact, sans-serif'
          g.fillText('TIKI BAR', w / 2, 140)
        }),
      }),
    [],
  )
  return (
    <group position={[BAR.x, y0, BAR.z]} rotation={[0, BAR.rot, 0]}>
      <B g={BOX} c="#b8935a" p={[0, 0.55, 1.0]} s={[4.4, 1.1, 0.7]} />
      <B g={BOX} c="#6b4a2e" p={[0, 1.13, 1.0]} s={[4.6, 0.08, 0.9]} />
      {[-1.6, -0.6, 0.4, 1.4].map((x) => (
        <group key={x}>
          <B g={CYL} c="#6b4426" p={[x, 0.4, 1.9]} s={[0.05, 0.8, 0.05]} />
          <B g={CYL} c="#ff4fa3" p={[x, 0.82, 1.9]} s={[0.25, 0.06, 0.25]} />
        </group>
      ))}
      {[-1.9, -0.9, 0.3, 1.5].map((x, i) => (
        <group key={x} position={[x, 1.17, 1.0]}>
          <B c="#6b4426" p={[0, 0.12, 0]} s={0.13} />
          <B g={CYL} c={['#ff4fa3', '#2ec4a6', '#ffd23f', '#ff7a3d'][i]} p={[0.05, 0.3, 0]} r={[0, 0, -0.3]} s={[0.012, 0.3, 0.012]} />
        </group>
      ))}
      {[[-2.1, 1.3], [2.1, 1.3], [-2.1, -1.0], [2.1, -1.0]].map(([x, z]) => (
        <B key={`${x}${z}`} g={CYL} c="#8a6a45" p={[x, 1.6, z]} s={[0.12, 3.2, 0.12]} />
      ))}
      <B g={CONE} c="#d9b25f" p={[0, 3.8, 0.15]} r={[0, Math.PI / 4, 0]} s={[3.6, 1.6, 3.0]} />
      <mesh material={sign} position={[0, 2.95, 1.45]}>
        <planeGeometry args={[2.6, 0.65]} />
      </mesh>
      {/* clone bartender, standing on a crate so he can see over the counter */}
      <B g={BOX} c="#8a6a45" p={[0, 0.3, 0.1]} s={[0.7, 0.6, 0.6]} />
      <group position={[0, 0.6, 0.1]} scale={2.0}>
        <RyanJr />
      </group>
    </group>
  )
}

function Hammock() {
  const [ax, az] = HAMMOCK.a
  const [bx, bz] = HAMMOCK.b
  const mx = (ax + bx) / 2
  const mz = (az + bz) / 2
  const y = Math.max(heightAt(mx, mz), 0.1) + 1.0
  const len = Math.hypot(bx - ax, bz - az) - 0.6
  const yaw = Math.atan2(bx - ax, bz - az)
  return (
    <group position={[mx, y, mz]} rotation={[0, yaw, 0]}>
      <B c="#ff7a3d" p={[0, 0, 0]} s={[0.55, 0.12, len / 2]} />
      <B c="#ffd23f" p={[0, 0.03, 0]} s={[0.5, 0.1, len / 2.4]} />
      <group position={[0, 0.12, -0.6]} rotation={[0, Math.PI, 1.3]} scale={1.8}>
        <RyanJr />
      </group>
    </group>
  )
}

function Flamingo() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ref.current.position.set(10 + Math.sin(t * 0.15) * 6, 0.1 + Math.sin(t * 1.3) * 0.08, 70 + Math.cos(t * 0.12) * 4)
    ref.current.rotation.y = t * 0.1
  })
  return (
    <group ref={ref}>
      <mesh>
        <torusGeometry args={[0.9, 0.35, 12, 28]} />
        <meshStandardMaterial color="#ff8fc7" roughness={0.3} />
      </mesh>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <B g={CYL} c="#ff8fc7" p={[0.9, 0, -0.9]} r={[Math.PI / 2, 0, 0]} s={[0.15, 1.4, 0.15]} />
      </group>
      <B c="#ff8fc7" p={[0.9, 1.6, 0]} s={0.3} />
      <B g={CONE} c="#1d1d22" p={[0.9, 1.5, 0.35]} r={[Math.PI / 2 + 0.5, 0, 0]} s={[0.1, 0.3, 0.1]} />
    </group>
  )
}

export default function Island() {
  const portalY = heightAt(RETURN_PORTAL.x, RETURN_PORTAL.z)
  return (
    <>
      <Atmosphere />
      <Terrain />
      <Water />
      <Scenery />
      <BigSign />
      <CloneMachine position={[MACHINE.x, 0, MACHINE.z]} />
      <IslandCats />
      <Stage />
      <TikiBar />
      <Hammock />
      <Flamingo />
      <Shark />
      {TORCHES.map(([x, z], i) => (
        <Torch key={i} position={[x, heightAt(x, z), z]} />
      ))}
      <PartyLights />
      <Portal
        position={[RETURN_PORTAL.x, portalY, RETURN_PORTAL.z]}
        rotation={Math.PI}
        radius={1.8}
        to="evans"
        spawn={{ x: 0, z: -35.2, yaw: Math.PI }}
        label="BACK TO EVANS HALL"
        colors={['#ff4fa3', '#2ec4a6']}
      />
    </>
  )
}
