import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AUDIENCE, MACHINE, heightAt, inland } from './island.js'
import { concert } from './concert.js'
import { LAST_SNEEZE, T as PRESS, press } from './donotpress.js'
import { sneezeLift } from './DoNotPress.jsx'

// The Ryan Jr. clone army: 100 at the start, plus one more out of the Clone-O-Matic every 60 seconds.
// Each body part (head, ears, tail...) is one InstancedMesh shared by every cat, so hundreds of cats
// stay cheap. Clones wander, dance, sit and nap; some wear sunglasses, party hats or leis.

export const START_CLONES = 100
export const CLONE_EVERY = 60 // seconds
export const MAX_CLONES = 320 // the island fits this many on screen; the counter keeps going
export const pageSeconds = () => performance.now() / 1000
export const cloneTotal = (s = pageSeconds()) => START_CLONES + Math.floor(s / CLONE_EVERY)

// shared with the minimap: [x0, z0, x1, z1, ...] and how many are active
export const catXZ = new Float32Array(MAX_CLONES * 2)
export const catCount = { n: 0 }

// the chamber the clones come out of (front of the machine)
export const CHAMBER = { x: MACHINE.x, z: MACHINE.z }
const BIRTH = 4.5 // seconds a newborn spends in the chamber before strolling out

const BLACK = '#1d1d22'
const WHITE = '#f6f4ef'
const INNER = '#ff8fa3'
const PARTY = ['#ff4fa3', '#ffd23f', '#2ec4a6', '#7a4fd1', '#ff7a3d', '#4fb3ff']

const GEO = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.28, 6, 14),
}
const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const M = (p, r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(V.set(...p), Q.setFromEuler(r ? E.set(r[0], r[1], r[2], 'XYZ') : E.set(0, 0, 0, 'XYZ')), S.set(...(typeof s === 'number' ? [s, s, s] : s)))

// one cat's parts, the same layout as Ryan Jr. in Allison's room; `acc` toggles accessories by
// scaling them to zero, so every cat has the same slot layout in the instanced meshes
const PARTS = (() => {
  const out = []
  const add = (g, m, color, key) => out.push({ g, m, color, key })
  add('sphere', M([0, 0.24, -0.02], 0, [0.12, 0.11, 0.2]), BLACK)
  add('sphere', M([0, 0.21, 0.08], 0, [0.085, 0.09, 0.1]), WHITE)
  for (const [x, z] of [[-0.065, 0.12], [0.065, 0.12], [-0.065, -0.14], [0.065, -0.14]]) {
    add('cyl', M([x, 0.09, z], 0, [0.032, 0.16, 0.032]), BLACK)
    add('sphere', M([x, 0.02, z + 0.01], 0, [0.035, 0.022, 0.045]), WHITE)
  }
  for (let i = 0; i < 4; i++) add('sphere', M([0, 0.3 + i * 0.055, -0.23 - Math.sin(i * 0.5) * 0.04], 0, 0.026), i === 3 ? WHITE : BLACK)
  add('cyl', M([0, 0.33, 0.12], [0.4, 0, 0], [0.065, 0.02, 0.065]), '#d62839')
  add('sphere', M([0, 0.42, 0.15], 0, [0.1, 0.09, 0.09]), BLACK)
  add('sphere', M([0, 0.385, 0.21], 0, [0.055, 0.042, 0.04]), WHITE)
  add('sphere', M([0, 0.44, 0.225], 0, [0.012, 0.04, 0.012]), WHITE)
  add('sphere', M([0, 0.408, 0.248], 0, [0.012, 0.009, 0.007]), INNER)
  for (const sx of [-1, 1]) {
    add('cone', M([0.06 * sx, 0.505, 0.15], [0, 0, -0.3 * sx], [0.035, 0.07, 0.025]), BLACK)
    add('cone', M([0.058 * sx, 0.5, 0.16], [0, 0, -0.3 * sx], [0.018, 0.045, 0.01]), INNER)
    add('sphere', M([0.04 * sx, 0.432, 0.225], 0, [0.022, 0.024, 0.014]), '#c8e04a')
    add('sphere', M([0.04 * sx, 0.432, 0.237], 0, [0.007, 0.018, 0.006]), '#111111')
  }
  add('box', M([0, 0.435, 0.24], 0, [0.12, 0.03, 0.012]), '#111111', 'shades')
  add('cone', M([0.02, 0.57, 0.14], [0, 0, -0.15], [0.042, 0.1, 0.042]), null, 'hat')
  add('torus', M([0, 0.33, 0.11], [Math.PI / 2 - 0.4, 0, 0], 0.085), null, 'lei')
  return out
})()
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

// a random spot on dry land (not in the water, not inside the crater walls)
function landSpot(r) {
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 55
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (inland(x, z) > 3 && heightAt(x, z) < 2.5) return [x, z]
  }
  return [0, 20]
}

function makeCat(i) {
  const r = rand(1000 + i * 7919)
  const [x, z] = i < START_CLONES ? landSpot(r) : [CHAMBER.x, CHAMBER.z]
  return {
    x,
    z,
    yaw: r() * Math.PI * 2,
    target: landSpot(r),
    mode: 'walk',
    timer: r() * 6,
    speed: 0.7 + r() * 0.9,
    size: 0.95 + r() * 0.45,
    phase: r() * 10,
    rand: r,
    acc: { shades: r() < 0.3, hat: r() < 0.25, lei: r() < 0.35 },
    accColor: PARTY[Math.floor(r() * PARTY.length)],
    born: i < START_CLONES ? -Infinity : (i - START_CLONES + 1) * CLONE_EVERY,
  }
}

