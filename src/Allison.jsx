import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ease, useTalkable } from './talkable.js'

// Allison, honorary professor of room 2400: long wavy brown hair, sunglasses pushed up on her head,
// a pink hoodie with colorful scallop patches, jeans and riding boots, hands on her hips.
// Her tuxedo cat Ryan Jr. stands next to her (she's allergic: achoo!). Her room has a horse,
// a hay bale, a debate club banner, and (as a joke) a drum set she refuses to play.
// Figure faces +z. Click her (or tap Talk on a phone) to chat with her AI agent.

export const ALLISON = {
  id: 'allison',
  name: 'Allison',
  course: 'Room 2400 · Honorary Professor',
  greeting: "Hiii! Welcome to my classroom! That's Ryan Jr., isn't he the cutest?? (achoo!) Ask me anything. Except about the drums. We don't talk about the drums.",
  thinking: 'thinking… (achoo!)',
}

const SKIN = '#f3d2bd'
const HAIR = '#6b4a32'
const HOODIE = '#ff8cc6'
const JEANS = '#3d5a8a'
const BOOT = '#5a3820'
const PINK = '#ff4fa3'

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CAPSPH = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, 1.4)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CONE = new THREE.ConeGeometry(1, 1, 16)
const RING = new THREE.TorusGeometry(1, 0.12, 8, 24)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const TORSO = new THREE.CylinderGeometry(0.165, 0.19, 0.46, 24)
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

export function bubbleMat(text, color = PINK) {
  return new THREE.SpriteMaterial({
    transparent: true,
    depthWrite: false,
    map: canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#ffffff'
      g.strokeStyle = color
      g.lineWidth = 10
      g.beginPath()
      g.roundRect(10, 10, w - 20, h - 70, 50)
      g.moveTo(w / 2 - 30, h - 62)
      g.lineTo(w / 2 - 50, h - 10)
      g.lineTo(w / 2 + 10, h - 62)
      g.fill()
      g.stroke()
      g.fillStyle = '#2a1d2e'
      g.font = 'bold 64px system-ui, sans-serif'
      g.textAlign = 'center'
      g.fillText(text, w / 2, 130)
    }),
  })
}
const BUBBLES = ['Achoo!', 'Ryan Jr. ♥', 'NOT the drums!']
const bubbleMats = BUBBLES.map((t) => bubbleMat(t))

// position along the classroom's front frame: `back` meters into the room, `wall` meters along the front wall
export function at(front, back, wall) {
  const { fc, back: b, t } = front
  return [fc[0] + b[0] * back + t[0] * wall, 0, fc[1] + b[1] * back + t[1] * wall]
}

// an arm with an elbow; `side` +1 is her left (+x). Hands rest on her hips unless she's gesturing.
function Arm({ side, upper, lower }) {
  return (
    <group ref={upper} position={[0.2 * side, 1.31, 0]}>
      <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.12, 0]} scale={[0.055, 0.08, 0.055]} />
      <group ref={lower} position={[0, -0.25, 0]}>
        <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.1, 0]} scale={[0.048, 0.07, 0.048]} />
        <B g={CYL} c="#2ec4a6" p={[0, -0.2, 0]} s={[0.05, 0.035, 0.05]} />
        <B c={SKIN} p={[0, -0.25, 0]} s={[0.04, 0.045, 0.035]} />
      </group>
    </group>
  )
}

