import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { chat, talkTo } from './chat.js'
import { locate } from './layout.js'

// shortest-path angle easing
export const ease = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k

// Shared behavior for professors you can chat with:
//   - click while aiming at `hit` (desktop) or get close (phones) to open the chat
//   - `root` turns to face the student while chatting, and scans the class otherwise
// Returns a ref with { talking, speaking } for the avatar's own animations
// (call this before the avatar's own useFrame so the state is fresh each frame).
// `anyRoom` skips the same-room check (outdoors there are no walls to talk through).
export function useTalkable(prof, { position, rotation, root, hit, sway = 0.35, anyRoom = false }) {
  const { camera, gl } = useThree()
  const room = useMemo(() => locate(position[0], position[2]), [position])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])
  const state = useRef({ talking: false, speaking: false })

  useEffect(() => {
    const down = (e) => {
      if (e.button === 0 && document.pointerLockElement === gl.domElement && chat.get().aim?.id === prof.id) talkTo(prof)
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [gl, prof])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const s = chat.get()
    const talking = s.open?.id === prof.id

    // aim + proximity (same room only, so you can't chat through a wall)
    const dist = Math.hypot(camera.position.x - position[0], camera.position.z - position[2])
    const sameRoom = anyRoom || locate(camera.position.x, camera.position.z) === room
    ray.setFromCamera(center, camera)
    ray.far = 7
    const aimed = sameRoom && ray.intersectObject(hit.current, false).length > 0
    chat.set({
      aim: aimed ? prof : s.aim?.id === prof.id ? null : s.aim,
      near: sameRoom && dist < 4.5 ? prof : s.near?.id === prof.id ? null : s.near,
    })

    const toCam = Math.atan2(camera.position.x - position[0], camera.position.z - position[2])
    root.current.rotation.y = ease(root.current.rotation.y, talking ? toCam : rotation + Math.sin(t * 0.4) * sway, talking ? 0.12 : 0.05)
    state.current.talking = talking
    state.current.speaking = talking && performance.now() / 1000 < chat.speakUntil
  })

  return state
}
