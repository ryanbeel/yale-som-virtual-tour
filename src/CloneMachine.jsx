import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RyanJr, bubbleMat } from './Allison.jsx'
import { CLONE_EVERY, cloneTotal, pageSeconds } from './IslandCats.jsx'
import { heightAt } from './island.js'

// The Clone-O-Matic 3000: a glass chamber between two tesla coils, a control panel, and a live
// clone counter. The original Ryan Jr. runs it (in tiny lab goggles). Every 60 seconds it flashes,
// arcs crackle, and a new clone rises up in the chamber (the clone itself is drawn by IslandCats).
// Faces +z.

const SPH = new THREE.SphereGeometry(1, 20, 14)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const RING = new THREE.TorusGeometry(1, 0.12, 8, 24)

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o }))
  return mats.get(k)
}
const METAL = { metalness: 0.75, roughness: 0.3 }
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

const bubbles = ['MORE ME!', 'NEW CLONE!', 'purrfect.'].map((t) => bubbleMat(t, '#2ec4a6'))

export default function CloneMachine({ position }) {
  const ground = heightAt(position[0], position[2])
  const rig = useRef()
  const glow = useRef()
  const light = useRef()
  const arcs = useRef([])
  const coilTops = useRef([])
  const button = useRef()
  const boss = useRef()
  const bubble = useRef()
  const last = useRef('')
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#bff6ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }), [])
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7ffcff', transparent: true, opacity: 0.35, depthWrite: false }), [])
  const arcMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d9fbff' }), [])
  const title = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: canvasTex(1024, 256, (g, w, h) => {
          g.fillStyle = '#2a1d4e'
          g.fillRect(0, 0, w, h)
          g.strokeStyle = '#2ec4a6'
          g.lineWidth = 16
          g.strokeRect(8, 8, w - 16, h - 16)
          g.textAlign = 'center'
          g.fillStyle = '#7ffcff'
          g.font = 'bold 104px "Arial Black", Impact, sans-serif'
          g.fillText('CLONE-O-MATIC', w / 2, 130)
          g.fillStyle = '#ff4fa3'
          g.font = 'bold 64px system-ui, sans-serif'
          g.fillText('3 0 0 0', w / 2, 212)
        }),
      }),
    [],
  )
  const { screen, screenTex, screenCanvas } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return { screen: new THREE.MeshBasicMaterial({ map: t }), screenTex: t, screenCanvas: c }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const now = pageSeconds()
    const phase = now % CLONE_EVERY // a clone is born at phase 0
    const firing = now >= CLONE_EVERY && phase < 4.5
    const charging = CLONE_EVERY - phase < 5
    rig.current.position.x = firing ? Math.sin(t * 60) * 0.03 : 0
    glowMat.opacity = firing ? 0.55 + Math.sin(t * 30) * 0.25 : charging ? 0.35 + Math.sin(t * 12) * 0.15 : 0.22
    glow.current.scale.y = firing ? 1 + Math.sin(t * 20) * 0.08 : 1
    light.current.intensity = firing ? 30 + Math.sin(t * 25) * 15 : charging ? 8 : 3
    arcs.current.forEach((a, i) => {
      if (!a) return
      a.visible = firing || (charging && Math.sin(t * 40 + i) > 0.6)
      a.rotation.z = Math.sin(t * 50 + i * 2) * 0.6
      a.scale.y = 0.8 + Math.abs(Math.sin(t * 37 + i)) * 0.6
    })
    coilTops.current.forEach((c) => c && (c.material = m('#7ffcff', { emissive: '#7ffcff', emissiveIntensity: firing || charging ? 2.5 : 0.6 })))
    // the boss presses the big red button right before each clone
    const press = charging || firing ? Math.max(0, Math.sin(t * 8)) : 0
    button.current.position.y = 1.18 - press * 0.03
    boss.current.position.y = 0.32 + press * 0.04
    bubble.current.visible = charging || firing || t % 9 < 2
    bubble.current.material = bubbles[firing ? 1 : Math.floor(t / 9) % 3 === 2 ? 2 : 0]

    const total = cloneTotal(now)
    const left = Math.ceil(CLONE_EVERY - phase)
    const text = `${total}|${firing ? 'NEW!' : left}`
    if (text !== last.current) {
      last.current = text
      const g = screenCanvas.getContext('2d')
      g.fillStyle = '#06140f'
      g.fillRect(0, 0, 512, 256)
      g.textAlign = 'center'
      g.fillStyle = '#7dff9b'
      g.font = 'bold 44px ui-monospace, Menlo, monospace'
      g.fillText('RYAN JR. CLONES', 256, 62)
      g.font = 'bold 108px ui-monospace, Menlo, monospace'
      g.fillText(String(total), 256, 168)
      g.font = 'bold 38px ui-monospace, Menlo, monospace'
      g.fillStyle = firing ? '#ff4fa3' : '#ffd23f'
      g.fillText(firing ? '*** NEW CLONE! ***' : `next clone in 0:${String(left).padStart(2, '0')}`, 256, 228)
      screenTex.needsUpdate = true
    }
  })

  return (
    <group position={[position[0], ground, position[2]]}>
      <group ref={rig}>
        {/* base platform + ramp down to the sand */}
        <B g={CYL} c="#3d2a6b" o={METAL} p={[0, 0.15, -0.5]} s={[2.7, 0.3, 2.7]} />
        <B g={RING} c="#2ec4a6" o={{ emissive: '#2ec4a6', emissiveIntensity: 1.2 }} p={[0, 0.3, -0.5]} r={[Math.PI / 2, 0, 0]} s={[2.7, 2.7, 1]} />
        <B g={BOX} c="#5a4a8a" o={METAL} p={[0, 0.12, 2.4]} r={[0.12, 0, 0]} s={[1.4, 0.12, 1.6]} />

        {/* glass chamber (newborn clones appear here), glowing pad, dome cap */}
        <B g={CYL} c="#c0c4c8" o={METAL} p={[0, 0.38, 0]} s={[1.0, 0.16, 1.0]} />
        <mesh ref={glow} geometry={CYL} material={glowMat} position={[0, 1.6, 0]} scale={[0.82, 2.4, 0.82]} />
        <mesh geometry={CYL} material={glass} position={[0, 1.6, 0]} scale={[0.9, 2.5, 0.9]} />
        <B g={CYL} c="#c0c4c8" o={METAL} p={[0, 2.9, 0]} s={[1.0, 0.16, 1.0]} />
        <B c="#5a4a8a" o={METAL} p={[0, 3.0, 0]} s={[0.95, 0.5, 0.95]} />
        <B c="#ff4fa3" o={{ emissive: '#ff4fa3', emissiveIntensity: 2 }} p={[0, 3.55, 0]} s={0.16} />
        <pointLight ref={light} color="#7ffcff" distance={14} decay={1.5} position={[0, 1.8, 0.8]} />

        {/* tesla coils with crackling arcs toward the chamber */}
        {[-1, 1].map((sx, i) => (
          <group key={sx} position={[2.05 * sx, 0.3, -0.6]}>
            <B g={CYL} c="#c0c4c8" o={METAL} p={[0, 1.2, 0]} s={[0.12, 2.4, 0.12]} />
            {[0.5, 0.9, 1.3, 1.7, 2.1].map((y) => (
              <B key={y} g={RING} c="#d9b45a" o={METAL} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} s={[0.22, 0.22, 0.6]} />
            ))}
            <mesh ref={(el) => (coilTops.current[i] = el)} geometry={SPH} material={m('#7ffcff')} position={[0, 2.6, 0]} scale={0.3} />
            <group position={[-0.8 * sx, 2.25, 0.25]} ref={(el) => (arcs.current[i] = el)}>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} geometry={BOX} material={arcMat} position={[0.2 * k * -sx, Math.sin(k * 2.1) * 0.12, 0]} rotation={[0, 0, (k % 2 ? 0.7 : -0.7) * sx]} scale={[0.28, 0.025, 0.025]} />
              ))}
            </group>
          </group>
        ))}

        {/* title sign on a gantry over the chamber */}
        {[-1, 1].map((sx) => (
          <B key={sx} g={CYL} c="#5a4a8a" o={METAL} p={[2.6 * sx, 2.3, -1.6]} s={[0.1, 4.0, 0.1]} />
        ))}
        <mesh material={title} position={[0, 4.15, -1.6]}>
          <planeGeometry args={[5.2, 1.3]} />
        </mesh>

        {/* clone counter screen */}
        <B g={BOX} c="#2a2a30" o={METAL} p={[1.75, 1.2, 1.35]} r={[0, -0.4, 0]} s={[1.3, 0.75, 0.12]} />
        <mesh material={screen} position={[1.72, 1.2, 1.42]} rotation={[0, -0.4, 0]}>
          <planeGeometry args={[1.2, 0.6]} />
        </mesh>
        <B g={CYL} c="#5a4a8a" o={METAL} p={[1.75, 0.55, 1.3]} s={[0.06, 0.7, 0.06]} />

        {/* control panel with the big red button */}
        <group position={[-1.5, 0, 1.4]} rotation={[0, 0.45, 0]}>
          <B g={BOX} c="#4a4a55" o={METAL} p={[0, 0.7, 0]} s={[1.0, 0.8, 0.55]} />
          <B g={BOX} c="#2a2a30" o={METAL} p={[0, 1.12, 0.05]} r={[-0.5, 0, 0]} s={[1.0, 0.06, 0.55]} />
          {[[-0.32, '#2ec4a6'], [-0.16, '#ffd23f'], [0.32, '#ff4fa3']].map(([x, c]) => (
            <B key={x} g={CYL} c={c} o={{ emissive: c, emissiveIntensity: 1.2 }} p={[x, 1.16, 0.08]} r={[-0.5, 0, 0]} s={[0.05, 0.03, 0.05]} />
          ))}
          <mesh ref={button} geometry={CYL} material={m('#e8222e', { emissive: '#e8222e', emissiveIntensity: 0.8 })} position={[0.08, 1.18, 0.05]} rotation={[-0.5, 0, 0]} scale={[0.12, 0.06, 0.12]} />
          {/* the original Ryan Jr., the boss, in lab goggles */}
          <group ref={boss} position={[-0.85, 0.32, 0.05]} rotation={[0, 0.5, 0]} scale={2.1}>
            <RyanJr />
            <B g={RING} c="#ffd23f" o={METAL} p={[-0.046, 0.497, 0.262]} s={0.03} />
            <B g={RING} c="#ffd23f" o={METAL} p={[0.046, 0.497, 0.262]} s={0.03} />
            <B g={BOX} c="#2a2a30" p={[0, 0.5, 0.17]} s={[0.245, 0.02, 0.16]} />
          </group>
          <sprite ref={bubble} material={bubbles[0]} position={[-0.85, 1.9, 0.05]} scale={[1.0, 0.5, 1]} />
        </group>
      </group>
    </group>
  )
}
