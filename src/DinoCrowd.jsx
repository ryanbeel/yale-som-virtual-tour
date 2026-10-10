import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { G } from './Labubu.jsx'
import { CHAIRS, DRUMS } from './layout.js'

// ~30 seated cartoon dinosaur students per classroom (T. rex, triceratops, long-neck),
// drawn with a handful of instanced meshes (one per shape) so hundreds of them stay cheap.
const STUDENTS_PER_ROOM = 30
const HEIGHT = 0.95
const KINDS = ['rex', 'rex', 'tri', 'tri', 'neck']
const SKINS = ['#6cc46a', '#3fa66b', '#8fd14f', '#4fb3c9', '#7fb2ff', '#b48be0', '#f2a65a', '#ff8fb0', '#e6c84f', '#5fc9a8']
const BELLIES = ['#fff3c4', '#ffe9b0', '#f2efe9', '#ffd9e6']
const ACCENTS = ['#ff7a3d', '#ffd23f', '#ff4fa3', '#7a4fd1', '#2f6fd6', '#e8462e']
const WHITE = '#ffffff'
const BLACK = '#1b1b1f'
const CREAM = '#f6ecd2'
const BLUSH = '#ff9aa8'

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const M = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(V.set(...p), Q.setFromEuler(E.set(...r)), S.set(...s))
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b))

export const CONE = new THREE.ConeGeometry(1, 1, 14)

// pick seats + species/colors once
export const STUDENTS = DRUMS.flatMap((d, di) => {
  const r = rand(4242 + di * 977)
  const pick = (a) => a[Math.floor(r() * a.length)]
  const seats = CHAIRS.filter((c) => c.room === d.id)
    .map((c) => [r(), c])
    .sort((a, b) => a[0] - b[0])
    .slice(0, STUDENTS_PER_ROOM)
    .map(([, c]) => c)
  return seats.map((c) => ({
    x: c.x,
    y: (c.y || 0) + 0.51 - 0.11 * HEIGHT,
    z: c.z,
    rot: c.rot + Math.PI,
    kind: pick(KINDS),
    skin: pick(SKINS),
    belly: pick(BELLIES),
    accent: pick(ACCENTS),
    tilt: (r() - 0.5) * 0.3, // little head tilt so the room doesn't look cloned
  }))
})

// big googly eyes + rosy cheeks on a head centered at `h` with radii [sx, sy, sz] (+z is forward)
function face(add, h, [sx, sy, sz], eye = 0.3) {
  for (const side of [-1, 1]) {
    const e = mul(h, M([0.42 * sx * side, 0.3 * sy, 0.78 * sz]))
    add('sphere', mul(e, M([0, 0, 0], [0, 0, 0], [eye * sx, eye * sx, eye * sx * 0.8])), WHITE)
    add('sphere', mul(e, M([0.02 * side * sx, 0.02 * sy, eye * sx * 0.6], [0, 0, 0], [eye * sx * 0.55, eye * sx * 0.6, eye * sx * 0.4])), BLACK)
    add('sphere', mul(e, M([0.08 * sx * side, 0.1 * sy, eye * sx * 0.9], [0, 0, 0], [eye * sx * 0.18, eye * sx * 0.18, eye * sx * 0.1])), WHITE)
    add('sphere', mul(h, M([0.62 * sx * side, -0.12 * sy, 0.7 * sz], [0, 0, 0], [0.16 * sx, 0.1 * sx, 0.06 * sx])), BLUSH)
  }
}

