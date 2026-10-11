import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from './world.js'

// A big glowing portal: a ring, a swirling vortex, orbiting sparkles and a label. Walk into it and
// you're sent to `to` (landing at `spawn`). Faces +z (rotate with `rotation`).
const SPH = new THREE.SphereGeometry(1, 12, 8)

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const swirlTex = (a, b) =>
  canvasTex(512, 512, (g, w) => {
    const c = w / 2
    const grad = g.createRadialGradient(c, c, 0, c, c, c)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.25, b)
    grad.addColorStop(1, a)
    g.fillStyle = grad
    g.fillRect(0, 0, w, w)
    g.globalAlpha = 0.55
    for (let arm = 0; arm < 5; arm++) {
      g.strokeStyle = arm % 2 ? '#ffffff' : b
      g.lineWidth = 14
      g.beginPath()
      for (let i = 0; i < 120; i++) {
        const t = i / 120
        const ang = arm * ((Math.PI * 2) / 5) + t * Math.PI * 3
        const r = t * c
        const x = c + Math.cos(ang) * r
        const y = c + Math.sin(ang) * r
        i ? g.lineTo(x, y) : g.moveTo(x, y)
      }
      g.stroke()
    }
  })

// `labelY` places the label (default: just above the ring; low ceilings can move it).
export default function Portal({ position, rotation = 0, radius = 1.3, to, spawn, label, labelY, colors = ['#00c2c7', '#ff4fa3'] }) {
  const { camera } = useThree()
  const vortex = useRef()
  const vortex2 = useRef()
  const sparks = useRef()
  const ring = useRef()
  const fired = useRef(false)
  const [a, b] = colors
  const mats = useMemo(() => {
    const swirl = swirlTex(a, b)
    return {
      ring: new THREE.MeshStandardMaterial({ color: b, emissive: b, emissiveIntensity: 2.2, roughness: 0.3 }),
      rim: new THREE.MeshStandardMaterial({ color: a, emissive: a, emissiveIntensity: 1.6, roughness: 0.3 }),
      vortex: new THREE.MeshBasicMaterial({ map: swirl, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }),
      vortex2: new THREE.MeshBasicMaterial({ map: swirl, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      spark: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      label: label
        ? new THREE.MeshBasicMaterial({
            transparent: true,
            map: canvasTex(1024, 192, (g, w, h) => {
              g.fillStyle = 'rgba(11,11,13,0.85)'
              g.beginPath()
              g.roundRect(4, 4, w - 8, h - 8, 40)
              g.fill()
              g.strokeStyle = b
              g.lineWidth = 8
              g.stroke()
              g.fillStyle = '#ffffff'
              g.font = 'bold 84px system-ui, sans-serif'
              g.textAlign = 'center'
              g.fillText(label, w / 2, 125)
            }),
          })
        : null,
    }
  }, [a, b, label])
  const sparkData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * Math.PI * 2, s: 0.6 + (i % 5) * 0.25, r: 1.05 + (i % 3) * 0.08 })), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    vortex.current.rotation.z = -t * 1.6
    vortex2.current.rotation.z = t * 2.3
    const pulse = 1 + Math.sin(t * 3) * 0.04
    ring.current.scale.setScalar(pulse)
    sparkData.forEach((s, i) => {
      const ang = s.a + t * s.s
      tmp.position.set(Math.cos(ang) * radius * s.r, Math.sin(ang) * radius * s.r, Math.sin(t * 2 + i) * 0.15)
      tmp.scale.setScalar(0.035 + 0.02 * Math.sin(t * 6 + i))
      tmp.updateMatrix()
      sparks.current.setMatrixAt(i, tmp.matrix)
    })
    sparks.current.instanceMatrix.needsUpdate = true

    // step through: close to the center (horizontally) and roughly at portal height
    const dx = camera.position.x - position[0]
    const dz = camera.position.z - position[2]
    const near = Math.hypot(dx, dz) < radius * 0.75 && Math.abs(camera.position.y - (position[1] + radius)) < radius + 0.8
    if (near && !fired.current) {
      fired.current = true
      world.go(to, spawn)
    }
    if (!near) fired.current = false
  })

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group position={[0, radius + 0.05, 0]}>
        <group ref={ring}>
          <mesh material={mats.ring}>
            <torusGeometry args={[radius, 0.12, 16, 64]} />
          </mesh>
          <mesh material={mats.rim}>
            <torusGeometry args={[radius + 0.16, 0.05, 10, 64]} />
          </mesh>
        </group>
        <mesh ref={vortex} material={mats.vortex}>
          <circleGeometry args={[radius, 48]} />
        </mesh>
        <mesh ref={vortex2} material={mats.vortex2} position={[0, 0, 0.02]}>
          <circleGeometry args={[radius * 0.85, 48]} />
        </mesh>
        <instancedMesh ref={sparks} args={[SPH, mats.spark, sparkData.length]} frustumCulled={false} />
        <pointLight color={b} intensity={6} distance={9} decay={1.6} position={[0, 0, 0.6]} />
      </group>
      {mats.label && (
        <mesh material={mats.label} position={[0, labelY ?? radius * 2 + 0.55, 0.05]}>
          <planeGeometry args={[radius * 2.4, radius * 0.45]} />
        </mesh>
      )}
    </group>
  )
}
