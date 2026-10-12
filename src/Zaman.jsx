import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { ease, useTalkable } from './talkable.js'

// Prof. Tauhid Zaman (MGT 409): black BLACKPINK hoodie, joggers, sneakers, nerd glasses,
// a Labubu keychain on his pants and a pet Labubu by his side. Built from primitives like the
// other professors; figure faces +z. Click him (or tap Talk on a phone) to chat with his AI agent,
// and he turns to face you while you talk.

export const ZAMAN = {
  id: 'tauhid-zaman',
  name: 'Tauhid Zaman',
  course: 'MGT 409 · AI Foundations for Managers',
  greeting: "Yo! Welcome to MGT 409. Ask me anything: AI, the course, or what else is running at SOM. Yo, let's go!",
  thinking: 'yo… thinking',
}

const SKIN = '#c68a5e'
const HOODIE = '#141418'
const PINK = '#ff4fa3'
const JOGGERS = '#2c303b'

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CAPSPH = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, 1.15) // top of the head (buzz cut)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const RING = new THREE.TorusGeometry(1, 0.14, 8, 24)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const TORSO = new THREE.CylinderGeometry(0.21, 0.235, 0.64, 24)
const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

function textTex(draw, w = 512, h = 256) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// `front` is the classroom's front frame from layout.js (fc front-wall center, back into the room,
// t along the front wall, half its half-width); the pet stands between him and the whiteboard
export default function Zaman({ position, rotation = 0, front }) {
  const { camera } = useThree()
  const { fc, back, t: tan, half } = front
  const petPosition = useMemo(
    () => [fc[0] + back[0] * 0.75 - tan[0] * (half * 0.3 + 0.75), 0, fc[1] + back[1] * 0.75 - tan[1] * (half * 0.3 + 0.75)],
    [fc, back, tan, half],
  )
  const root = useRef()
  const pet = useRef()
  const head = useRef()
  const mouth = useRef()
  const armL = useRef()
  const armR = useRef()
  const keychain = useRef()
  const bubble = useRef()
  const hit = useRef()
  const yo = useMemo(
    () =>
      new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        map: textTex((g, w, h) => {
          g.fillStyle = '#ffffff'
          g.strokeStyle = PINK
          g.lineWidth = 10
          g.beginPath()
          g.roundRect(10, 10, w - 20, h - 70, 50)
          g.moveTo(w / 2 - 30, h - 62)
          g.lineTo(w / 2 - 50, h - 10)
          g.lineTo(w / 2 + 10, h - 62)
          g.fill()
          g.stroke()
          g.fillStyle = '#141418'
          g.font = 'bold 110px system-ui, sans-serif'
          g.textAlign = 'center'
          g.fillText('yo!', w / 2, 150)
        }),
      }),
    [],
  )

  const talk = useTalkable(ZAMAN, { position, rotation, root, hit })

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { talking, speaking } = talk.current
    head.current.rotation.x = talking ? Math.sin(t * 2.2) * 0.05 : 0
    head.current.rotation.z = Math.sin(t * 0.9) * 0.06
    if (pet.current) {
      const petTo = Math.atan2(camera.position.x - petPosition[0], camera.position.z - petPosition[2])
      pet.current.rotation.y = ease(pet.current.rotation.y, talking ? petTo : rotation + 0.3, 0.08)
    }

    // mouth + hands move while he's "speaking" a reply; otherwise he gestures now and then
    mouth.current.scale.y = speaking ? 0.012 + Math.abs(Math.sin(t * 14)) * 0.02 : 0.012
    const wave = speaking ? Math.abs(Math.sin(t * 3)) : Math.max(0, Math.sin(t * 0.8)) * 0.6
    armR.current.rotation.set(-0.3 - wave * 1.2, 0, -0.2 - wave * 0.4)
    armL.current.rotation.set(-0.15, 0, 0.18 + (speaking ? Math.sin(t * 2.5) * 0.2 : 0))
    keychain.current.rotation.z = Math.sin(t * 2.7) * 0.35
    keychain.current.rotation.x = Math.sin(t * 1.9) * 0.15

    // "yo!" bubble pops up every few seconds when nobody is chatting with him
    const phase = t % 6
    bubble.current.visible = !talking && phase < 1.8
    bubble.current.position.y = 2.12 + Math.min(phase, 0.25) * 0.4
  })

  return (
    <>
      <group ref={root} position={position} rotation={[0, rotation, 0]}>
        {/* invisible hitbox for click-to-chat */}
        <mesh ref={hit} geometry={CYL} position={[0, 0.95, 0]} scale={[0.45, 1.9, 0.45]} visible={false} />

        <ZamanBody rig={{ head, mouth, armL, armR, keychain }} />

        <sprite ref={bubble} material={yo} position={[0.2, 2.12, 0]} scale={[0.5, 0.25, 1]} />
      </group>

      {/* his pet Labubu (a little smaller than him), who also turns to say hi */}
      {petPosition && (
        <group ref={pet} position={petPosition} rotation={[0, rotation + 0.3, 0]}>
          <Labubu fur="#2b2b2e" expression="grin" shirt={PINK} anim="dance" height={1.3} phase={0.8} />
        </group>
      )}
    </>
  )
}