export default function IslandCats() {
  const cats = useMemo(() => Array.from({ length: MAX_CLONES }, (_, i) => makeCat(i)), [])
  // per geometry: which part indices use it, so each instanced mesh has a fixed slot per (cat, part)
  const buckets = useMemo(() => {
    const out = {}
    PARTS.forEach((p, k) => (out[p.g] ??= []).push(k))
    return Object.entries(out)
  }, [])
  const meshes = useRef({})
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), [])
  const root = useMemo(() => new THREE.Matrix4(), [])
  const tmp = useMemo(() => new THREE.Matrix4(), [])

  // colors never change, so set them once
  useLayoutEffect(() => {
    const c = new THREE.Color()
    for (const [g, ks] of buckets) {
      const mesh = meshes.current[g]
      cats.forEach((cat, i) =>
        ks.forEach((k, j) => {
          mesh.setColorAt(i * ks.length + j, c.set(PARTS[k].color ?? cat.accColor))
        }),
      )
      mesh.instanceColor.needsUpdate = true
    }
  }, [buckets, cats])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const now = pageSeconds()
    const total = Math.min(MAX_CLONES, cloneTotal(now))
    const party = concert.get().phase === 'show'
    const pressT = press.t()
    const zoomies = pressT >= PRESS.RISE && pressT < LAST_SNEEZE // giant cat! everybody RUN
    const wild = concert.get().erupted // two thirds of the clones join in once the volcano blows
    catCount.n = total
    cats.forEach((cat, i) => {
      const t = now + cat.phase
      let y = 0
      let roll = 0
      let pitch = 0
      if (i < total) {
        const age = now - cat.born
        if (age < BIRTH) {
          // materializing in the chamber: rises up spinning
          cat.x = CHAMBER.x
          cat.z = CHAMBER.z
          cat.yaw = age * 3
          y = 0.35 + Math.sin(Math.min(1, age / BIRTH) * Math.PI) * 0.6
        } else {
          cat.timer -= dt
          if (party && (i % 3 === 0 || (wild && i % 3 === 1)) && !cat.partying) {
            // run to the back of the crowd and dance
            cat.partying = true
            cat.mode = 'walk'
            cat.speed *= 3
            cat.target = [AUDIENCE.x1 + 1 + cat.rand() * 5, AUDIENCE.z0 + cat.rand() * (AUDIENCE.z1 - AUDIENCE.z0)]
            cat.timer = 99
          } else if (!party && cat.partying) {
            cat.partying = false
            cat.speed /= 3
            cat.timer = 0
          }
          if (cat.partying && cat.mode === 'walk' && Math.hypot(cat.target[0] - cat.x, cat.target[1] - cat.z) < 0.5) {
            cat.mode = 'dance'
            cat.timer = 99
          }
          if (zoomies && cat.mode !== 'walk') cat.timer = 0
          if (cat.timer <= 0) {
            const pick = zoomies ? 0 : cat.rand()
            cat.mode = pick < 0.55 ? 'walk' : pick < 0.72 ? 'dance' : pick < 0.87 ? 'sit' : 'nap'
            cat.timer = 3 + cat.rand() * 8
            if (cat.mode === 'walk') cat.target = landSpot(cat.rand)
          }
          if (cat.mode === 'walk') {
            const dx = cat.target[0] - cat.x
            const dz = cat.target[1] - cat.z
            const d = Math.hypot(dx, dz)
            if (d < 0.5 && !cat.partying) cat.timer = 0
            else {
              const step = Math.min(d, cat.speed * dt * (zoomies ? 4 : 1))
              cat.x += (dx / d) * step
              cat.z += (dz / d) * step
              const want = Math.atan2(dx, dz)
              cat.yaw += Math.atan2(Math.sin(want - cat.yaw), Math.cos(want - cat.yaw)) * Math.min(1, dt * 6)
              y = Math.abs(Math.sin(t * 9)) * 0.03
              roll = Math.sin(t * 9) * 0.06
            }
          } else if (cat.mode === 'dance') {
            y = Math.abs(Math.sin(t * 6)) * 0.12
            cat.yaw += dt * 2.5
          } else if (cat.mode === 'sit') {
            pitch = -0.35
          } else {
            roll = 1.35 // napping on its side
            y = -0.06
          }
        }
        y += heightAt(cat.x, cat.z)
        // ACHOO: every clone on the island goes flying (slow motion, spinning)
        const lift = pressT >= 0 ? sneezeLift(pressT, cat.phase) : null
        if (lift) {
          y += lift.y
          pitch += lift.spin
          roll += lift.spin * 0.4
        }
      }
      catXZ[i * 2] = cat.x
      catXZ[i * 2 + 1] = cat.z
      root.compose(V.set(cat.x, y, cat.z), Q.setFromEuler(E.set(pitch, cat.yaw, roll, 'YXZ')), S.setScalar(i < total ? cat.size : 0))
      for (const [g, ks] of buckets) {
        const mesh = meshes.current[g]
        ks.forEach((k, j) => {
          const p = PARTS[k]
          const hide = i >= total || (p.key && !cat.acc[p.key])
          mesh.setMatrixAt(i * ks.length + j, hide ? ZERO : tmp.multiplyMatrices(root, p.m))
        })
      }
    })
    for (const [g] of buckets) meshes.current[g].instanceMatrix.needsUpdate = true
  })

  return buckets.map(([g, ks]) => (
    <instancedMesh
      key={g}
      ref={(el) => (meshes.current[g] = el)}
      args={[GEO[g], mat, MAX_CLONES * ks.length]}
      frustumCulled={false}
    />
  ))
}
