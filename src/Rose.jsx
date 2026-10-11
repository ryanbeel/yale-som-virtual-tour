import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTalkable } from './talkable.js'
import { Horse, at, bubbleMat } from './Allison.jsx'

// Rose, the teacher of room 2410: dark hair in a messy top bun with sunglasses pushed up, a red
// polka-dot dress, light-blue sneakers with perfectly tied bows, and an acoustic guitar she strums.
// Every so often she throws a fist in the air. Her room: a horse, a guitar amp + mic, a Nirvana
// poster, a suspiciously hidden "T.S." poster, and her official shoe-tying certificate.
// Figure faces +z. Click her (or tap Talk on a phone) to chat with her AI agent.

export const ROSE = {
  id: 'rose',
  name: 'Rose',
  course: 'Room 2410 · Guitar, Grunge & Horses',
  greeting: "Hey! Welcome to room 2410! Want to hear some Nirvana? It is NOT terrible music, no matter what anyone tells you. Ask me anything!",
  thinking: 'tuning my guitar…',
}

const SKIN = '#d9a47c'
const HAIR = '#2b1d16'
const RED = '#d62839'
const SNEAKER = '#9fd3f0'

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CAPSPH = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, 1.35)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const RING = new THREE.TorusGeometry(1, 0.2, 8, 20)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const SKIRT = new THREE.CylinderGeometry(0.16, 0.3, 0.42, 28, 1, true)
const BODICE = new THREE.CylinderGeometry(0.15, 0.16, 0.34, 24)
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

// red with white polka dots, like her dress in the photo
const polka = (() => {
  let mat
  return () => {
    if (mat) return mat
    const t = canvasTex(64, 64, (g) => {
      g.fillStyle = RED
      g.fillRect(0, 0, 64, 64)
      g.fillStyle = '#ffffff'
      for (const [x, y] of [[16, 16], [48, 48]]) {
        g.beginPath()
        g.arc(x, y, 7, 0, Math.PI * 2)
        g.fill()
      }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(7, 3)
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, side: THREE.DoubleSide })
    return mat
  }
})()

const BUBBLES = ['Nirvana rules!', 'I can tie my shoes!', 'Giddy up!', 'shh… I ♥ Taylor Swift', 'Rock on!']
const bubbleMats = BUBBLES.map((t) => bubbleMat(t, RED))
// cheap repeatable "random" for which bubble shows (and whether one shows) in each time slot
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function Arm({ side, upper, lower, fist }) {
  return (
    <group ref={upper} position={[0.17 * side, 1.18, 0]}>
      <B g={CAP} c={SKIN} p={[0, -0.11, 0]} s={[0.04, 0.075, 0.04]} />
      <group ref={lower} position={[0, -0.23, 0]}>
        <B g={CAP} c={SKIN} p={[0, -0.1, 0]} s={[0.036, 0.07, 0.036]} />
        <B c={SKIN} p={[0, -0.22, 0]} s={fist ? [0.042, 0.042, 0.042] : [0.035, 0.045, 0.03]} />
      </group>
    </group>
  )
}

function Guitar() {
  const WOOD = '#d08a46'
  return (
    <group>
      <B c={WOOD} o={{ roughness: 0.4 }} p={[-0.1, -0.02, 0]} s={[0.15, 0.17, 0.05]} />
      <B c={WOOD} o={{ roughness: 0.4 }} p={[0.06, 0.0, 0]} s={[0.11, 0.12, 0.05]} />
      <B g={CYL} c="#1a1210" p={[-0.03, 0, 0.045]} r={[Math.PI / 2, 0, 0]} s={[0.04, 0.01, 0.04]} />
      <B g={BOX} c="#3b2617" p={[-0.17, 0, 0.045]} s={[0.025, 0.07, 0.01]} />
      <B g={BOX} c="#5a3a22" p={[0.33, 0, 0.02]} s={[0.4, 0.04, 0.025]} />
      <B g={BOX} c="#2b1a10" p={[0.56, 0, 0.02]} r={[0, 0, 0.2]} s={[0.1, 0.06, 0.025]} />
      {[-0.012, 0, 0.012].map((y) => (
        <B key={y} g={BOX} c="#e8e8e8" o={{ metalness: 0.8 }} p={[0.18, y, 0.048]} s={[0.72, 0.002, 0.002]} />
      ))}
    </group>
  )
}

