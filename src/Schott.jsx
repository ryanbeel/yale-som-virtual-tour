import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTalkable } from './talkable.js'

// Prof. Peter Schott (MGT 403 stats in this model): wavy brown hair going a little grey at the
// temples, light-blue gingham oxford with rolled sleeves, khakis, a smartwatch and a huge smile.
// He talks with both hands. His room has a working Galton board (the central limit theorem live),
// giant dice, and shipping containers for his international trade research.
// Figure faces +z. Click him (or tap Talk on a phone) to chat with his AI agent.

export const SCHOTT = {
  id: 'peter-schott',
  name: 'Peter Schott',
  course: 'MGT 403 · Probability Modeling & Statistics',
  greeting: "Hey, welcome in! Great to see you! Grab a seat, we're talking about my favorite thing in the whole world: the central limit theorem. Watch the Galton board. What can I help you with?",
  thinking: 'crunching the numbers…',
}

const SKIN = '#efc6a4'
const HAIR = '#5b3a24'
const GREY = '#8a7d70'
const KHAKI = '#a8956f'
const PINK = '#ff4fa3'
const BLUE = '#00356b'

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CAPSPH = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, 1.25)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const TORSO = new THREE.CylinderGeometry(0.22, 0.2, 0.62, 24)
const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o, mat }) => <mesh geometry={g} material={mat ?? m(c, o)} position={p} scale={s} rotation={r} />

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// light-blue gingham, like the oxford shirts in his photos
const gingham = (() => {
  let mat
  return () => {
    if (mat) return mat
    const t = canvasTex(64, 64, (g) => {
      g.fillStyle = '#b9d4ee'
      g.fillRect(0, 0, 64, 64)
      g.fillStyle = 'rgba(70,120,190,0.35)'
      for (let i = 0; i < 64; i += 16) {
        g.fillRect(i, 0, 8, 64)
        g.fillRect(0, i, 64, 8)
      }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(6, 4)
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
    return mat
  }
})()

const BUBBLES = ['I ♥ the CLT!', 'Averages are normal!', 'n → ∞!']
const bubbleMats = BUBBLES.map(
  (text) =>
    new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      map: canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = '#ffffff'
        g.strokeStyle = BLUE
        g.lineWidth = 10
        g.beginPath()
        g.roundRect(10, 10, w - 20, h - 70, 50)
        g.moveTo(w / 2 - 30, h - 62)
        g.lineTo(w / 2 - 50, h - 10)
        g.lineTo(w / 2 + 10, h - 62)
        g.fill()
        g.stroke()
        g.fillStyle = BLUE
        g.font = 'bold 62px system-ui, sans-serif'
        g.textAlign = 'center'
        g.fillText(text, w / 2, 130)
      }),
    }),
)

function Arm({ armRef, side, watch }) {
  return (
    <group ref={armRef} position={[0.27 * side, 1.46, 0]}>
      <mesh geometry={CAP} material={gingham()} position={[0, -0.14, 0]} scale={[0.072, 0.1, 0.072]} />
      <B g={CYL} c="#a9c6e6" p={[0, -0.27, 0]} s={[0.07, 0.06, 0.07]} />
      <B g={CAP} c={SKIN} p={[0, -0.4, 0.01]} s={[0.05, 0.09, 0.05]} />
      {watch && <B g={BOX} c="#1a1a1e" o={{ roughness: 0.3 }} p={[0, -0.47, 0.01]} s={[0.07, 0.035, 0.07]} />}
      <B c={SKIN} p={[0, -0.54, 0.02]} s={[0.047, 0.058, 0.04]} />
    </group>
  )
}