export default function Allison({ position, rotation = 0, front }) {
  const { camera } = useThree()
  const root = useRef()
  const hit = useRef()
  const head = useRef()
  const mouth = useRef()
  const upL = useRef()
  const loL = useRef()
  const upR = useRef()
  const loR = useRef()
  const bubble = useRef()
  const cat = useRef()
  const talk = useTalkable(ALLISON, { position, rotation, root, hit, sway: 0.4 })
  const catPos = useMemo(() => at(front, 1.75, -front.half * 0.3 + 0.7), [front])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { talking, speaking } = talk.current
    // energetic: a little bounce on her toes and a head bop
    root.current.position.y = Math.abs(Math.sin(t * 3.2)) * (speaking ? 0.04 : 0.02)
    head.current.rotation.z = Math.sin(t * 1.6) * 0.08
    head.current.rotation.x = talking ? Math.sin(t * 2.4) * 0.06 : 0
    // hands on hips; her right hand (-x) talks while she answers
    upL.current.rotation.set(0, 0, 0.7)
    loL.current.rotation.set(0, 0, -1.9)
    if (speaking) {
      upR.current.rotation.set(-0.9 + Math.sin(t * 5) * 0.25, 0, -0.35)
      loR.current.rotation.set(-0.6, 0, 0.4 + Math.sin(t * 6) * 0.3)
    } else {
      upR.current.rotation.set(0, 0, -0.7)
      loR.current.rotation.set(0, 0, 1.9)
    }
    mouth.current.scale.y = speaking ? 0.012 + Math.abs(Math.sin(t * 14)) * 0.016 : 0.012
    // "Achoo!" / "Ryan Jr. ♥" / "NOT the drums!" pop up when nobody's chatting
    bubble.current.material = bubbleMats[Math.floor(t / 6) % BUBBLES.length]
    bubble.current.visible = !talking && t % 6 < 2
    // Ryan Jr. turns to look at you too
    const toCam = Math.atan2(camera.position.x - catPos[0], camera.position.z - catPos[2])
    cat.current.rotation.y = ease(cat.current.rotation.y, talking ? toCam : rotation + 0.6, 0.06)
  })

  return (
    <>
      <group ref={root} position={position} rotation={[0, rotation, 0]}>
        <mesh ref={hit} geometry={CYL} position={[0, 0.85, 0]} scale={[0.45, 1.7, 0.45]} visible={false} />

        {/* riding boots + jeans */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={BOX} c={BOOT} p={[0.085 * sx, 0.04, 0.035]} s={[0.1, 0.08, 0.23]} />
            <B g={CYL} c={BOOT} p={[0.085 * sx, 0.24, 0]} s={[0.075, 0.42, 0.075]} />
            <B g={CYL} c="#4a2c18" p={[0.085 * sx, 0.45, 0]} s={[0.079, 0.03, 0.079]} />
            <B g={CYL} c={JEANS} p={[0.085 * sx, 0.68, 0]} s={[0.075, 0.48, 0.075]} />
          </group>
        ))}
        <B g={CYL} c={JEANS} p={[0, 0.9, 0]} s={[0.17, 0.12, 0.13]} />

        {/* pink hoodie with scallop patches (purple, teal, magenta) and a zipper */}
        <mesh geometry={TORSO} material={m(HOODIE)} position={[0, 1.1, 0]} />
        <B c={HOODIE} p={[0, 1.31, 0]} s={[0.22, 0.08, 0.15]} />
        <B c={HOODIE} p={[0, 1.33, -0.1]} s={[0.15, 0.09, 0.08]} />
        <B g={CYL} c="#2ec4a6" p={[0, 0.89, 0]} s={[0.192, 0.04, 0.16]} />
        <B g={BOX} c="#d96aa6" p={[0, 1.1, 0.18]} s={[0.012, 0.44, 0.01]} />
        {[[-0.08, 1.2, '#7a4fd1'], [0.09, 1.23, '#2ec4a6'], [0.1, 1.0, PINK], [-0.1, 0.98, '#2ec4a6'], [0.0, 1.27, '#7a4fd1']].map(([x, y, c], i) => (
          <B key={i} c={c} p={[x, y, 0.175]} r={[0, 0, Math.PI]} s={[0.045, 0.028, 0.012]} />
        ))}
        <Arm side={1} upper={upL} lower={loL} />
        <Arm side={-1} upper={upR} lower={loR} />

        {/* head: long wavy brown hair, sunglasses up top, big smile, little gold necklace */}
        <B g={CYL} c={SKIN} p={[0, 1.38, 0]} s={[0.042, 0.07, 0.042]} />
        <B g={RING} c="#d9b45a" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 1.36, 0.02]} r={[Math.PI / 2 - 0.3, 0, 0]} s={[0.06, 0.06, 0.06]} />
        <group ref={head} position={[0, 1.5, 0]}>
          <B c={SKIN} p={[0, 0, 0]} s={[0.105, 0.125, 0.11]} />
          <B g={CAPSPH} c={HAIR} o={{ roughness: 0.9 }} p={[0, 0.01, -0.01]} s={[0.115, 0.135, 0.12]} />
          <B c={HAIR} o={{ roughness: 0.9 }} p={[0, -0.04, -0.06]} s={[0.13, 0.16, 0.09]} />
          <B g={CAP} c={HAIR} o={{ roughness: 0.9 }} p={[0, -0.22, -0.08]} s={[0.12, 0.12, 0.06]} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              {/* wavy side curtains down to her shoulders */}
              <B g={CAP} c={HAIR} o={{ roughness: 0.9 }} p={[0.095 * sx, -0.08, 0.01]} s={[0.032, 0.08, 0.045]} />
              <B c={HAIR} o={{ roughness: 0.9 }} p={[0.11 * sx, -0.24, -0.01]} s={[0.045, 0.06, 0.045]} />
              <B c={HAIR} o={{ roughness: 0.9 }} p={[0.12 * sx, -0.33, -0.04]} s={[0.04, 0.055, 0.04]} />
              {/* eyes, brows, rosy cheeks */}
              <B c="#ffffff" p={[0.04 * sx, 0.015, 0.095]} s={[0.02, 0.016, 0.01]} />
              <B c="#4a2e1c" p={[0.04 * sx, 0.015, 0.103]} s={[0.011, 0.012, 0.007]} />
              <B g={BOX} c={HAIR} p={[0.042 * sx, 0.05, 0.1]} r={[0, 0, 0.15 * sx]} s={[0.04, 0.008, 0.008]} />
              <B c="#f7a7b4" p={[0.065 * sx, -0.03, 0.09]} s={[0.022, 0.013, 0.008]} />
              {/* sunglasses pushed up on her head */}
              <B g={BOX} c="#141418" o={{ roughness: 0.2 }} p={[0.045 * sx, 0.115, 0.098]} r={[-0.5, 0, 0]} s={[0.052, 0.032, 0.014]} />
            </group>
          ))}
          <B g={BOX} c="#141418" p={[0, 0.118, 0.1]} r={[-0.5, 0, 0]} s={[0.035, 0.009, 0.009]} />
          <B c={SKIN} p={[0, -0.01, 0.11]} s={[0.016, 0.022, 0.018]} />
          <mesh ref={mouth} geometry={SPH} material={m('#b8455a')} position={[0, -0.055, 0.1]} scale={[0.04, 0.012, 0.01]} />
          <B g={BOX} c="#ffffff" p={[0, -0.048, 0.106]} s={[0.05, 0.008, 0.003]} />
        </group>

        <sprite ref={bubble} material={bubbleMats[0]} position={[0.25, 1.95, 0]} scale={[0.6, 0.3, 1]} />
      </group>

      <group ref={cat} position={catPos} rotation={[0, rotation + 0.6, 0]}>
        <RyanJr />
      </group>
      <AllisonRoom front={front} rotation={rotation} />
    </>
  )
}