export default function Rose({ position, rotation = 0, front }) {
  const root = useRef()
  const hit = useRef()
  const head = useRef()
  const mouth = useRef()
  const upL = useRef()
  const loL = useRef()
  const upR = useRef()
  const loR = useRef()
  const bubble = useRef()
  const talk = useTalkable(ROSE, { position, rotation, root, hit, sway: 0.4 })

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { talking, speaking } = talk.current
    head.current.rotation.z = Math.sin(t * 2.4) * 0.07 // nodding along to grunge in her head
    head.current.rotation.x = talking ? Math.sin(t * 2.2) * 0.06 : Math.abs(Math.sin(t * 2.4)) * 0.08
    // right hand strums the guitar
    upR.current.rotation.set(-0.35, 0, -0.1)
    loR.current.rotation.set(-1.1, 0, 0.9 + Math.sin(t * (speaking ? 3 : 9)) * 0.18)
    // left hand: a fist pump every 8 seconds (or while she talks), otherwise on the guitar neck
    const pump = speaking ? 1 : Math.max(0, Math.sin(((t % 8) / 1.6) * Math.PI)) * (t % 8 < 1.6 ? 1 : 0)
    upL.current.rotation.set(-0.7 * (1 - pump), 0, 0.6 + pump * 2.1)
    loL.current.rotation.set(-1.0 * (1 - pump), 0, -0.3 * (1 - pump) + pump * 0.2)
    mouth.current.scale.y = speaking ? 0.011 + Math.abs(Math.sin(t * 14)) * 0.015 : 0.011
    // random bubbles: each 5-second slot may (or may not) show a random line
    const slot = Math.floor(t / 5)
    bubble.current.material = bubbleMats[Math.floor(hash(slot) * BUBBLES.length)]
    bubble.current.visible = !talking && hash(slot + 0.5) < 0.7 && t % 5 < 2.2
  })

  return (
    <>
      <group ref={root} position={position} rotation={[0, rotation, 0]}>
        <mesh ref={hit} geometry={CYL} position={[0, 0.8, 0]} scale={[0.45, 1.6, 0.45]} visible={false} />
        <RoseBody rig={{ head, mouth, upL, loL, upR, loR }} />

        <sprite ref={bubble} material={bubbleMats[0]} position={[0.25, 1.85, 0]} scale={[0.66, 0.33, 1]} />
      </group>
      <RoseRoom front={front} rotation={rotation} />
    </>
  )
}

// ---------- her classroom
function RoseRoom({ front, rotation }) {
  const { half } = front
  return (
    <>
      <Horse position={at(front, 1.3, half * 0.62)} rotation={rotation - Math.PI / 2} saddle={[RED, '#2b2b30']} />
      <AmpAndMic position={at(front, 0.75, -half * 0.6)} rotation={rotation + 0.35} />
      <Poster position={at(front, 0.35, half * 0.22)} rotation={rotation} />
      <Certificate position={at(front, 0.55, -half * 0.3 + 0.75)} rotation={rotation - 0.2} />
    </>
  )
}

function AmpAndMic({ position, rotation }) {
  const grill = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.9,
        map: canvasTex(256, 256, (g, w, h) => {
          g.fillStyle = '#1a1a1e'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#2c2c32'
          for (let i = 0; i < w; i += 8) {
            g.beginPath()
            g.moveTo(i, 0)
            g.lineTo(i, h)
            g.stroke()
          }
          g.fillStyle = '#d9b45a'
          g.font = 'bold italic 40px Georgia, serif'
          g.textAlign = 'center'
          g.fillText('LOUD', w / 2, 46)
        }),
      }),
    [],
  )
  // the "T.S. (shh!)" sign tucked behind the amp, peeking out
  const secret = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(256, 192, (g, w, h) => {
          g.fillStyle = '#ffd6ea'
          g.fillRect(0, 0, w, h)
          g.fillStyle = '#b5179e'
          g.font = 'bold 84px Georgia, serif'
          g.textAlign = 'center'
          g.fillText('T.S. ♥', w / 2, 100)
          g.font = 'italic 36px Georgia, serif'
          g.fillText('(shh!)', w / 2, 158)
        }),
      }),
    [],
  )
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <B g={BOX} c="#2a2a2e" p={[0, 0.3, 0]} s={[0.6, 0.6, 0.32]} />
      <mesh geometry={BOX} material={grill} position={[0, 0.27, 0.162]} scale={[0.54, 0.48, 0.005]} />
      <B g={BOX} c="#d9b45a" o={{ metalness: 0.6, roughness: 0.4 }} p={[0, 0.57, 0.163]} s={[0.54, 0.04, 0.005]} />
      <mesh material={secret} position={[0.2, 0.62, -0.18]} rotation={[0, 0, 0.18]}>
        <planeGeometry args={[0.36, 0.27]} />
      </mesh>
      {/* mic stand */}
      <B g={CYL} c="#1d1d22" p={[0.55, 0.01, 0.15]} s={[0.15, 0.02, 0.15]} />
      <B g={CYL} c="#c0c4c8" o={{ metalness: 0.8, roughness: 0.25 }} p={[0.55, 0.7, 0.15]} s={[0.012, 1.4, 0.012]} />
      <B g={CAP} c="#3a3a40" p={[0.55, 1.45, 0.2]} r={[0.6, 0, 0]} s={[0.03, 0.04, 0.03]} />
    </group>
  )
}

