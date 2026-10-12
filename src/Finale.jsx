import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { AllisonBody, DrumSet, Horse, RyanJr } from './Allison.jsx'
import { RoseBody } from './Rose.jsx'
import { ZamanBody } from './Zaman.jsx'
import { SchottBody } from './Schott.jsx'
import { SharkBody } from './Shark.jsx'
import Labubu from './Labubu.jsx'
import { textBubble } from './Concert.jsx'
import { useTalkable } from './talkable.js'
import { chat } from './chat.js'
import FinaleFx, { crowdBubbles } from './FinaleFx.jsx'
import { BEAT, DECK_H, F, finale, smooth, stagePoint, stageRise, stageY, tornadoAt, useFinale, zeroG } from './finale.js'
import { CRATER, FINALE_BUTTON, KING_YAW, ROYAL_BOX, ROYAL_STAGE, TINY_BUTTON, finaleLive, heightAt } from './island.js'

// THE FINALE (see finale.js for the timeline): the secret button in the crater, the Royal Box you
// watch from, King Ryan Jr. on his throne, the concert stage, and the cast (Allison, Rose, Zaman,
// Schott, the shark, Golden Ryan Jr.): they parade in, play the show, survive the chaos, float in
// space and land again. The crowd and the big effects are in FinaleFx.jsx.

export const SECRET_PROF = {
  id: 'secret-button',
  name: 'the secret button',
  action: () => finale.ask(),
  hint: 'Click the secret button… if you are truly ready 👑',
  talk: 'Press it… 👑',
}

const SPH = new THREE.SphereGeometry(1, 16, 12)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16)
const CONE = new THREE.ConeGeometry(1, 1, 16)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }))
  return mats.get(k)
}
const glow = (color, opacity = 0.5) => {
  const k = 'glow' + color + opacity
  if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))
  return mats.get(k)
}
const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />
const GOLD = { metalness: 1, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.35 }
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ground = (x, z) => Math.max(heightAt(x, z), 0)
const between = (e, a, b) => e >= a && e < b

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const rig6 = () => ({ head: { current: null }, mouth: { current: null }, upL: { current: null }, loL: { current: null }, upR: { current: null }, loR: { current: null } })

export default function Finale() {
  useEffect(() => () => finale.reset(), []) // leaving the island ends it
  useFrame(() => finale.tick(), -1) // before anything else this frame (the player rides the lift)
  return (
    <>
      <SecretButton />
      <RoyalBox />
      <King />
      <Stage />
      <Cast />
      <TinyButton />
      <FinaleFx />
      <Warmup />
    </>
  )
}

// the first frame of the finale (under the white flash): get every shader and picture ready on the
// graphics card now, so nothing stutters later when it first appears
let warmed = false
function Warmup() {
  const { gl, scene, camera } = useThree()
  useFrame(() => {
    if (warmed || finale.t() < 0) return
    warmed = true
    const hidden = []
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o)
        o.visible = true
      }
    })
    gl.compile(scene, camera)
    const textures = new Set()
    const add = (mt) => mt && ['map', 'emissiveMap', 'bumpMap'].forEach((k) => mt[k] && textures.add(mt[k]))
    scene.traverse((o) => (Array.isArray(o.material) ? o.material.forEach(add) : add(o.material)))
    crowdBubbles().forEach(add)
    textures.forEach((t) => gl.initTexture(t))
    hidden.forEach((o) => (o.visible = false))
  }, -1)
  return null
}

// ---------- the secret button, glowing in the middle of the crater
function SecretButton() {
  const y = ground(FINALE_BUTTON.x, FINALE_BUTTON.z)
  const position = useMemo(() => [FINALE_BUTTON.x, y, FINALE_BUTTON.z], [y])
  const rotation = KING_YAW // the sign faces the side you usually climb in from
  const root = useRef()
  const hit = useRef()
  const knob = useRef()
  const lift = useRef()
  const beam = useRef()
  const sparks = useRef()
  const sign = useRef()
  const fs = useFinale()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useTalkable(SECRET_PROF, { position, rotation, root, hit, sway: 0, anyRoom: true })
  const signs = useMemo(() => {
    const make = (l1, l2) =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(768, 384, (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, 0, h)
          grad.addColorStop(0, '#3a0a5a')
          grad.addColorStop(1, '#1a0630')
          g.fillStyle = grad
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#ffd23f'
          g.lineWidth = 18
          g.strokeRect(12, 12, w - 24, h - 24)
          g.textAlign = 'center'
          g.fillStyle = '#ffd23f'
          g.font = 'bold 150px "Arial Black", Impact, sans-serif'
          g.fillText(l1, w / 2, 190)
          g.fillStyle = '#ffffff'
          g.font = 'bold 50px system-ui, sans-serif'
          g.fillText(l2, w / 2, 300)
        }),
      })
    return { idle: make('???', 'only for the truly brave 👑'), again: make('AGAIN?!', 'are you STILL ready? 👑') }
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const e = finale.t()
    const busy = e >= 0
    // it sinks into the ground while the finale runs
    lift.current.position.y = busy ? -2.5 * smooth(e / 1.5) + 2.5 * smooth((e - F.END + 2) / 2) : 0
    knob.current.material.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.4
    knob.current.position.y = 1.32 - (fs.asking ? 0.07 : 0)
    beam.current.visible = !busy
    beam.current.material.opacity = 0.1 + Math.sin(t * 2) * 0.04
    sign.current.material = fs.done ? signs.again : signs.idle
    for (let i = 0; i < 16; i++) {
      const a = t * 1.1 + (i / 16) * Math.PI * 2
      tmp.position.set(Math.cos(a) * 1.1, 1.4 + Math.sin(t * 2.5 + i) * 0.6, Math.sin(a) * 1.1)
      tmp.scale.setScalar(busy ? 0 : 0.04 + 0.03 * Math.abs(Math.sin(t * 4 + i)))
      tmp.updateMatrix()
      sparks.current.setMatrixAt(i, tmp.matrix)
    }
    sparks.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      <mesh ref={hit} geometry={CYL} position={[0, 1, 0]} scale={[0.9, 2, 0.9]} visible={false} />
      <group ref={lift}>
        <B g={CYL} c="#3a0a5a" p={[0, 0.55, 0]} s={[0.55, 1.1, 0.55]} />
        {[0.25, 0.6, 0.95].map((yy) => (
          <B key={yy} g={CYL} c="#ffcf3a" o={GOLD} p={[0, yy, 0]} s={[0.57, 0.05, 0.57]} />
        ))}
        <B g={CYL} c="#ffcf3a" o={GOLD} p={[0, 1.15, 0]} s={[0.62, 0.08, 0.62]} />
        <mesh ref={knob} geometry={SPH} position={[0, 1.32, 0]} scale={[0.36, 0.17, 0.36]}>
          <meshStandardMaterial color="#b44bff" emissive="#9b2dff" emissiveIntensity={0.6} roughness={0.25} />
        </mesh>
        {/* a little crown on the button */}
        <B g={CYL} c="#ffcf3a" o={GOLD} p={[0, 1.5, 0]} s={[0.14, 0.08, 0.14]} />
        {[0, 1, 2, 3, 4].map((k) => (
          <B key={k} g={CONE} c="#ffcf3a" o={GOLD} p={[Math.cos((k / 5) * Math.PI * 2) * 0.12, 1.59, Math.sin((k / 5) * Math.PI * 2) * 0.12]} s={[0.035, 0.09, 0.035]} />
        ))}
        <B g={CYL} c="#5a3a22" p={[1.1, 1.3, 0.1]} s={[0.05, 2.6, 0.05]} />
        <mesh ref={sign} material={signs.idle} position={[1.1, 2.45, 0.18]}>
          <planeGeometry args={[1.7, 0.85]} />
        </mesh>
      </group>
      {/* a faint golden light column so you can spot it from the crater rim */}
      <mesh ref={beam} geometry={CYL} material={glow('#ffd23f', 0.1).clone()} position={[0, 20, 0]} scale={[0.7, 40, 0.7]} />
      <instancedMesh ref={sparks} args={[SPH, glow('#fff3b0', 1), 16]} />
    </group>
  )
}