export default function Schott({ position, rotation = 0, front }) {
  const root = useRef()
  const hit = useRef()
  const head = useRef()
  const mouth = useRef()
  const armL = useRef()
  const armR = useRef()
  const bubble = useRef()
  const talk = useTalkable(SCHOTT, { position, rotation, root, hit, sway: 0.45 })

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { talking, speaking } = talk.current
    head.current.rotation.z = Math.sin(t * 1.1) * 0.05
    head.current.rotation.x = talking ? Math.sin(t * 2) * 0.06 : 0
    // big two-handed explaining, faster when he's mid-answer
    const k = speaking ? 1 : talking ? 0.5 : 0.25 + 0.35 * Math.max(0, Math.sin(t * 0.7))
    const w = speaking ? 4 : 1.8
    armR.current.rotation.set(-0.25 - k * (0.75 + Math.sin(t * w) * 0.3), 0, -0.1 - k * 0.12)
    armL.current.rotation.set(-0.25 - k * (0.75 + Math.sin(t * w + 1.7) * 0.3), 0, 0.1 + k * 0.12)
    mouth.current.scale.y = speaking ? 0.018 + Math.abs(Math.sin(t * 13)) * 0.018 : 0.018
    const cycle = Math.floor(t / 7) % BUBBLES.length
    bubble.current.material = bubbleMats[cycle]
    bubble.current.visible = !talking && t % 7 < 2.2
  })

  return (
    <>
      <group ref={root} position={position} rotation={[0, rotation, 0]}>
        <mesh ref={hit} geometry={CYL} position={[0, 0.95, 0]} scale={[0.45, 1.9, 0.45]} visible={false} />

        {/* brown shoes + khakis + belt */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={BOX} c="#4a2f1f" p={[0.1 * sx, 0.045, 0.04]} s={[0.12, 0.08, 0.27]} />
            <B g={CYL} c={KHAKI} p={[0.1 * sx, 0.49, 0]} s={[0.088, 0.82, 0.088]} />
          </group>
        ))}
        <B g={CYL} c={KHAKI} p={[0, 0.86, 0]} s={[0.2, 0.1, 0.155]} />
        <B g={CYL} c="#3b2618" p={[0, 0.92, 0]} s={[0.205, 0.045, 0.16]} />
        <B g={BOX} c="#c0c4c8" o={{ metalness: 0.7, roughness: 0.3 }} p={[0, 0.92, 0.16]} s={[0.05, 0.035, 0.01]} />

        {/* gingham oxford, open collar, button placket */}
        <mesh geometry={TORSO} material={gingham()} position={[0, 1.22, 0]} />
        <mesh geometry={SPH} material={gingham()} position={[0, 1.48, 0]} scale={[0.27, 0.1, 0.18]} />
        <B g={BOX} c="#9fbfe2" p={[0, 1.15, 0.205]} s={[0.025, 0.5, 0.01]} />
        {[1.0, 1.12, 1.24, 1.36].map((y) => (
          <B key={y} c="#ffffff" p={[0, y, 0.213]} s={[0.009, 0.009, 0.004]} />
        ))}
        <B c={SKIN} p={[0, 1.5, 0.15]} s={[0.05, 0.05, 0.02]} />
        {[-1, 1].map((sx) => (
          <B key={sx} g={BOX} c="#c6dcf2" p={[0.055 * sx, 1.53, 0.14]} r={[0.2, 0, 0.5 * sx]} s={[0.08, 0.035, 0.012]} />
        ))}
        <Arm armRef={armR} side={-1} />
        <Arm armRef={armL} side={1} watch />

        {/* head: wavy brown hair, grey temples, big grin */}
        <B g={CYL} c={SKIN} p={[0, 1.57, 0]} s={[0.05, 0.08, 0.05]} />
        <group ref={head} position={[0, 1.71, 0]}>
          <B c={SKIN} p={[0, 0, 0]} s={[0.12, 0.145, 0.13]} />
          <B g={CAPSPH} c={HAIR} o={{ roughness: 0.95 }} p={[0, 0.012, -0.008]} s={[0.128, 0.15, 0.138]} />
          {/* the wavy swoop on top */}
          {[[-0.06, 0.125, 0.045, 0.05], [0.0, 0.14, 0.05, 0.055], [0.06, 0.13, 0.04, 0.05], [-0.03, 0.15, -0.02, 0.06], [0.04, 0.15, -0.03, 0.06]].map(([x, y, z, r], i) => (
            <B key={i} c={HAIR} o={{ roughness: 0.95 }} p={[x, y, z]} s={[r * 1.1, r * 0.55, r * 0.9]} />
          ))}
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c={GREY} p={[0.121 * sx, 0.045, 0.01]} s={[0.012, 0.035, 0.04]} />
              <B c={SKIN} p={[0.123 * sx, 0, 0]} s={[0.02, 0.036, 0.02]} />
              <B c="#ffffff" p={[0.045 * sx, 0.025, 0.112]} s={[0.022, 0.016, 0.012]} />
              <B c="#3b2a1c" p={[0.045 * sx, 0.025, 0.122]} s={[0.011, 0.011, 0.008]} />
              <B g={BOX} c={HAIR} p={[0.047 * sx, 0.06, 0.118]} r={[0, 0, 0.12 * sx]} s={[0.05, 0.013, 0.01]} />
              <B c="#f2a99a" p={[0.075 * sx, -0.035, 0.105]} s={[0.022, 0.014, 0.008]} />
            </group>
          ))}
          <B c={SKIN} p={[0, -0.005, 0.13]} s={[0.022, 0.032, 0.026]} />
          <mesh ref={mouth} geometry={SPH} material={m('#5a1f22')} position={[0, -0.065, 0.114]} scale={[0.052, 0.018, 0.014]} />
          <B g={BOX} c="#ffffff" p={[0, -0.056, 0.124]} s={[0.07, 0.012, 0.004]} />
        </group>

        <sprite ref={bubble} material={bubbleMats[0]} position={[0.25, 2.15, 0]} scale={[0.6, 0.3, 1]} />
      </group>
      <SchottRoom front={front} rotation={rotation} />
    </>
  )
}