function Poster({ position, rotation }) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(768, 1024, (g, w, h) => {
          g.fillStyle = '#121214'
          g.fillRect(0, 0, w, h)
          g.fillStyle = '#f2e86d'
          g.font = 'bold 132px Impact, "Arial Black", sans-serif'
          g.textAlign = 'center'
          g.fillText('NIRVANA', w / 2, 230)
          g.fillStyle = '#ffffff'
          g.font = 'bold 54px system-ui, sans-serif'
          g.fillText('IS NOT TERRIBLE', w / 2, 400)
          g.fillText('MUSIC.', w / 2, 470)
          g.fillStyle = '#ff7a7a'
          g.font = 'italic 44px Georgia, serif'
          g.fillText('— Rose (correct)', w / 2, 600)
          g.strokeStyle = '#f2e86d'
          g.lineWidth = 10
          g.strokeRect(24, 24, w - 48, h - 48)
          g.fillStyle = '#9fd3f0'
          g.font = 'bold 40px system-ui, sans-serif'
          g.fillText('🎸 GRUNGE FOREVER 🎸', w / 2, 860)
        }),
      }),
    [],
  )
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-1, 1].map((sx) => (
        <B key={sx} g={CYL} c="#3a3a40" o={{ metalness: 0.6 }} p={[sx * 0.38, 0.95, 0]} s={[0.018, 1.9, 0.018]} />
      ))}
      <mesh material={mat} position={[0, 1.4, 0.01]}>
        <planeGeometry args={[0.72, 0.96]} />
      </mesh>
    </group>
  )
}

function Certificate({ position, rotation }) {
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(768, 576, (g, w, h) => {
          g.fillStyle = '#fbf6e6'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#c9a44a'
          g.lineWidth = 18
          g.strokeRect(18, 18, w - 36, h - 36)
          g.textAlign = 'center'
          g.fillStyle = '#7a5a1a'
          g.font = 'bold 44px Georgia, serif'
          g.fillText('OFFICIAL CERTIFICATE', w / 2, 110)
          g.fillStyle = '#2a1d10'
          g.font = 'italic 34px Georgia, serif'
          g.fillText('This certifies that', w / 2, 190)
          g.font = 'bold 72px Georgia, serif'
          g.fillStyle = RED
          g.fillText('ROSE', w / 2, 280)
          g.fillStyle = '#2a1d10'
          g.font = 'italic 34px Georgia, serif'
          g.fillText('knows how to tie her shoes.', w / 2, 350)
          g.font = 'bold 32px Georgia, serif'
          g.fillText('Bunny ears AND double knot. ✓', w / 2, 420)
          g.fillStyle = '#d62839'
          g.beginPath()
          g.arc(w - 120, h - 110, 52, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#ffffff'
          g.font = 'bold 26px Georgia, serif'
          g.fillText('A+', w - 120, h - 100)
        }),
      }),
    [],
  )
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* little easel */}
      {[-1, 1].map((sx) => (
        <B key={sx} g={CYL} c="#8a5a34" p={[sx * 0.25, 0.55, 0.05]} r={[-0.15, 0, sx * -0.12]} s={[0.018, 1.1, 0.018]} />
      ))}
      <B g={CYL} c="#8a5a34" p={[0, 0.5, -0.15]} r={[0.35, 0, 0]} s={[0.018, 1.0, 0.018]} />
      <B g={BOX} c="#c9a44a" o={{ metalness: 0.5, roughness: 0.4 }} p={[0, 0.82, 0.08]} r={[-0.15, 0, 0]} s={[0.58, 0.45, 0.02]} />
      <mesh material={mat} position={[0, 0.82, 0.093]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[0.54, 0.405]} />
      </mesh>
    </group>
  )
}