// ---------- Ryan Jr.: black-and-white tuxedo cat with a red collar, swishing his tail
function RyanJr() {
  const tail = useRef()
  const headRef = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    tail.current.rotation.z = Math.sin(t * 2.2) * 0.4
    headRef.current.rotation.z = Math.sin(t * 0.7) * 0.12
  })
  const BLACK = '#1d1d22'
  const WHITE = '#f6f4ef'
  return (
    <group scale={1.15}>
      <B c={BLACK} p={[0, 0.24, -0.02]} s={[0.12, 0.11, 0.2]} />
      <B c={WHITE} p={[0, 0.21, 0.08]} s={[0.085, 0.09, 0.1]} />
      {[[-0.065, 0.12], [0.065, 0.12], [-0.065, -0.14], [0.065, -0.14]].map(([x, z], i) => (
        <group key={i}>
          <B g={CYL} c={BLACK} p={[x, 0.09, z]} s={[0.032, 0.16, 0.032]} />
          <B c={WHITE} p={[x, 0.02, z + 0.01]} s={[0.035, 0.022, 0.045]} />
        </group>
      ))}
      <group ref={tail} position={[0, 0.28, -0.2]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <B key={i} c={i === 4 ? WHITE : BLACK} p={[0, i * 0.055, -0.03 - Math.sin(i * 0.5) * 0.04]} s={[0.025, 0.035, 0.025]} />
        ))}
      </group>
      <B g={CYL} c="#d62839" p={[0, 0.33, 0.12]} r={[0.4, 0, 0]} s={[0.065, 0.02, 0.065]} />
      <B g={CYL} c="#d9b45a" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 0.3, 0.18]} r={[Math.PI / 2, 0, 0]} s={[0.02, 0.005, 0.02]} />
      <group ref={headRef} position={[0, 0.42, 0.15]}>
        <B c={BLACK} p={[0, 0, 0]} s={[0.1, 0.09, 0.09]} />
        <B c={WHITE} p={[0, -0.035, 0.06]} s={[0.055, 0.042, 0.04]} />
        <B c={WHITE} p={[0, 0.02, 0.075]} s={[0.012, 0.04, 0.012]} />
        <B c="#ff8fa3" p={[0, -0.012, 0.098]} s={[0.012, 0.009, 0.007]} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={CONE} c={BLACK} p={[0.06 * sx, 0.085, 0]} r={[0, 0, -0.3 * sx]} s={[0.035, 0.07, 0.025]} />
            <B g={CONE} c="#ff8fa3" p={[0.058 * sx, 0.08, 0.01]} r={[0, 0, -0.3 * sx]} s={[0.018, 0.045, 0.01]} />
            <B c="#c8e04a" p={[0.04 * sx, 0.012, 0.075]} s={[0.022, 0.024, 0.014]} />
            <B c="#111111" p={[0.04 * sx, 0.012, 0.087]} s={[0.007, 0.018, 0.006]} />
            {[-0.012, 0.004].map((dy) => (
              <B key={dy} g={BOX} c="#ffffff" p={[0.07 * sx, -0.03 + dy, 0.075]} r={[0, 0, 0.1 * sx]} s={[0.07, 0.003, 0.003]} />
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

// ---------- her classroom: a horse, a hay bale, a debate club banner, and the dreaded drum set
function AllisonRoom({ front, rotation }) {
  const { half } = front
  return (
    <>
      <Horse position={at(front, 1.3, half * 0.62)} rotation={rotation - Math.PI / 2} />
      <HayBale position={at(front, 0.6, half * 0.42)} rotation={rotation + 0.3} />
      <DrumSet position={at(front, 0.9, -half * 0.62)} rotation={rotation + 0.5} />
      <DebateBanner position={at(front, 0.35, half * 0.2)} rotation={rotation} />
    </>
  )
}

export function Horse({ position, rotation, saddle = [PINK, '#7a4fd1'] }) {
  const neck = useRef()
  const tail = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    neck.current.rotation.x = -0.6 + Math.sin(t * 0.8) * 0.12
    tail.current.rotation.z = Math.sin(t * 1.7) * 0.35
  })
  const COAT = '#8a5a34'
  const MANE = '#2e1d12'
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <B c={COAT} p={[0, 1.05, 0]} s={[0.32, 0.32, 0.62]} />
      {[[-0.17, 0.4], [0.17, 0.4], [-0.17, -0.4], [0.17, -0.4]].map(([x, z], i) => (
        <group key={i}>
          <B g={CYL} c={COAT} p={[x, 0.5, z]} s={[0.075, 0.95, 0.075]} />
          <B g={CYL} c="#f2ece2" p={[x, 0.12, z]} s={[0.082, 0.14, 0.082]} />
          <B g={CYL} c="#2b2b2b" p={[x, 0.03, z]} s={[0.088, 0.06, 0.088]} />
        </group>
      ))}
      {/* saddle in her colors */}
      <B c={saddle[0]} p={[0, 1.33, 0.05]} s={[0.3, 0.07, 0.28]} />
      <B g={BOX} c={saddle[1]} p={[0, 1.2, 0.05]} s={[0.67, 0.28, 0.4]} />
      <group ref={neck} position={[0, 1.25, 0.5]}>
        <B g={CAP} c={COAT} p={[0, 0.3, 0]} s={[0.14, 0.22, 0.15]} />
        {[0, 1, 2, 3, 4].map((i) => (
          <B key={i} c={MANE} p={[0, 0.12 + i * 0.1, -0.12]} s={[0.05, 0.07, 0.06]} />
        ))}
        <group position={[0, 0.58, 0.12]} rotation={[1.0, 0, 0]}>
          <B c={COAT} p={[0, 0, 0.1]} s={[0.13, 0.13, 0.26]} />
          <B c="#6e4628" p={[0, -0.02, 0.32]} s={[0.1, 0.09, 0.08]} />
          <B g={BOX} c="#f2ece2" p={[0, 0.07, 0.2]} s={[0.04, 0.02, 0.18]} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c="#ffffff" p={[0.1 * sx, 0.05, 0.15]} s={[0.03, 0.035, 0.03]} />
              <B c="#1b1b1f" p={[0.115 * sx, 0.05, 0.16]} s={[0.018, 0.022, 0.02]} />
              <B g={CONE} c={COAT} p={[0.06 * sx, 0.16, 0.0]} r={[-0.3, 0, 0]} s={[0.035, 0.09, 0.03]} />
              <B c="#2b1a10" p={[0.04 * sx, -0.03, 0.4]} s={[0.014, 0.014, 0.008]} />
            </group>
          ))}
        </group>
      </group>
      <group ref={tail} position={[0, 1.12, -0.6]}>
        <B g={CAP} c={MANE} p={[0, -0.25, -0.05]} r={[0.3, 0, 0]} s={[0.06, 0.2, 0.06]} />
      </group>
    </group>
  )
}