// ---------- the Royal Box: a floating golden balcony with a glass floor (so you can watch the parade
// and the crowd right underneath you), ringed by little clouds
function RoyalBox() {
  const root = useRef()
  const vip = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        map: canvasTex(512, 128, (g, w, h) => {
          g.fillStyle = '#7a0f2a'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#ffd23f'
          g.lineWidth = 8
          g.strokeRect(4, 4, w - 8, h - 8)
          g.fillStyle = '#ffd23f'
          g.textAlign = 'center'
          g.font = 'bold 52px "Arial Black", Impact, sans-serif'
          g.fillText('👑 ROYAL BOX 👑', w / 2, 62)
          g.fillStyle = '#ffffff'
          g.font = 'bold 30px system-ui, sans-serif'
          g.fillText('VIP: very important player', w / 2, 106)
        }),
      }),
    [],
  )
  useFrame(({ clock }) => {
    const e = finale.t()
    const vis = e >= 0
    root.current.visible = vis
    if (!vis) return
    root.current.position.set(ROYAL_BOX.x, finaleLive.boxY, ROYAL_BOX.z)
    root.current.children[0].rotation.y = clock.elapsedTime * 0.2 // the cloud swirls
  })
  // the sign hangs on the railing behind you (you'll see it when you turn around)
  const a = Math.atan2(CRATER.x - ROYAL_BOX.x, CRATER.z - ROYAL_BOX.z)
  return (
    <group ref={root} visible={false}>
      <group>
        {Array.from({ length: 14 }, (_, i) => {
          const an = (i / 14) * Math.PI * 2
          return <B key={i} c="#ffffff" o={{ roughness: 1 }} p={[Math.cos(an) * (ROYAL_BOX.r - 0.6), -1.1 - (i % 3) * 0.12, Math.sin(an) * (ROYAL_BOX.r - 0.6)]} s={[0.75, 0.35, 0.75]} />
        })}
      </group>
      <mesh geometry={CYL} position={[0, -0.05, 0]} scale={[ROYAL_BOX.r + 0.3, 0.1, ROYAL_BOX.r + 0.3]}>
        <meshStandardMaterial color="#cfefff" transparent opacity={0.16} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
      <mesh geometry={useMemo(() => new THREE.TorusGeometry(ROYAL_BOX.r + 0.3, 0.16, 8, 64), [])} material={m('#ffcf3a', GOLD)} position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={useMemo(() => new THREE.TorusGeometry(1.2, 0.05, 8, 48), [])} material={m('#ffcf3a', GOLD)} position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={useMemo(() => new THREE.TorusGeometry(ROYAL_BOX.r + 0.25, 0.07, 8, 64), [])} material={m('#ffcf3a', GOLD)} position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {Array.from({ length: 16 }, (_, i) => {
        const an = (i / 16) * Math.PI * 2
        return <B key={i} g={CYL} c="#ffcf3a" o={GOLD} p={[Math.cos(an) * (ROYAL_BOX.r + 0.25), 0.52, Math.sin(an) * (ROYAL_BOX.r + 0.25)]} s={[0.05, 1.05, 0.05]} />
      })}
      <group rotation={[0, a, 0]}>
        <mesh material={vip} position={[0, 0.7, -(ROYAL_BOX.r + 0.2)]} rotation={[0, 0, 0]}>
          <planeGeometry args={[2.2, 0.55]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------- KING RYAN JR.: rises out of the crater on a golden throne, floats over his people during
// the show, goes to space, and sinks back into the crater at the end
const KS = 24 // king size (~14 m tall)
const SEAT = 13 // seat top while he's on the crater
const FLOAT = 22 // seat top while he hovers above the back of the stage
const HOVER = stagePoint(0, -9) // behind the big screen, like a giant headliner
function throneAt(e) {
  let y
  if (e < F.RISE) y = -30
  else if (e < F.SHOW) y = -30 + (SEAT + 30) * smooth((e - F.RISE) / (F.CROWN - F.RISE))
  else y = SEAT + (FLOAT - SEAT) * smooth((e - F.SHOW) / 3) - (FLOAT + 30) * smooth((e - F.SPLASH - 4) / 3)
  const k = smooth((e - F.SHOW) / 3) * (1 - smooth((e - F.SPLASH - 2) / 2))
  return { y, x: CRATER.x + (HOVER[0] - CRATER.x) * k, z: CRATER.z + (HOVER[1] - CRATER.z) * k }
}
const KING_LINES = [
  [F.RISE + 2.5, F.CROWN, 'MRRROW.'],
  [F.CROWN + 0.5, F.PARADE + 3, 'KNEEL, PEASANTS. 😼'],
  [F.PARADE + 4, F.PARADE + 8.5, 'I accept tributes in tuna.'],
  [F.SHOW - 2.5, F.SHOW + 1.5, 'LET THE SHOW BEGIN!!! 🎸'],
  [F.DUEL + 1, F.DUEL + 4, 'This is my jam.'],
  [F.DROP + 0.5, F.DROP + 4, 'TURN IT UP!!!'],
  [F.CHAOS + 1, F.SNEEZE - 0.5, 'Who invited HIM?!'],
  [F.TOSPACE, F.LIFTOFF, 'TO SPACE!!! 🚀'],
  [F.SPACE + 1, F.SPACE + 6, 'I AM THE SPACE KING 👑'],
  [F.CHUTE + 1, F.CHUTE + 5, 'Who packed the parachute?!'],
  [F.TINY - 1, F.END - 1, 'Long live… me. 👑'],
]
function King() {
  const throne = useRef()
  const pedestal = useRef()
  const king = useRef()
  const crown = useRef()
  const bubble = useRef()
  const beam = useRef()
  const light = useRef()
  const lines = useMemo(() => KING_LINES.map(([a, b, text]) => [a, b, textBubble(text, '#d9a400')]), [])
  useFrame(({ clock }) => {
    const e = finale.t()
    const t = clock.elapsedTime
    const vis = e >= F.RISE - 0.5 && e < F.END
    throne.current.visible = vis
    light.current.intensity = vis ? 90 : 0
    // the golden beam out of the crater
    const ba = e - F.BEAM
    beam.current.visible = ba >= 0 && ba < 3
    if (beam.current.visible) {
      beam.current.scale.set(1 + ba * 1.5, 160, 1 + ba * 1.5)
      beam.current.material.opacity = 0.55 * Math.sin((ba / 3) * Math.PI) * (0.8 + Math.sin(t * 30) * 0.2)
    }
    if (!vis) return
    const p = throneAt(e)
    throne.current.position.set(p.x, p.y, p.z)
    throne.current.rotation.y = Math.atan2(ROYAL_BOX.x - p.x, ROYAL_BOX.z - p.z) // always facing you
    // the pedestal holds the throne up on the crater, then sinks once he floats away
    const top = Math.min(p.y, SEAT - (SEAT + 30) * smooth((e - F.SHOW) / 3)) - 3
    const floor = ground(CRATER.x, CRATER.z) - 0.5
    pedestal.current.visible = top > floor + 0.1
    pedestal.current.position.set(CRATER.x, (top + floor) / 2, CRATER.z)
    pedestal.current.scale.set(4, Math.max(0.01, top - floor), 4)
    // the king: still and regal, then bobbing to the music, rearing up, floating in space
    const beat = (e - F.SHOW) / BEAT
    let y = 0.6
    let pitch = 0
    let yaw = 0
    let roll = 0
    if (e >= F.SHOW && e < F.LIFTOFF) y += Math.abs(Math.sin(beat * Math.PI)) * (e >= F.DROP ? 1.2 : 0.5)
    if (e >= F.TOSPACE && e < F.LIFTOFF) pitch = -0.6 * smooth((e - F.TOSPACE) / 0.6) // rears up: TO SPACE!
    const g = zeroG(e)
    if (g > 0) {
      y += g * 9
      yaw += g * (e - F.SPACE) * 0.5
      roll += g * Math.sin((e - F.SPACE) * 0.7) * 0.5
    }
    king.current.position.y = y
    king.current.rotation.set(pitch, yaw, roll, 'YXZ')
    // ACHOO knocks his crown off (it lands back on, of course)
    const ca = (e - F.SNEEZE - 0.2) / 1.6
    crown.current.position.y = 0.6 + (ca >= 0 && ca < 1 ? Math.sin(ca * Math.PI) * 0.35 : 0)
    crown.current.rotation.set(ca >= 0 && ca < 1 ? ca * Math.PI * 4 : 0, 0, 0)
    const line = lines.find(([a, b]) => e >= a && e < b)
    bubble.current.visible = !!line
    if (line) {
      bubble.current.material = line[2]
      bubble.current.position.set(0, y + KS * 0.68, 2)
    }
  })
  return (
    <>
      <mesh ref={beam} geometry={CYL} material={glow('#ffe27a', 0.5).clone()} position={[CRATER.x, 80, CRATER.z]} visible={false} />
      <mesh ref={pedestal} geometry={CYL} material={m('#ffcf3a', GOLD)} visible={false} />
      <group ref={throne} rotation={[0, KING_YAW, 0]} visible={false}>
        {/* the throne: seat, cushion, tall back with a crest, armrests, a purple base */}
        <B g={BOX} c="#6a1a8a" p={[0, -2.6, 0]} s={[13, 1.2, 16]} />
        <B g={BOX} c="#ffcf3a" o={GOLD} p={[0, -1, 0]} s={[12, 2, 15]} />
        <B g={BOX} c="#b0122e" o={{ roughness: 0.9 }} p={[0, 0.3, 0.3]} s={[10.5, 0.6, 13.5]} />
        <B g={BOX} c="#ffcf3a" o={GOLD} p={[0, 8, -7.6]} s={[12, 16, 1.4]} />
        <B g={BOX} c="#b0122e" o={{ roughness: 0.9 }} p={[0, 7.2, -6.85]} s={[9.6, 12.5, 0.2]} />
        <B c="#ffcf3a" o={GOLD} p={[0, 16.9, -7.6]} s={2} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B c="#ffcf3a" o={GOLD} p={[5.6 * sx, 16.4, -7.6]} s={1.2} />
            <B g={BOX} c="#ffcf3a" o={GOLD} p={[5.6 * sx, 2.2, 0]} s={[1.2, 1.6, 14]} />
            <B c="#ffcf3a" o={GOLD} p={[5.6 * sx, 2.6, 7.2]} s={1} />
            <B c={sx > 0 ? '#2f6fd6' : '#d62839'} o={{ roughness: 0.15, metalness: 0.3 }} p={[3.4 * sx, 13, -6.75]} s={0.8} />
          </group>
        ))}
        <B c="#2ec44a" o={{ roughness: 0.15, metalness: 0.3 }} p={[0, 14.2, -6.75]} s={1} />
        {/* the king himself: crown and royal cape */}
        <group ref={king} position={[0, 0.6, 0.5]}>
          <group scale={KS}>
            <RyanJr />
            <group ref={crown} position={[0, 0.6, 0.168]}>
              <mesh geometry={CYL} material={m('#ffcf3a', GOLD)} scale={[0.07, 0.05, 0.07]} />
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const an = (k / 6) * Math.PI * 2
                return (
                  <group key={k}>
                    <B g={CONE} c="#ffcf3a" o={GOLD} p={[Math.cos(an) * 0.062, 0.05, Math.sin(an) * 0.062]} s={[0.016, 0.05, 0.016]} />
                    <B c={k % 2 ? '#d62839' : '#2f6fd6'} p={[Math.cos(an) * 0.071, 0, Math.sin(an) * 0.071]} s={0.011} />
                  </group>
                )
              })}
            </group>
            <B c="#b0122e" o={{ roughness: 0.9 }} p={[0, 0.31, -0.04]} s={[0.155, 0.135, 0.255]} />
            <mesh geometry={useMemo(() => new THREE.TorusGeometry(0.075, 0.022, 8, 24), [])} material={m('#ffffff', { roughness: 1 })} position={[0, 0.4, 0.11]} rotation={[Math.PI / 2 - 0.4, 0, 0]} />
          </group>
        </group>
        <sprite ref={bubble} scale={[16, 7.5, 1]} visible={false} />
        <pointLight ref={light} color="#ffd27a" intensity={0} distance={70} decay={1.1} position={[0, 22, 12]} />
      </group>
    </>
  )
}