// Rose's body, guitar included (classroom and the island band share it). Faces +z.
// `rig` holds refs ({ head, mouth, upL, loL, upR, loR }) so the owner can animate it.
export function RoseBody({ rig }) {
  return (
    <group>
      {/* light-blue sneakers with neatly tied bows (she can tie her shoes, thank you) */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={BOX} c={SNEAKER} p={[0.075 * sx, 0.04, 0.03]} s={[0.09, 0.075, 0.2]} />
          <B g={BOX} c="#ffffff" p={[0.075 * sx, 0.006, 0.03]} s={[0.095, 0.015, 0.205]} />
          <B g={RING} c="#ffffff" p={[0.075 * sx - 0.018, 0.085, 0.07]} r={[Math.PI / 2, 0, 0.5]} s={0.016} />
          <B g={RING} c="#ffffff" p={[0.075 * sx + 0.018, 0.085, 0.07]} r={[Math.PI / 2, 0, -0.5]} s={0.016} />
          <B g={CYL} c={SKIN} p={[0.075 * sx, 0.29, 0]} s={[0.045, 0.44, 0.045]} />
        </group>
      ))}

      {/* red polka-dot dress */}
      <mesh geometry={SKIRT} material={polka()} position={[0, 0.69, 0]} />
      <mesh geometry={BODICE} material={polka()} position={[0, 1.06, 0]} />
      <B c={SKIN} p={[0, 1.22, 0.02]} s={[0.15, 0.05, 0.11]} />
      {[-1, 1].map((sx) => (
        <B key={sx} g={BOX} c={RED} p={[0.08 * sx, 1.22, 0]} s={[0.025, 0.06, 0.2]} />
      ))}

      {/* guitar on a black strap, slung across her front */}
      <B g={BOX} c="#141418" p={[0, 1.04, 0.05]} r={[0, 0, -0.75]} s={[0.035, 0.52, 0.17]} />
      <group position={[-0.02, 0.86, 0.19]} rotation={[0, 0, 0.45]}>
        <Guitar />
      </group>
      <Arm side={-1} upper={rig.upR} lower={rig.loR} />
      <Arm side={1} upper={rig.upL} lower={rig.loL} fist />

      {/* head: messy top bun, sunglasses pushed up, brown eyes */}
      <B g={CYL} c={SKIN} p={[0, 1.27, 0]} s={[0.038, 0.06, 0.038]} />
      <group ref={rig.head} position={[0, 1.38, 0]}>
        <B c={SKIN} p={[0, 0, 0]} s={[0.1, 0.118, 0.105]} />
        <B g={CAPSPH} c={HAIR} o={{ roughness: 0.95 }} p={[0, 0.008, -0.008]} s={[0.108, 0.126, 0.113]} />
        <B c={HAIR} o={{ roughness: 0.95 }} p={[0, 0.15, -0.02]} s={[0.065, 0.055, 0.065]} />
        <B c={HAIR} o={{ roughness: 0.95 }} p={[0.03, 0.18, 0.0]} s={[0.035, 0.03, 0.035]} />
        <B c={HAIR} o={{ roughness: 0.95 }} p={[-0.035, 0.17, -0.03]} s={[0.03, 0.035, 0.03]} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={CAP} c={HAIR} o={{ roughness: 0.95 }} p={[0.092 * sx, -0.05, 0.02]} r={[0, 0, 0.1 * sx]} s={[0.02, 0.05, 0.03]} />
            <B c="#ffffff" p={[0.038 * sx, 0.012, 0.09]} s={[0.019, 0.016, 0.01]} />
            <B c="#3a2414" p={[0.038 * sx, 0.012, 0.098]} s={[0.011, 0.012, 0.007]} />
            <B g={BOX} c={HAIR} p={[0.04 * sx, 0.045, 0.096]} r={[0, 0, 0.12 * sx]} s={[0.036, 0.009, 0.008]} />
            <B c="#e88a7a" p={[0.06 * sx, -0.03, 0.085]} s={[0.018, 0.011, 0.007]} />
            {/* rose-tinted sunglasses pushed up on her head */}
            <B c="#e8a090" o={{ roughness: 0.15, transparent: true, opacity: 0.85 }} p={[0.042 * sx, 0.105, 0.088]} r={[-0.55, 0, 0]} s={[0.036, 0.03, 0.01]} />
            <B g={RING} c="#c9a44a" o={{ metalness: 0.8, roughness: 0.3 }} p={[0.042 * sx, 0.105, 0.09]} r={[-0.55, 0, 0]} s={[0.037, 0.031, 0.04]} />
          </group>
        ))}
        <B c={SKIN} p={[0, -0.01, 0.103]} s={[0.015, 0.02, 0.016]} />
        <mesh ref={rig.mouth} geometry={SPH} material={m('#a83b4a')} position={[0, -0.05, 0.094]} scale={[0.035, 0.011, 0.009]} />
        <B g={BOX} c="#ffffff" p={[0, -0.044, 0.1]} s={[0.042, 0.007, 0.003]} />
      </group>
    </group>
  )
}