// ---------- his classroom: Galton board, giant dice, trade containers
function at(front, alongBack, alongWall) {
  const { fc, back, t } = front
  return [fc[0] + back[0] * alongBack + t[0] * alongWall, 0, fc[1] + back[1] * alongBack + t[1] * alongWall]
}

function SchottRoom({ front, rotation }) {
  const { half } = front
  return (
    <>
      <GaltonBoard position={at(front, 0.5, half * 0.6)} rotation={rotation} />
      <Die position={at(front, 0.75, -half * 0.52)} rotation={rotation + 0.5} faces={[6, 1, 3, 4, 5, 2]} />
      <Die position={at(front, 0.6, -half * 0.42)} rotation={rotation - 0.3} faces={[4, 3, 6, 1, 2, 5]} />
      <Containers position={at(front, 0.7, -half * 0.78)} rotation={rotation} />
    </>
  )
}

// A Galton board: balls bounce left/right through rows of pegs and pile up as a binomial,
// which (by the central limit theorem) looks like a bell curve. Restarts every ~20 seconds.
const ROWS = 10
const DX = 0.1
const DY = 0.09
const TOP = 1.98
const BIN_BOTTOM = 0.36
const BIN_TOP = 1.13
const N_BALLS = 90
const BALL_R = 0.018
const RELEASE = 0.16
const STEP_T = 0.11
const DROP_T = 0.3
const CYCLE = N_BALLS * RELEASE + ROWS * STEP_T + DROP_T + 4

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

function cyclePaths(c) {
  const r = rand(9001 + c * 7919)
  const counts = new Array(ROWS + 1).fill(0)
  return Array.from({ length: N_BALLS }, () => {
    const steps = Array.from({ length: ROWS }, () => (r() < 0.5 ? 0 : 1))
    const bin = steps.reduce((a, b) => a + b, 0)
    return { steps, bin, stack: counts[bin]++ }
  })
}