// ---------- the concert stage: rises out of the ground in front of the crater
const SCREENS = [
  [0, 'KING RYAN JR.', 'LIVE! 👑'],
  [F.DUEL, 'ROSE vs. SHARK', '⚡ GUITAR DUEL ⚡'],
  [F.BUILD, 'DROP IN…', '3… 2… 1…'],
  [F.DROP, 'DROOOOP!!!', '💥💥💥'],
  [F.CHAOS, '⚠️ CHAOS ⚠️', 'everybody panic'],
  [F.LIFTOFF, '🚀 🚀 🚀', 'hold on to something'],
  [F.SPACE, 'NOW PLAYING', 'zero gravity mix'],
  [F.SPLASH, 'THE END…?', '👑'],
]
const N_LASERS = 10
function Stage() {
  const root = useRef()
  const screen = useRef()
  const lasers = useRef([])
  const spots = useRef([])
  const discs = useRef([])
  const screens = useMemo(
    () =>
      SCREENS.map(([at, l1, l2]) => [
        at,
        new THREE.MeshBasicMaterial({
          map: canvasTex(1024, 360, (g, w, h) => {
            const grad = g.createLinearGradient(0, 0, w, h)
            grad.addColorStop(0, '#2a0a4a')
            grad.addColorStop(1, '#0a1a4a')
            g.fillStyle = grad
            g.fillRect(0, 0, w, h)
            g.textAlign = 'center'
            g.fillStyle = '#ffd23f'
            g.font = 'bold 130px "Arial Black", Impact, sans-serif'
            g.fillText(l1, w / 2, 160)
            g.fillStyle = '#ff4fa3'
            g.font = 'bold 80px system-ui, sans-serif'
            g.fillText(l2, w / 2, 290)
          }),
        }),
      ]),
    [],
  )
  const djSign = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(512, 256, (g, w, h) => {
          g.fillStyle = '#141418'
          g.fillRect(0, 0, w, h)
          g.fillStyle = '#ff4fa3'
          g.textAlign = 'center'
          g.font = 'bold 120px "Arial Black", Impact, sans-serif'
          g.fillText('DJ', w / 2, 120)
          g.fillStyle = '#2ec4a6'
          g.font = 'bold 84px "Arial Black", Impact, sans-serif'
          g.fillText('ZAMAN', w / 2, 220)
        }),
      }),
    [],
  )
  const laserMats = useMemo(() => ['#ff2a6a', '#2affd0', '#ffe02a', '#9b5dff', '#2a8aff'].map((c) => glow(c, 0.85)), [])
  useFrame(({ clock }) => {
    const e = finale.t()
    const t = clock.elapsedTime
    const vis = e >= F.SHOW - 0.2 && e < F.END
    root.current.visible = vis
    if (!vis) return
    root.current.position.y = stageY(e)
    screen.current.material = screens.filter(([at]) => e >= at).pop()[1]
    // lasers sweep the sky (faster in the build, wild in the drop)
    const live = e < F.LIFTOFF
    const speed = e >= F.DROP ? 2.6 : e >= F.BUILD ? 1.8 : 0.8
    lasers.current.forEach((l, i) => {
      if (!l) return
      l.visible = live
      l.rotation.set(-0.35 - 0.3 * (0.5 + 0.5 * Math.sin(t * speed * 0.7 + i)), Math.sin(t * speed + i * 0.9) * 0.8, 0)
    })
    // spotlights on whoever is soloing in the duel
    const bar = Math.floor((e - F.SHOW) / (4 * BEAT))
    spots.current.forEach((s, i) => s && (s.visible = (bar === 4 || bar === 6 ? 0 : bar === 5 || bar === 7 ? 1 : -1) === i))
    discs.current.forEach((d) => d && (d.rotation.y = t * 6))
  })
  const [w, d] = [24, 10]
  return (
    <group ref={root} position={[ROYAL_STAGE.x, ROYAL_STAGE.y, ROYAL_STAGE.z]} rotation={[0, ROYAL_STAGE.yaw, 0]} visible={false}>
      <B g={BOX} c="#1d1028" p={[0, -(DECK_H + 1) / 2, 0]} s={[w, DECK_H + 1, d]} />
      <B g={BOX} c="#3a2a4a" p={[0, -0.05, 0]} s={[w - 0.2, 0.1, d - 0.2]} />
      <mesh geometry={BOX} material={glow('#ff4fa3', 0.9)} position={[0, -0.25, d / 2 + 0.02]} scale={[w, 0.18, 0.05]} />
      <mesh geometry={BOX} material={glow('#2ec4a6', 0.9)} position={[0, -1.2, d / 2 + 0.02]} scale={[w, 0.12, 0.05]} />
      {/* the big LED screen */}
      <B g={BOX} c="#141418" p={[0, 5, -d / 2 + 0.2]} s={[21, 8, 0.4]} />
      <mesh ref={screen} material={screens[0][1]} position={[0, 5, -d / 2 + 0.42]}>
        <planeGeometry args={[20, 7]} />
      </mesh>
      {/* speaker stacks */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[(w / 2 - 1.3) * sx, 0, -d / 2 + 1.4]}>
          <B g={BOX} c="#1d1d22" p={[0, 2.4, 0]} s={[2.2, 4.8, 2]} />
          {[1.2, 2.6, 3.9].map((yy) => (
            <B key={yy} g={CYL} c="#3a3a40" p={[0, yy, 1.01]} r={[Math.PI / 2, 0, 0]} s={[0.7, 0.05, 0.7]} />
          ))}
        </group>
      ))}
      {/* DJ booth */}
      <group position={[SPOTS.zaman[0], 0, -0.4]}>
        <B g={BOX} c="#1d1d22" p={[0, 0.8, 0]} s={[3.2, 1.6, 1.3]} />
        <mesh material={djSign} position={[0, 0.8, 0.66]}>
          <planeGeometry args={[2.4, 1.2]} />
        </mesh>
        {[-0.75, 0.75].map((x, i) => (
          <mesh key={x} ref={(el) => (discs.current[i] = el)} geometry={CYL} material={m('#2a2a30')} position={[x, 1.63, 0]} scale={[0.5, 0.05, 0.5]} />
        ))}
      </group>
      {/* lasers from the top of the screen */}
      {Array.from({ length: N_LASERS }, (_, i) => (
        <group key={i} ref={(el) => (lasers.current[i] = el)} position={[-9 + i * 2, 9, -d / 2 + 0.5]}>
          <mesh geometry={BOX} material={laserMats[i % laserMats.length]} position={[0, 0, 70]} scale={[0.12, 0.12, 140]} />
        </group>
      ))}
      {/* duel spotlights: Rose and the shark */}
      {[SPOTS.rose[0], SPOTS.shark[0]].map((x, i) => (
        <mesh key={x} ref={(el) => (spots.current[i] = el)} geometry={CONE} material={glow('#fff6c8', 0.25)} position={[x, 8, 0.4]} scale={[2.6, 16, 2.6]} visible={false} />
      ))}
    </group>
  )
}