// his body (classroom + the island finale share it). Faces +z.
// `rig` holds refs ({ head, mouth, armL, armR, keychain }) so the owner can animate it.
export function ZamanBody({ rig }) {
  const chest = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        transparent: true,
        roughness: 0.9,
        map: textTex((g, w, h) => {
          g.fillStyle = PINK
          g.font = 'bold 92px system-ui, sans-serif'
          g.textAlign = 'center'
          g.fillText('BLACKPINK', w / 2, h / 2 + 10)
          g.font = 'bold 44px system-ui, sans-serif'
          g.fillText('♥ BLINK ♥', w / 2, h / 2 + 76)
        }),
      }),
    [],
  )
  return (
    <group>
      {/* sneakers + joggers */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={BOX} c="#f4f4f4" p={[0.1 * sx, 0.05, 0.04]} s={[0.12, 0.09, 0.28]} />
          <B g={BOX} c={PINK} p={[0.1 * sx, 0.012, 0.04]} s={[0.125, 0.025, 0.285]} />
          <B g={CYL} c={JOGGERS} p={[0.1 * sx, 0.5, 0]} s={[0.085, 0.82, 0.085]} />
          <B g={CYL} c="#1c1f27" p={[0.1 * sx, 0.12, 0]} s={[0.07, 0.06, 0.07]} />
        </group>
      ))}
      <B g={CYL} c={JOGGERS} p={[0, 0.88, 0]} s={[0.2, 0.12, 0.15]} />

      {/* Labubu keychain clipped to his belt loop */}
      <group position={[-0.2, 0.86, 0.06]}>
        <B g={RING} c="#c9a44a" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 0, 0]} r={[0, Math.PI / 2, 0]} s={0.025} />
        <group ref={rig.keychain}>
          <B g={CYL} c="#c9a44a" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, -0.05, 0]} s={[0.004, 0.08, 0.004]} />
          <group position={[0, -0.27, 0]}>
            <Labubu fur="#ff8fc7" expression="grin" shirt="#141418" height={0.17} phase={2} />
          </group>
        </group>
      </group>

      {/* hoodie */}
      <mesh geometry={TORSO} material={m(HOODIE)} position={[0, 1.16, 0]} />
      <B c={HOODIE} p={[0, 1.46, 0]} s={[0.27, 0.1, 0.18]} />
      <B c={HOODIE} p={[0, 1.47, -0.12]} s={[0.19, 0.12, 0.1]} />
      <B g={RING} c={HOODIE} p={[0, 1.5, -0.01]} r={[Math.PI / 2 - 0.25, 0, 0]} s={[0.11, 0.1, 0.25]} />
      <B g={BOX} c="#22222a" p={[0, 0.98, 0.215]} s={[0.26, 0.12, 0.02]} />
      <B g={BOX} c={PINK} p={[0, 1.04, 0.226]} s={[0.26, 0.01, 0.005]} />
      <B g={CYL} c={PINK} p={[0, 0.85, 0]} s={[0.236, 0.05, 0.2]} />
      <mesh material={chest} position={[0, 1.24, 0.225]}>
        <planeGeometry args={[0.3, 0.15]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={CYL} c={PINK} p={[0.045 * sx, 1.33, 0.205]} s={[0.006, 0.14, 0.006]} />
          <B g={CYL} c="#ffffff" p={[0.045 * sx, 1.255, 0.205]} s={[0.009, 0.02, 0.009]} />
        </group>
      ))}

      {/* arms: left relaxed, right gestures while he explains */}
      <group ref={rig.armL} position={[0.26, 1.45, 0]}>
        <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.24, 0]} scale={[0.07, 0.2, 0.07]} />
        <B g={CYL} c={PINK} p={[0, -0.46, 0]} s={[0.06, 0.03, 0.06]} />
        <B c={SKIN} p={[0, -0.52, 0.01]} s={[0.045, 0.055, 0.04]} />
      </group>
      <group ref={rig.armR} position={[-0.26, 1.45, 0]}>
        <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.24, 0]} scale={[0.07, 0.2, 0.07]} />
        <B g={CYL} c={PINK} p={[0, -0.46, 0]} s={[0.06, 0.03, 0.06]} />
        <B c={SKIN} p={[0, -0.52, 0.01]} s={[0.045, 0.055, 0.04]} />
      </group>

      {/* head: buzz cut, nerd glasses, big grin */}
      <B g={CYL} c={SKIN} p={[0, 1.55, 0]} s={[0.05, 0.08, 0.05]} />
      <group ref={rig.head} position={[0, 1.68, 0]}>
        <B c={SKIN} p={[0, 0, 0]} s={[0.12, 0.14, 0.13]} />
        <B g={CAPSPH} c="#2b1f18" o={{ roughness: 1 }} p={[0, 0.005, -0.004]} s={[0.123, 0.143, 0.133]} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B c={SKIN} p={[0.122 * sx, 0, 0]} s={[0.02, 0.035, 0.02]} />
            <B c="#ffffff" p={[0.045 * sx, 0.025, 0.112]} s={[0.022, 0.018, 0.012]} />
            <B c="#1d1410" p={[0.045 * sx, 0.025, 0.122]} s={[0.011, 0.012, 0.008]} />
            <B g={BOX} c="#1d1410" p={[0.047 * sx, 0.062, 0.117]} r={[0, 0, -0.12 * sx]} s={[0.045, 0.01, 0.01]} />
            {/* thick black frames */}
            <B g={RING} c="#0d0d0f" p={[0.047 * sx, 0.025, 0.13]} s={[0.033, 0.028, 0.03]} />
            <B g={BOX} c="#0d0d0f" p={[0.11 * sx, 0.03, 0.06]} s={[0.006, 0.008, 0.13]} />
          </group>
        ))}
        <B g={BOX} c="#0d0d0f" p={[0, 0.03, 0.136]} s={[0.03, 0.007, 0.006]} />
        <B c={SKIN} p={[0, -0.005, 0.128]} s={[0.022, 0.03, 0.025]} />
        <mesh ref={rig.mouth} geometry={SPH} material={m('#5a1f22')} position={[0, -0.06, 0.117]} scale={[0.045, 0.012, 0.012]} />
        <B g={BOX} c="#ffffff" p={[0, -0.052, 0.124]} s={[0.06, 0.008, 0.004]} />
      </group>
    </group>
  )
}