function GaltonBoard({ position, rotation }) {
  const balls = useRef()
  const paths = useRef({ c: -1, list: [] })
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const pegs = useMemo(() => {
    const out = []
    for (let r = 0; r < ROWS; r++) for (let j = 0; j <= r; j++) out.push([(j - r / 2) * DX, TOP - r * DY])
    return out
  }, [])
  const pegRef = useRef()
  const W = (ROWS + 3) * DX

  // the expected bell curve drawn over the bins, so you can watch the balls fill it in
  const curve = useMemo(() => {
    const px = 512
    const tex = canvasTex(px, px, (g) => {
      g.strokeStyle = PINK
      g.lineWidth = 8
      g.setLineDash([18, 12])
      g.beginPath()
      const sd = Math.sqrt(ROWS) / 2
      for (let x = 0; x <= px; x += 4) {
        const k = ((x / px - 0.5) * W) / DX + ROWS / 2 // bin index under this pixel
        const expect = (N_BALLS / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-((k - ROWS / 2) ** 2) / (2 * sd * sd))
        const y = px - (expect * BALL_R * 2 * px) / (BIN_TOP - BIN_BOTTOM)
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
      }
      g.stroke()
    })
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  }, [W])
  const title = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(1024, 192, (g, w, h) => {
          g.fillStyle = BLUE
          g.fillRect(0, 0, w, h)
          g.fillStyle = '#ffffff'
          g.font = 'bold 76px Georgia, serif'
          g.textAlign = 'center'
          g.fillText('Central Limit Theorem', w / 2, 88)
          g.fillStyle = PINK
          g.font = 'italic 52px Georgia, serif'
          g.fillText('watch the bell curve appear ♥', w / 2, 158)
        }),
      }),
    [],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (pegRef.current && !pegRef.current.userData.done) {
      pegs.forEach(([x, y], i) => {
        tmp.position.set(x, y, 0.02)
        tmp.rotation.set(Math.PI / 2, 0, 0)
        tmp.scale.set(0.008, 0.05, 0.008)
        tmp.updateMatrix()
        pegRef.current.setMatrixAt(i, tmp.matrix)
      })
      pegRef.current.instanceMatrix.needsUpdate = true
      pegRef.current.userData.done = true
    }
    const c = Math.floor(t / CYCLE)
    const tl = t - c * CYCLE
    if (paths.current.c !== c) paths.current = { c, list: cyclePaths(c) }
    paths.current.list.forEach((b, i) => {
      const a = tl - i * RELEASE
      if (a < 0 || tl > CYCLE - 0.4) {
        tmp.scale.setScalar(0)
      } else {
        tmp.scale.setScalar(BALL_R)
        if (a < ROWS * STEP_T) {
          const r = Math.floor(a / STEP_T)
          const u = a / STEP_T - r
          const k = b.steps.slice(0, r).reduce((s, v) => s + v, 0)
          const x0 = (k - r / 2) * DX
          const x1 = x0 + (b.steps[r] ? 0.5 : -0.5) * DX
          const y0 = TOP - r * DY + DY * 0.45
          tmp.position.set(x0 + (x1 - x0) * u, y0 - DY * u + Math.sin(u * Math.PI) * 0.025, 0.03)
        } else {
          const u = Math.min(1, (a - ROWS * STEP_T) / DROP_T)
          const x = (b.bin - ROWS / 2) * DX
          const yStart = TOP - ROWS * DY + DY * 0.45
          const yEnd = Math.min(BIN_TOP, BIN_BOTTOM + BALL_R + b.stack * BALL_R * 2)
          tmp.position.set(x, yStart + (yEnd - yStart) * u * u, 0.03)
        }
      }
      tmp.rotation.set(0, 0, 0)
      tmp.updateMatrix()
      balls.current.setMatrixAt(i, tmp.matrix)
    })
    balls.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* stand + backboard + frame */}
      {[-1, 1].map((sx) => (
        <B key={sx} g={BOX} c="#6b4426" p={[sx * (W / 2 + 0.03), 1.1, 0]} s={[0.05, 2.2, 0.08]} />
      ))}
      <B g={BOX} c="#f4f1ea" p={[0, 1.22, -0.02]} s={[W, 1.9, 0.03]} />
      <B g={BOX} c="#6b4426" p={[0, BIN_BOTTOM - 0.02, 0.02]} s={[W + 0.06, 0.04, 0.1]} />
      {/* funnel */}
      {[-1, 1].map((sx) => (
        <B key={sx} g={BOX} c="#6b4426" p={[sx * 0.09, TOP + 0.14, 0.03]} r={[0, 0, sx * 0.7]} s={[0.16, 0.015, 0.03]} />
      ))}
      {/* bin dividers */}
      {Array.from({ length: ROWS + 2 }, (_, k) => (
        <B key={k} g={BOX} c="#6b4426" p={[(k - (ROWS + 1) / 2) * DX, (BIN_BOTTOM + BIN_TOP) / 2, 0.03]} s={[0.008, BIN_TOP - BIN_BOTTOM, 0.04]} />
      ))}
      <instancedMesh ref={pegRef} args={[CYL, m('#8a8f98', { metalness: 0.6, roughness: 0.3 }), pegs.length]} frustumCulled={false} />
      <instancedMesh ref={balls} args={[SPH, m(PINK, { roughness: 0.35 }), N_BALLS]} frustumCulled={false} />
      <mesh material={curve} position={[0, (BIN_BOTTOM + BIN_TOP) / 2, 0.055]}>
        <planeGeometry args={[W, BIN_TOP - BIN_BOTTOM]} />
      </mesh>
      <mesh material={title} position={[0, TOP + 0.36, 0.01]}>
        <planeGeometry args={[W + 0.1, (W + 0.1) * (192 / 1024)]} />
      </mesh>
    </group>
  )
}