// ---------- the cast: parade in, play the show, survive the chaos, float in space, take a bow
// band spots are stage-local [x, z]; the parade walks in from the west to the same spot on the ground
const SPOTS = {
  golden: [-10.2, 3.0],
  allison: [0, -2.9],
  rose: [-4.8, 0.4],
  zaman: [-8.2, -1.9],
  schott: [0, 3.0],
  shark: [4.8, 0.4],
  horseA: [9.4, -3.0],
  horseR: [10.6, 0.2],
  labubu: [-10.6, -1.4],
}
const ARRIVE = { golden: F.PARADE + 8.3, allison: F.PARADE + 9.2, rose: F.PARADE + 10, zaman: F.PARADE + 10.8, schott: F.PARADE + 11.6, shark: F.PARADE + 12.4 }
const WALK = 8.5 // seconds from the west edge of the field to the stage
const BAND_SCALE = 2.6
// parade path: from 62 m west of your spot (a little south) straight to it
function paradePos(spot, arrive, e) {
  const [sx, sz] = stagePoint(...spot)
  const u = clamp01((e - (arrive - WALK)) / WALK)
  return { x: sx - 62 * (1 - u), z: sz + 7 * (1 - u), u, walking: u < 1 }
}
// a member of the band: walking in (riding something), then on the stage
function actorAt(name, e, o, mount) {
  const spot = SPOTS[name]
  const arrive = ARRIVE[name] ?? ARRIVE[mount]
  const p = paradePos(spot, arrive, e)
  o.vis = e >= arrive - WALK && e < F.END
  o.x = p.x
  o.z = p.z
  o.y = e < F.SHOW ? ROYAL_STAGE.y : stageY(e)
  o.yaw = p.walking ? Math.atan2(62, -7) : ROYAL_STAGE.yaw
  o.pitch = 0
  o.roll = 0
  o.squash = 1
  o.walking = p.walking
  if (p.walking) o.y += Math.abs(Math.sin(e * 7)) * 0.25
  // ACHOO: everyone on stage hops up and spins
  const a = (e - F.SNEEZE - 0.4) / 1.5
  if (a >= 0 && a < 1) {
    o.y += Math.sin(a * Math.PI) * 5
    o.yaw += a * Math.PI * 2
  }
  if (e >= F.LIFTOFF && e < F.SPACE) o.squash = 0.8 + Math.sin(e * 40) * 0.04
  const g = zeroG(e)
  if (g > 0) {
    const seed = name.length
    o.y += g * (3 + seed * 1.3)
    o.pitch += g * Math.sin((e - F.SPACE) * 0.6 + seed) * 0.8
    o.roll += g * (e - F.SPACE) * 0.25 * (seed % 2 ? 1 : -1)
  }
  if (between(e, F.SPLASH + 1.5, F.SPLASH + 3)) o.pitch = 0.45 * Math.sin(((e - F.SPLASH - 1.5) / 1.5) * Math.PI) // a bow
  return o
}
const place = (g, o, scale = BAND_SCALE) => {
  g.visible = o.vis
  g.position.set(o.x, o.y, o.z)
  g.rotation.set(o.pitch, o.yaw, o.roll, 'YXZ')
  g.scale.set(scale, scale * o.squash, scale)
}
// what each of them says, by time
const SAYS = {
  allison: [[F.PARADE + 3, F.PARADE + 7, 'Long live the King! (achoo)'], [F.SHOW + 2, F.SHOW + 6, "FINE. I'll drum. AGAIN."], [F.DROP + 1, F.DROP + 4.5, 'OK this is actually fun'], [F.CHAOS + 2, F.CHAOS + 5, 'MY DRUMS ARE ON FIRE'], [F.SPACE + 3, F.SPACE + 6.5, "I'm allergic to SPACE"], [F.SPLASH + 3, F.END - 0.5, '…again?!']],
  rose: [[F.PARADE + 4, F.PARADE + 8, 'Giddy up, horsey!'], [F.DUEL, F.DUEL + 3.4, 'TOP THAT, SHARK! 🎸'], [F.DUEL + 3.8, F.DUEL + 7.4, 'Bunny ears… DOUBLE SOLO!'], [F.DROP + 2.5, F.DROP + 6, 'ROCK ON!!!'], [F.SPACE + 1, F.SPACE + 4.5, 'Nirvana… in SPACE!'], [F.SPLASH + 4, F.END - 0.5, 'shh… better than Taylor Swift']],
  zaman: [[F.PARADE + 5, F.PARADE + 9, 'yo! all hail! 👑'], [F.BUILD, F.DROP, 'yo… DROP IN 3… 2… 1…'], [F.DROP, F.DROP + 3, 'YOOOOO!!!'], [F.SPACE + 4.5, F.CHUTE, "yo, we're in space"], [F.SPLASH + 2, F.SPLASH + 5, 'yo. that was something.']],
  schott: [[F.PARADE + 6, F.PARADE + 10, 'n → ∞ cats!'], [F.SHOW + 3.5, F.SHOW + 7, 'The CLT says… PARTY!'], [F.DROP + 4, F.CHAOS, 'A normal distribution of DANCING!'], [F.CHAOS + 3, F.CHAOS + 6.5, 'This is NOT normal!'], [F.SPACE + 2, F.SPACE + 5.5, 'Gravity is an outlier!'], [F.SPLASH + 3.5, F.END - 0.5, 'Statistically… best day ever.']],
  shark: [[F.PARADE + 7, F.PARADE + 11, "Surf's up, Your Majesty!"], [F.DUEL + 1.9, F.DUEL + 3.7, 'CHALLENGE ACCEPTED 🦈'], [F.DUEL + 5.6, F.BUILD, 'SHARK SOLO!!!'], [F.CHAOS + 1.6, F.COUNT, 'SHARKNADO!!! 🦈🌪️'], [F.SPACE + 5, F.CHUTE + 1, "I'm a SPACE shark!"], [F.SPLASH + 4.5, F.END - 0.5, 'Jaws? More like APPLAUSE!']],
  golden: [[F.PARADE + 2, F.PARADE + 6, 'Clone-tastic!'], [F.DROP + 1, F.DROP + 4, 'PARTY!!!']],
}
function Cast() {
  const refs = useRef({})
  const bubbles = useRef({})
  const r = (k) => (el) => (refs.current[k] = el)
  const allisonRig = useMemo(rig6, [])
  const roseRig = useMemo(rig6, [])
  const zamanRig = useMemo(() => ({ head: { current: null }, mouth: { current: null }, armL: { current: null }, armR: { current: null }, keychain: { current: null } }), [])
  const schottRig = useMemo(() => ({ head: { current: null }, mouth: { current: null }, armL: { current: null }, armR: { current: null } }), [])
  const sharkRig = useMemo(() => ({ tail: { current: null }, jaw: { current: null }, guitar: { current: null } }), [])
  const says = useMemo(() => Object.fromEntries(Object.entries(SAYS).map(([k, list]) => [k, list.map(([a, b, text]) => [a, b, textBubble(text, '#7a4fd1')])])), [])
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffcf3a', metalness: 1, roughness: 0.22, emissive: '#7a5200', emissiveIntensity: 0.35 }), [])
  const goldRef = useRef()
  useLayoutEffect(() => {
    goldRef.current.traverse((o) => {
      if (o.isMesh) o.material = gold
    })
  }, [gold])
  const balls = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const o = useMemo(() => ({}), [])
  const galton = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.7,
        map: canvasTex(256, 320, (g, w, h) => {
          g.fillStyle = '#c9a46a'
          g.fillRect(0, 0, w, h)
          g.fillStyle = '#3a2416'
          for (let row = 0; row < 9; row++) for (let j = 0; j <= row; j++) {
            g.beginPath()
            g.arc(w / 2 + (j - row / 2) * 22, 30 + row * 22, 4, 0, Math.PI * 2)
            g.fill()
          }
          g.strokeStyle = '#ff4fa3'
          g.lineWidth = 6
          g.beginPath()
          for (let x = 0; x <= w; x += 4) {
            const y = h - 20 - 90 * Math.exp(-(((x - w / 2) / 45) ** 2))
            if (x) g.lineTo(x, y)
            else g.moveTo(x, y)
          }
          g.stroke()
        }),
      }),
    [],
  )
  const ballData = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ a: (i / 36) * Math.PI * 2, v: 1.5 + (i % 5) * 0.6, up: 3 + (i % 3), o: (i * 0.37) % 1 })), [])

  useFrame(({ clock }) => {
    const e = finale.t()
    const t = clock.elapsedTime
    const R = refs.current
    const any = e >= 0
    for (const k of Object.keys(R)) if (R[k] && !any) R[k].visible = false
    for (const k of Object.keys(bubbles.current)) if (bubbles.current[k]) bubbles.current[k].visible = false
    if (!any) {
      balls.current.visible = false
      return
    }
    const beat = (e - F.SHOW) / BEAT
    const showing = e >= F.SHOW && e < F.SPLASH
    const bar = Math.floor(beat / 4)
    const say = (name, x, y, z) => {
      const line = says[name].find(([a, b]) => e >= a && e < b)
      const sp = bubbles.current[name]
      sp.visible = !!line && R[name]?.visible
      if (sp.visible) {
        sp.material = line[2]
        sp.position.set(x, y, z)
      }
    }

    // --- GOLDEN RYAN JR. leads the parade on a float, then shines on the stage
    actorAt('golden', e, o)
    place(R.golden, o, 1)
    goldRef.current.position.y = 0.9 + (showing ? Math.abs(Math.sin(beat * Math.PI)) * 0.4 : Math.sin(t * 2) * 0.1)
    say('golden', o.x, o.y + 5.6, o.z)

    // --- ALLISON rides in on her horse, hops off, and drums (under protest)
    actorAt('allison', e, o, 'allison')
    const allisonRiding = o.walking
    const hA = { ...o }
    if (!allisonRiding) {
      // her horse walks on to its own spot at the back of the stage
      const [hx, hz] = stagePoint(...SPOTS.horseA)
      const u = smooth((e - ARRIVE.allison) / 1.5)
      hA.x = o.x + (hx - o.x) * u
      hA.z = o.z + (hz - o.z) * u
    }
    place(R.horseA, hA, 2)
    if (allisonRiding) {
      o.y += 0.85
      allisonRig.upR.current.rotation.set(-0.7, 0, -0.2)
      allisonRig.upL.current.rotation.set(-0.7, 0, 0.2)
      allisonRig.loR.current.rotation.set(-0.4, 0, 0)
      allisonRig.loL.current.rotation.set(-0.4, 0, 0)
    } else {
      const hop = (e - ARRIVE.allison) / 0.6
      if (hop < 1) o.y += Math.sin(hop * Math.PI) * 2.2 + (1 - hop) * 0.85
      const fast = e >= F.CHAOS ? 2 : 1
      const hitR = Math.max(0, Math.sin(beat * Math.PI * 2 * fast))
      const hitL = Math.max(0, Math.sin(beat * Math.PI * 2 * fast + Math.PI))
      allisonRig.upR.current.rotation.set(-0.85 - hitR * 0.35, 0, -0.25)
      allisonRig.loR.current.rotation.set(-0.7 + hitR * 0.6, 0, 0.2)
      allisonRig.upL.current.rotation.set(-0.85 - hitL * 0.35, 0, 0.25)
      allisonRig.loL.current.rotation.set(-0.7 + hitL * 0.6, 0, -0.2)
      allisonRig.head.current.rotation.x = showing ? Math.abs(Math.sin(beat * Math.PI)) * 0.15 : 0
    }
    place(R.allison, o)
    // her drum kit sits just in front of her (and floats off with her in space)
    R.drums.visible = e >= F.SHOW - 0.2 && e < F.END
    if (R.drums.visible) {
      const [dx, dz] = stagePoint(SPOTS.allison[0], SPOTS.allison[1] + 0.62 * BAND_SCALE)
      R.drums.position.set(dx, o.y, dz)
      R.drums.rotation.set(o.pitch * 0.5, ROYAL_STAGE.yaw, o.roll * 0.5, 'YXZ')
    }
    say('allison', o.x, o.y + 4.4, o.z)

    // --- ROSE rides in, hops off, and duels the shark
    actorAt('rose', e, o, 'rose')
    const roseRiding = o.walking
    const hR = { ...o }
    if (!roseRiding) {
      const [hx, hz] = stagePoint(...SPOTS.horseR)
      const u = smooth((e - ARRIVE.rose) / 1.5)
      hR.x = o.x + (hx - o.x) * u
      hR.z = o.z + (hz - o.z) * u
    }
    place(R.horseR, hR, 2)
    const roseSolo = bar === 4 || bar === 6
    if (roseRiding) o.y += 0.85
    else {
      const hop = (e - ARRIVE.rose) / 0.6
      if (hop < 1) o.y += Math.sin(hop * Math.PI) * 2.2 + (1 - hop) * 0.85
    }
    if (showing && !roseRiding) {
      o.y += Math.abs(Math.sin(beat * Math.PI)) * (roseSolo ? 0.5 : 0.25)
      o.pitch += roseSolo ? -0.25 : 0
      o.roll += Math.sin(beat * Math.PI * 0.5) * 0.08
    }
    roseRig.head.current.rotation.x = showing ? Math.abs(Math.sin(beat * Math.PI)) * 0.25 : 0
    roseRig.upR.current.rotation.set(-0.35, 0, -0.1)
    roseRig.loR.current.rotation.set(-1.1, 0, 0.9 + Math.sin(beat * Math.PI * (roseSolo ? 8 : 4)) * 0.3)
    const pump = roseSolo ? Math.max(0, Math.sin(beat * Math.PI)) : 0
    roseRig.upL.current.rotation.set(-0.7 * (1 - pump), 0, 0.6 + pump * 2.1)
    roseRig.loL.current.rotation.set(-1.0 * (1 - pump), 0, -0.3 * (1 - pump) + pump * 0.2)
    place(R.rose, o)
    say('rose', o.x, o.y + 4.2, o.z)

    // --- ZAMAN rides in on a giant Labubu, then DJs
    actorAt('zaman', e, o, 'zaman')
    const zRiding = o.walking
    const lb = { ...o }
    if (!zRiding) {
      const [lx, lz] = stagePoint(...SPOTS.labubu)
      const u = smooth((e - ARRIVE.zaman) / 1.5)
      lb.x = o.x + (lx - o.x) * u
      lb.z = o.z + (lz - o.z) * u
      if (showing) lb.y += Math.abs(Math.sin(beat * Math.PI)) * 0.4
    }
    place(R.labubu, lb, 1)
    if (zRiding) o.y += 4.0 // surfing on its head
    else {
      const hop = (e - ARRIVE.zaman) / 0.7
      if (hop < 1) o.y += Math.sin(hop * Math.PI) * 2.5 + (1 - hop) * 4.0
    }
    const building = between(e, F.BUILD, F.DROP)
    const dropping = between(e, F.DROP, F.DROP + 2.5)
    zamanRig.armR.current.rotation.set(building ? -2.9 : dropping ? -2.8 : showing ? -0.9 + Math.sin(t * 14) * 0.15 : -0.3, 0, -0.2)
    zamanRig.armL.current.rotation.set(dropping ? -2.8 : showing ? -0.9 + Math.abs(Math.sin(beat * Math.PI)) * 0.3 : -0.15, 0, 0.18)
    zamanRig.head.current.rotation.x = showing ? Math.abs(Math.sin(beat * Math.PI)) * 0.2 : 0
    zamanRig.keychain.current.rotation.z = Math.sin(t * 5) * 0.4
    if (dropping) o.y += Math.abs(Math.sin(beat * Math.PI)) * 0.8
    place(R.zaman, o)
    say('zaman', o.x, o.y + 4.6, o.z)

    // --- SCHOTT walks in with his Galton board raining balls, then conducts everyone
    actorAt('schott', e, o)
    const k = showing ? 1 : 0.4
    schottRig.armR.current.rotation.set(-1.2 - Math.sin(beat * Math.PI) * 0.8 * k, 0, -0.3 - Math.cos(beat * Math.PI) * 0.3 * k)
    schottRig.armL.current.rotation.set(-1.2 - Math.sin(beat * Math.PI + 1) * 0.8 * k, 0, 0.3 + Math.cos(beat * Math.PI) * 0.3 * k)
    schottRig.head.current.rotation.z = Math.sin(t * 1.1) * 0.08
    if (between(e, F.DROP, F.CHAOS)) o.y += Math.abs(Math.sin(beat * Math.PI)) * 0.7
    place(R.schott, o)
    R.board.visible = o.vis && e < F.SHOW
    say('schott', o.x, o.y + 4.6, o.z)
    // the Galton balls bounce out around him while he walks
    balls.current.visible = o.vis && e < F.SHOW + 1
    if (balls.current.visible) {
      ballData.forEach((b, i) => {
        const u = (t * 0.9 + b.o) % 1
        tmp.position.set(o.x + Math.cos(b.a) * b.v * u * 2, o.y + 4 + b.up * u - 7 * u * u, o.z + Math.sin(b.a) * b.v * u * 2)
        tmp.scale.setScalar(o.y + 4 + b.up * u - 7 * u * u > o.y ? 0.12 : 0)
        tmp.updateMatrix()
        balls.current.setMatrixAt(i, tmp.matrix)
      })
      balls.current.instanceMatrix.needsUpdate = true
    }

    // --- THE SHARK surfs in on a lava wave, shreds on stage, rides the sharknado, floats in space
    actorAt('shark', e, o)
    const surfing = o.walking
    const sharkSolo = bar === 5 || bar === 7
    sharkRig.tail.current.rotation.y = Math.sin(t * (surfing ? 6 : 9)) * 0.45
    sharkRig.jaw.current.rotation.x = showing ? 0.2 + Math.abs(Math.sin(t * 7)) * 0.35 : 0.1
    sharkRig.guitar.current.visible = !surfing
    R.wave.visible = surfing && o.vis
    if (surfing) {
      o.y = ROYAL_STAGE.y + 1.4 + Math.sin(t * 3) * 0.3
      o.pitch = -0.1
      R.wave.position.set(o.x, ROYAL_STAGE.y, o.z)
      R.wave.rotation.y = o.yaw
      R.wave.scale.set(1, 1 + Math.sin(t * 4) * 0.1, 1)
    } else {
      // standing on its tail like a rock star
      o.pitch += -0.8 + (showing ? Math.abs(Math.sin(beat * Math.PI)) * (sharkSolo ? 0.4 : 0.2) : 0)
      o.y += 4.6
      o.yaw += Math.sin(beat * Math.PI * 0.5) * 0.25
    }
    // the sharknado
    const tIn = F.CHAOS + 1.3
    const tOut = F.COUNT + 0.5
    if (e >= tIn && e < tOut + 1.2) {
      const T = tornadoAt(Math.min(e, tOut))
      const a = e * 2.6
      const orbit = { x: T.x + Math.cos(a) * 5, y: ground(T.x, T.z) + 10 + Math.sin(e * 2) * 3, z: T.z + Math.sin(a) * 5 }
      const leap = (u) => Math.sin(u * Math.PI) * 8
      if (e < tIn + 1) {
        const u = e - tIn
        o.x += (orbit.x - o.x) * u
        o.z += (orbit.z - o.z) * u
        o.y += (orbit.y - o.y) * u + leap(u)
      } else if (e < tOut) {
        o.x = orbit.x
        o.y = orbit.y
        o.z = orbit.z
        o.yaw = a + Math.PI
        o.pitch = 0
        o.roll = 0.6
      } else {
        const u = (e - tOut) / 1.2
        o.x = orbit.x + (o.x - orbit.x) * u
        o.z = orbit.z + (o.z - orbit.z) * u
        o.y = orbit.y + (o.y - orbit.y) * u + leap(u)
        o.roll = 0.6 * (1 - u)
      }
    }
    place(R.shark, o, 1.8)
    say('shark', o.x, o.y + 4, o.z)
  })

  const sprite = (k) => <sprite key={k} ref={(el) => (bubbles.current[k] = el)} scale={[4.6, 2.15, 1]} visible={false} />
  return (
    <>
      {/* Golden Ryan Jr. on a parade float */}
      <group ref={r('golden')} visible={false}>
        <B g={BOX} c="#2a1d4e" p={[0, 0.5, 0]} s={[2.6, 0.6, 3.2]} />
        {[[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].map(([x, z]) => (
          <B key={`${x}${z}`} g={CYL} c="#ffcf3a" o={GOLD} p={[x, 0.35, z]} r={[0, 0, Math.PI / 2]} s={[0.35, 0.15, 0.35]} />
        ))}
        <B g={CYL} c="#ffcf3a" o={GOLD} p={[0, 0.85, 0]} s={[0.9, 0.1, 0.9]} />
        <group ref={goldRef} position={[0, 0.9, 0]} scale={4}>
          <RyanJr />
        </group>
      </group>
      <group ref={r('allison')} visible={false}>
        <AllisonBody rig={allisonRig} />
      </group>
      <group ref={r('drums')} visible={false} scale={BAND_SCALE}>
        <DrumSet position={[0, 0, 0]} rotation={0} />
      </group>
      <group ref={r('horseA')} visible={false}>
        <Horse position={[0, 0, 0]} rotation={0} />
      </group>
      <group ref={r('rose')} visible={false}>
        <RoseBody rig={roseRig} />
      </group>
      <group ref={r('horseR')} visible={false}>
        <Horse position={[0, 0, 0]} rotation={0} saddle={['#d62839', '#9fd3f0']} />
      </group>
      <group ref={r('labubu')} visible={false}>
        <Labubu fur="#2b2b2e" expression="grin" shirt="#ff4fa3" anim="dance" height={4.2} phase={0.8} />
      </group>
      <group ref={r('zaman')} visible={false}>
        <ZamanBody rig={zamanRig} />
      </group>
      <group ref={r('schott')} visible={false}>
        <SchottBody rig={schottRig} />
        <group ref={r('board')} position={[0, 1.25, -0.35]}>
          <B g={BOX} c="#6b4426" p={[0, 0, -0.02]} s={[0.7, 0.9, 0.06]} />
          <mesh material={galton} position={[0, 0, -0.06]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.62, 0.8]} />
          </mesh>
        </group>
      </group>
      <instancedMesh ref={balls} args={[SPH, m('#ff4fa3', { roughness: 0.3 }), 36]} frustumCulled={false} visible={false} />
      <group ref={r('shark')} visible={false}>
        <SharkBody rig={sharkRig} />
      </group>
      {/* the shark's ride: a surfboard on a glowing lava wave */}
      <group ref={r('wave')} visible={false}>
        <mesh geometry={SPH} material={m('#ff7a1a', { emissive: '#ff5a1f', emissiveIntensity: 1.4 })} position={[0, 0.3, -1]} scale={[2.6, 1.3, 4.4]} />
        <mesh geometry={SPH} material={m('#ffd23f', { emissive: '#ffb03a', emissiveIntensity: 1.2 })} position={[0, 1.1, 1.6]} scale={[2.2, 0.6, 1.4]} />
        <B c="#ffd23f" p={[0, 1.55, 0]} s={[0.7, 0.08, 2.6]} />
        <B c="#ff4fa3" p={[0, 1.6, 0]} s={[0.15, 0.03, 2.4]} />
      </group>
      {Object.keys(SAYS).map(sprite)}
    </>
  )
}