// local part transforms for a seated dino (seat surface ~ y 0.11, facing +z)
export function partsFor(s) {
  const out = []
  const add = (bucket, m, color) => out.push({ bucket, m, color })
  const { skin, belly, accent } = s

  // body, belly, haunches, feet
  add('sphere', M([0, 0.33, 0], [0, 0, 0], [0.22, 0.24, 0.21]), skin)
  add('sphere', M([0, 0.31, 0.08], [0, 0, 0], [0.16, 0.19, 0.15]), belly)
  for (const x of [-0.11, 0.11]) {
    add('sphere', M([x, 0.19, 0.1], [0, 0, 0], [0.09, 0.08, 0.14]), skin)
    add('sphere', M([x, 0.13, 0.25], [0, 0, 0], [0.07, 0.05, 0.09]), skin)
    for (const t of [-0.035, 0, 0.035]) add('cone', M([x + t, 0.13, 0.33], [Math.PI / 2, 0, 0], [0.012, 0.03, 0.012]), CREAM)
  }

  // tail curling out behind the chair
  add('sphere', M([0, 0.2, -0.2], [0, 0, 0], [0.13, 0.11, 0.14]), skin)
  add('sphere', M([0.04, 0.17, -0.34], [0, 0, 0], [0.09, 0.08, 0.1]), skin)
  add('sphere', M([0.1, 0.16, -0.44], [0, 0, 0], [0.055, 0.05, 0.065]), skin)

  const head = (p) => M(p, [0, 0, s.tilt])

  if (s.kind === 'rex') {
    // tiny T. rex arms
    for (const side of [-1, 1]) add('limb', M([0.12 * side, 0.43, 0.15], [1.1, 0, 0.3 * side], [0.028, 0.03, 0.028]), skin)
    const h = head([0, 0.68, 0.05])
    const hs = [0.2, 0.18, 0.19]
    add('sphere', mul(h, M([0, 0, 0], [0, 0, 0], hs)), skin)
    add('sphere', mul(h, M([0, -0.06, 0.13], [0, 0, 0], [0.15, 0.1, 0.13])), skin)
    add('sphere', mul(h, M([0, -0.11, 0.14], [0, 0, 0], [0.13, 0.04, 0.11])), belly)
    for (const x of [-0.08, -0.03, 0.03, 0.08]) add('cone', mul(h, M([x, -0.1, 0.23 - Math.abs(x) * 0.5], [Math.PI, 0, 0], [0.014, 0.032, 0.014])), WHITE)
    face(add, h, hs)
    // back spikes from head to tail
    const spikes = [[0.17, -0.1, -0.2], [-0.01, -0.17, -0.6], [-0.16, -0.21, -0.8], [-0.3, -0.23, -1.0], [-0.47, -0.2, -1.2]]
    for (const [dy, dz, rx] of spikes) add('cone', M([0, 0.68 + dy, 0.05 + dz], [rx, 0, 0], [0.035, 0.07, 0.035]), accent)
  } else if (s.kind === 'tri') {
    for (const side of [-1, 1]) add('limb', M([0.15 * side, 0.36, 0.13], [0.9, 0, 0.3 * side], [0.04, 0.04, 0.04]), skin)
    const h = head([0, 0.6, 0.1])
    const hs = [0.2, 0.17, 0.19]
    add('sphere', mul(h, M([0, 0, 0], [0, 0, 0], hs)), skin)
    add('sphere', mul(h, M([0, -0.05, 0.15], [0, 0, 0], [0.12, 0.09, 0.1])), skin)
    add('cone', mul(h, M([0, -0.07, 0.25], [Math.PI / 2 + 0.3, 0, 0], [0.05, 0.06, 0.04])), CREAM) // beak
    // frill + its scalloped rim
    const frill = mul(h, M([0, 0.12, -0.13], [Math.PI / 2 - 0.45, 0, 0]))
    add('cyl', mul(frill, M([0, 0, 0], [0, 0, 0], [0.29, 0.03, 0.25])), accent)
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI - Math.PI
      add('sphere', mul(frill, M([Math.cos(a) * 0.28, 0, Math.sin(a) * 0.24], [0, 0, 0], [0.045, 0.04, 0.045])), belly)
    }
    // three horns
    for (const side of [-1, 1]) add('cone', mul(h, M([0.09 * side, 0.15, 0.08], [0.8, 0, -0.15 * side], [0.03, 0.13, 0.03])), CREAM)
    add('cone', mul(h, M([0, 0.03, 0.22], [0.55, 0, 0], [0.025, 0.07, 0.025])), CREAM)
    face(add, h, hs)
  } else {
    // long-neck: stubby arms, tall neck, small head, spotty back
    for (const side of [-1, 1]) add('limb', M([0.15 * side, 0.36, 0.13], [0.9, 0, 0.3 * side], [0.04, 0.04, 0.04]), skin)
    add('limb', M([0, 0.58, 0.08], [0.18, 0, 0], [0.075, 0.14, 0.075]), skin)
    add('limb', M([0, 0.58, 0.115], [0.18, 0, 0], [0.05, 0.13, 0.05]), belly)
    const h = head([0, 0.9, 0.15])
    const hs = [0.13, 0.11, 0.14]
    add('sphere', mul(h, M([0, 0, 0], [0, 0, 0], hs)), skin)
    add('sphere', mul(h, M([0, -0.03, 0.1], [0, 0, 0], [0.1, 0.07, 0.09])), skin)
    face(add, h, hs, 0.42)
    const spots = [[0.13, 0.44, -0.11], [-0.12, 0.4, -0.13], [0.02, 0.5, -0.15], [0.17, 0.3, -0.06], [-0.17, 0.32, -0.05], [0.06, 0.2, -0.36]]
    for (const [x, y, z] of spots) add('sphere', M([x, y, z], [0, 0, 0], [0.045, 0.045, 0.03]), accent)
  }
  return out
}

function buckets() {
  const mat = () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 })
  const cone = CONE
  return {
    sphere: [G.sphere, mat()],
    cone: [cone, mat()],
    cyl: [G.cyl, mat()],
    limb: [G.limb, mat()],
  }
}

function Bucket({ geo, mat, items }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const c = new THREE.Color()
    items.forEach((it, i) => {
      ref.current.setMatrixAt(i, it.m)
      ref.current.setColorAt(i, c.set(it.color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
  }, [items])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />
}

export default function DinoCrowd() {
  const groups = useMemo(() => {
    const defs = buckets()
    const lists = Object.fromEntries(Object.keys(defs).map((k) => [k, []]))
    for (const s of STUDENTS) {
      const root = M([s.x, s.y, s.z], [0, s.rot, 0], [HEIGHT, HEIGHT, HEIGHT])
      for (const p of partsFor(s)) lists[p.bucket].push({ m: mul(root, p.m), color: p.color })
    }
    return Object.entries(defs)
      .filter(([k]) => lists[k].length)
      .map(([k, [geo, mat]]) => ({ k, geo, mat, items: lists[k] }))
  }, [])
  return groups.map((g) => <Bucket key={g.k} geo={g.geo} mat={g.mat} items={g.items} />)
}