// a giant fuzzy-looking die; faces = pips for [+x, -x, +y, -y, +z, -z]
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]],
}
const dieFace = new Map()
function faceMat(n) {
  if (!dieFace.has(n)) {
    dieFace.set(
      n,
      new THREE.MeshStandardMaterial({
        roughness: 0.6,
        map: canvasTex(128, 128, (g) => {
          g.fillStyle = '#ffffff'
          g.fillRect(0, 0, 128, 128)
          g.fillStyle = n === 1 ? PINK : BLUE
          PIPS[n].forEach(([x, y]) => {
            g.beginPath()
            g.arc(x * 128, y * 128, n === 1 ? 20 : 13, 0, Math.PI * 2)
            g.fill()
          })
        }),
      }),
    )
  }
  return dieFace.get(n)
}

function Die({ position, rotation, faces }) {
  const mats = useMemo(() => faces.map(faceMat), [faces])
  return <mesh geometry={BOX} material={mats} position={[position[0], 0.21, position[2]]} rotation={[0, rotation, 0]} scale={0.42} />
}

// two shipping containers, a nod to his research on international trade
function containerMat(color, label) {
  return new THREE.MeshStandardMaterial({
    roughness: 0.7,
    map: canvasTex(512, 192, (g, w, h) => {
      g.fillStyle = color
      g.fillRect(0, 0, w, h)
      g.fillStyle = 'rgba(0,0,0,0.18)'
      for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 8, h)
      g.fillStyle = '#ffffff'
      g.font = 'bold 64px system-ui, sans-serif'
      g.textAlign = 'center'
      g.fillText(label, w / 2, h / 2 + 22)
    }),
  })
}
function Containers({ position, rotation }) {
  const [a, b] = useMemo(() => [containerMat('#c0392b', 'EXPORTS'), containerMat('#2f6fd6', 'IMPORTS')], [])
  return (
    <group position={position} rotation={[0, rotation + Math.PI / 2, 0]}>
      <mesh geometry={BOX} material={a} position={[0, 0.27, 0]} scale={[1.3, 0.54, 0.55]} />
      <mesh geometry={BOX} material={b} position={[0.05, 0.81, 0]} rotation={[0, 0.06, 0]} scale={[1.3, 0.54, 0.55]} />
    </group>
  )
}