function HayBale({ position, rotation }) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 1,
        map: canvasTex(128, 128, (g) => {
          g.fillStyle = '#e2c26a'
          g.fillRect(0, 0, 128, 128)
          for (let i = 0; i < 260; i++) {
            g.strokeStyle = i % 3 ? '#c9a24a' : '#f2dc8a'
            g.beginPath()
            const x = (i * 37) % 128
            const y = (i * 53) % 128
            g.moveTo(x, y)
            g.lineTo(x + 10, y + ((i % 5) - 2))
            g.stroke()
          }
          g.fillStyle = '#7a5a2a'
          g.fillRect(0, 36, 128, 4)
          g.fillRect(0, 88, 128, 4)
        }),
      }),
    [],
  )
  return <mesh geometry={BOX} material={mat} position={[position[0], 0.22, position[2]]} rotation={[0, rotation, 0]} scale={[0.8, 0.44, 0.48]} />
}

function DebateBanner({ position, rotation }) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(1024, 384, (g, w, h) => {
          g.fillStyle = '#2a1d4e'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = PINK
          g.lineWidth = 14
          g.strokeRect(10, 10, w - 20, h - 20)
          g.fillStyle = '#ffffff'
          g.textAlign = 'center'
          g.font = 'bold 96px Georgia, serif'
          g.fillText('DEBATE CLUB', w / 2, 130)
          g.fillStyle = '#ffd6ea'
          g.font = 'italic 50px Georgia, serif'
          g.fillText('Resolved: Ryan Jr. is the best cat.', w / 2, 225)
          g.fillStyle = '#2ec4a6'
          g.font = 'bold 54px system-ui, sans-serif'
          g.fillText('AFFIRMATIVE WINS ♥', w / 2, 320)
        }),
      }),
    [],
  )
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-1, 1].map((sx) => (
        <B key={sx} g={CYL} c="#c9a44a" o={{ metalness: 0.7, roughness: 0.3 }} p={[sx * 0.62, 1.0, 0]} s={[0.02, 2.0, 0.02]} />
      ))}
      <mesh material={mat} position={[0, 1.65, 0.01]}>
        <planeGeometry args={[1.25, 0.47]} />
      </mesh>
    </group>
  )
}