// ---------- after it's all over: a tiny new button
export const TINY_PROF = {
  id: 'tiny-button',
  name: 'the tiny button',
  action: () => (tinyPoke.at = performance.now() / 1000),
  hint: 'Press the tiny button? 😼',
  talk: 'Press it? 😼',
}
const tinyPoke = { at: -99 }
function TinyButton() {
  const fs = useFinale()
  // it appears at the end of the finale and stays (but hides while the finale is replaying)
  if (!((fs.done && !fs.active) || fs.stage === 'end')) return null
  return <TinyButtonModel />
}
function TinyButtonModel() {
  const root = useRef()
  const hit = useRef()
  const bubble = useRef()
  const pop = useRef(performance.now() / 1000)
  const y0 = ground(TINY_BUTTON.x, TINY_BUTTON.z)
  const position = useMemo(() => [TINY_BUTTON.x, y0, TINY_BUTTON.z], [y0])
  useTalkable(TINY_PROF, { position, rotation: Math.PI, root, hit, sway: 0, anyRoom: true })
  const sign = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(512, 256, (g, w, h) => {
          g.fillStyle = '#d62839'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#ffffff'
          g.lineWidth = 12
          g.strokeRect(8, 8, w - 16, h - 16)
          g.fillStyle = '#ffffff'
          g.textAlign = 'center'
          g.font = 'bold 64px "Arial Black", Impact, sans-serif'
          g.fillText('DO NOT PRESS', w / 2, 105)
          g.font = 'bold 44px system-ui, sans-serif'
          g.fillText('THIS ONE EITHER.', w / 2, 180)
        }),
      }),
    [],
  )
  const lines = useMemo(() => [textBubble('Not today. 😼', '#d62839'), textBubble('…maybe next time. 👑', '#d62839')], [])
  // when it hides (replay), make sure its "Press it?" button goes away too
  useEffect(
    () => () => {
      const c = chat.get()
      chat.set({ near: c.near?.id === TINY_PROF.id ? null : c.near, aim: c.aim?.id === TINY_PROF.id ? null : c.aim })
    },
    [],
  )
  useFrame(() => {
    const now = performance.now() / 1000
    const e = finale.t()
    root.current.position.y = e >= 0 ? finaleLive.boxY : y0
    const s = Math.min(1, (now - pop.current) / 0.4)
    root.current.scale.setScalar(s < 1 ? s * (1 + Math.sin(s * Math.PI) * 0.4) : 1)
    const a = now - tinyPoke.at
    bubble.current.visible = a >= 0 && a < 3
    bubble.current.material = lines[Math.floor(tinyPoke.at) % 2]
  })
  return (
    <group ref={root} position={position}>
      <mesh ref={hit} geometry={CYL} position={[0, 0.4, 0]} scale={[0.5, 0.8, 0.5]} visible={false} />
      <B g={CYL} c="#1d1d22" p={[0, 0.12, 0]} s={[0.12, 0.24, 0.12]} />
      <B c="#e8222e" o={{ emissive: '#e8222e', emissiveIntensity: 0.6 }} p={[0, 0.26, 0]} s={[0.07, 0.04, 0.07]} />
      <B g={CYL} c="#5a3a22" p={[0.28, 0.3, 0]} s={[0.015, 0.6, 0.015]} />
      <mesh material={sign} position={[0.28, 0.62, 0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.5, 0.25]} />
      </mesh>
      <sprite ref={bubble} position={[0, 1.4, 0]} scale={[1.8, 0.85, 1]} visible={false} />
    </group>
  )
}