// the drum set everyone says she should play (she will not)
function DrumSet({ position, rotation }) {
  const crash = useRef()
  const head = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.6,
        map: canvasTex(256, 256, (g, w, h) => {
          g.fillStyle = '#ffffff'
          g.beginPath()
          g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#d62839'
          g.font = 'bold 74px system-ui, sans-serif'
          g.textAlign = 'center'
          g.fillText('NOPE.', w / 2, h / 2 + 8)
          g.font = 'bold 26px system-ui, sans-serif'
          g.fillStyle = '#2a1d2e'
          g.fillText("— Allison", w / 2, h / 2 + 52)
        }),
      }),
    [],
  )
  useFrame(({ clock }) => {
    crash.current.rotation.x = Math.sin(clock.elapsedTime * 7) * 0.04
  })
  const SHELL = '#7a1f3d'
  const CHROME = { metalness: 0.8, roughness: 0.25 }
  const GOLD = { metalness: 0.9, roughness: 0.3 }
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* bass drum on its side, front head facing the class */}
      <group position={[0, 0.3, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <B g={CYL} c={SHELL} p={[0, 0, 0]} s={[0.3, 0.32, 0.3]} />
        <mesh geometry={CYL} material={head} position={[0, 0.163, 0]} scale={[0.29, 0.004, 0.29]} rotation={[0, Math.PI / 2, 0]} />
      </group>
      {/* toms + snare + floor tom */}
      {[[-0.16, 0.72, 0.12, 0.13], [0.16, 0.72, 0.12, 0.13], [-0.42, 0.62, -0.05, 0.15], [0.45, 0.48, -0.1, 0.18]].map(([x, y, z, r], i) => (
        <group key={i}>
          <B g={CYL} c={i === 2 ? '#c0c4c8' : SHELL} o={i === 2 ? CHROME : {}} p={[x, y, z]} r={[0.3, 0, 0]} s={[r, r * 1.1, r]} />
          <B g={CYL} c="#f6f4ef" p={[x, y + r * 0.56, z + 0.05]} r={[0.3, 0, 0]} s={[r * 0.97, 0.01, r * 0.97]} />
          <B g={CYL} c="#c0c4c8" o={CHROME} p={[x, y / 2, z - 0.05]} s={[0.012, y, 0.012]} />
        </group>
      ))}
      {/* hi-hat, crash and ride */}
      <B g={CYL} c="#c0c4c8" o={CHROME} p={[-0.65, 0.5, -0.05]} s={[0.012, 1.0, 0.012]} />
      <B g={CYL} c="#d9b45a" o={GOLD} p={[-0.65, 1.0, -0.05]} s={[0.17, 0.008, 0.17]} />
      <B g={CYL} c="#d9b45a" o={GOLD} p={[-0.65, 1.03, -0.05]} s={[0.17, 0.008, 0.17]} />
      <B g={CYL} c="#c0c4c8" o={CHROME} p={[-0.3, 0.65, -0.35]} s={[0.012, 1.3, 0.012]} />
      <group ref={crash} position={[-0.3, 1.32, -0.35]} rotation={[0.25, 0, 0]}>
        <B g={CYL} c="#d9b45a" o={GOLD} p={[0, 0, 0]} s={[0.22, 0.008, 0.22]} />
      </group>
      <B g={CYL} c="#c0c4c8" o={CHROME} p={[0.55, 0.6, -0.35]} s={[0.012, 1.2, 0.012]} />
      <B g={CYL} c="#d9b45a" o={GOLD} p={[0.55, 1.2, -0.35]} r={[0.2, 0, -0.15]} s={[0.25, 0.008, 0.25]} />
      {/* empty throne (nobody's sitting there) + sticks left on the snare */}
      <B g={CYL} c="#1d1d22" p={[0, 0.45, -0.55]} s={[0.15, 0.06, 0.15]} />
      <B g={CYL} c="#c0c4c8" o={CHROME} p={[0, 0.21, -0.55]} s={[0.02, 0.42, 0.02]} />
      {[-0.03, 0.03].map((dx) => (
        <B key={dx} g={CYL} c="#e8d3a6" p={[-0.42 + dx, 0.72, 0.0]} r={[0, 0.4, Math.PI / 2]} s={[0.008, 0.35, 0.008]} />
      ))}
    </group>
  )
}
