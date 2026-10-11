import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AllisonBody, DrumSet, RyanJr } from './Allison.jsx'
import { RoseBody } from './Rose.jsx'
import { GEO, Parts, dinoParts, monsterParts } from './TikiParty.jsx'
import { useTalkable } from './talkable.js'
import { BPM, ERUPT_AT, concert, useConcert } from './concert.js'
import { blip } from './music.js'
import { AUDIENCE, GOLDEN, STAGE, heightAt } from './island.js'

// The Ryan Jr. Island concert. Talk to Golden Ryan Jr. -> 20 s countdown -> 90 s show:
// Allison on drums (under protest), Rose on guitar, three tiki monsters (bass, keys, vocals),
// 20 dinosaurs cheering in the crowd, fact bubbles, spotlights, a disco ball, fireworks, confetti,
// smoke and beach balls. The music itself is synthesized in music.js.

export const GOLDEN_PROF = {
  id: 'golden-ryan-jr',
  name: 'Golden Ryan Jr.',
  action: () => concert.start(),
  hint: 'Click Golden Ryan Jr. to start the party!',
  talk: 'Start the party! 🎉',
}

const SPH = new THREE.SphereGeometry(1, 16, 12)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CONE = new THREE.ConeGeometry(1, 1, 20, 1, true)
const COLORS = ['#ff4fa3', '#ffd23f', '#2ec4a6', '#7a4fd1', '#ff7a3d', '#4fb3ff', '#ffffff']

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }))
  return mats.get(k)
}
const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

function rand(seed) {
  let s = seed >>> 0
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)]

// speech bubble that word-wraps and shrinks its font to fit (cached per text)
const bubbles = new Map()
export function textBubble(text, color = '#ff4fa3') {
  const key = text + color
  if (bubbles.has(key)) return bubbles.get(key)
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 300
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.strokeStyle = color
  g.lineWidth = 10
  g.beginPath()
  g.roundRect(10, 10, 620, 220, 50)
  g.moveTo(290, 228)
  g.lineTo(270, 290)
  g.lineTo(340, 228)
  g.fill()
  g.stroke()
  g.fillStyle = '#1d1d22'
  g.textAlign = 'center'
  let size = 66
  let lines
  for (; size >= 30; size -= 4) {
    g.font = `bold ${size}px system-ui, sans-serif`
    const words = text.split(' ')
    lines = ['']
    for (const w of words) {
      const tryLine = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w
      if (g.measureText(tryLine).width < 570) lines[lines.length - 1] = tryLine
      else lines.push(w)
    }
    if (lines.length <= 3 && lines.every((l) => g.measureText(l).width < 570)) break
  }
  const lh = size * 1.12
  lines.forEach((l, i) => g.fillText(l, 320, 120 - ((lines.length - 1) * lh) / 2 + i * lh + size * 0.35))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })
  bubbles.set(key, mat)
  return mat
}

// stage frame: same transform as the Stage in Island.jsx (local +z faces the audience, deck top at 0.93)
const STAGE_Y = () => Math.max(heightAt(STAGE.x, STAGE.z), 0.5)
const DECK = 0.93
const DRUMS_X = 1.5 // drum riser off to the side so the singer doesn't hide Allison
const bow = (showT) => Math.min(1, Math.max(0, (showT - 87.5) * 2)) * 0.55 // everyone bows in the last 2 s

const ALLISON_FACTS = [
  "I'm allergic to Ryan Jr. (achoo!)",
  'I ride horses!',
  'Debate club captain energy',
  'James, are you watching?!',
  'I STILL hate drums.',
  'Animals > people. Fact.',
  'Ryan Jr. is my lawyer',
  'Resolved: this is fun. Ugh.',
]
const ROSE_FACTS = [
  'I can tie my shoes!',
  'Nirvana forever!',
  'shh… Taylor Swift is my fave',
  'I ride horses too! Giddy up!',
  'Bunny ears, double knot!',
  'Rock on!!',
  'This is NOT terrible music!',
]
const CROWD_LINES = [
  'BEST. CONCERT. EVER!',
  'Is Allison DRUMMING?!',
  'I left my eggs in the oven!',
  'ENCORE!!',
  'My tail cannot stop dancing!',
  'Rose! Play Nirvana!',
  "I'm a T. rex and I can't clap!",
  'This is RAWR-some!',
  'Who invited the shark?',
  '101 cats?! 102?!',
  'My mom thinks I am at a museum',
  'Mosh pit! (gently)',
  'That tiki monster winked at me!',
  'Extinction? Never heard of her',
  'TIKI TUXEDOS!!!',
  'I can see the confetti from space',
]
const VOLCANO_LINES = [
  'THE VOLCANO IS PART OF THE SHOW!',
  'LAVA MOSH PIT!!!',
  'Hot hot HOT!',
  "I'm a dinosaur. I've seen this before.",
  'Not again!! (it is fine)',
  'BEST. ERUPTION. EVER!',
  'Turn it up to MAGMA!',
  'Is my tail on fire? Worth it!',
  'Somebody call the shark!',
  'MORE FIREWORKS!!!',
  'This party is LITERALLY lit',
  'Ryan Jr. planned this, right?',
]

// ---------- the whole show
export default function Concert() {
  const lastBlip = useRef(-1)
  useEffect(() => () => concert.reset(), []) // leaving the island stops the show
  useFrame(() => {
    concert.tick()
    const { phase, countdownLeft } = concert.timeline()
    const sec = Math.ceil(countdownLeft)
    if (phase === 'countdown' && sec <= 5 && sec !== lastBlip.current) {
      lastBlip.current = sec
      blip(sec === 1)
    }
    if (phase !== 'countdown') lastBlip.current = -1
  })
  return (
    <>
      <GoldenRyanJr />
      <group position={[STAGE.x, STAGE_Y(), STAGE.z]} rotation={[0, STAGE.rot, 0]}>
        <CountdownSign />
        <Band />
        <StageLights />
      </group>
      <Crowd />
      <Fireworks />
      <Confetti />
      <BeachBalls />
    </>
  )
}

// ---------- Golden Ryan Jr. on a pedestal
function GoldenRyanJr() {
  const y = heightAt(GOLDEN.x, GOLDEN.z)
  const position = useMemo(() => [GOLDEN.x, y, GOLDEN.z], [y])
  const rotation = Math.PI / 2 // facing the plaza (east)
  const root = useRef()
  const hit = useRef()
  const statue = useRef()
  const bubble = useRef()
  const sparks = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useTalkable(GOLDEN_PROF, { position, rotation, root, hit, sway: 0.3, anyRoom: true })
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffcf3a', metalness: 1, roughness: 0.22, emissive: '#7a5200', emissiveIntensity: 0.35 }), [])
  useLayoutEffect(() => {
    statue.current.traverse((o) => {
      if (o.isMesh) o.material = gold
    })
  }, [gold])
  const lines = useMemo(
    () => ({
      idle: textBubble('Talk to me to start the party!', '#d9a400'),
      go: textBubble("Alright, let's get this party started! The band will play in 20 seconds!", '#d9a400'),
      show: textBubble('PARTY!!! Clone-tastic!', '#d9a400'),
    }),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { phase } = concert.timeline()
    statue.current.position.y = 0.95 + Math.sin(t * 2) * 0.05 + (phase === 'show' ? Math.abs(Math.sin(t * Math.PI * (BPM / 60))) * 0.15 : 0)
    bubble.current.material = phase === 'countdown' ? lines.go : phase === 'show' ? lines.show : lines.idle
    bubble.current.visible = phase !== 'idle' || t % 5 < 3
    for (let i = 0; i < 14; i++) {
      const a = t * 1.3 + (i / 14) * Math.PI * 2
      tmp.position.set(Math.cos(a) * 0.9, 1.2 + Math.sin(t * 3 + i) * 0.5, Math.sin(a) * 0.9)
      tmp.scale.setScalar(0.03 + 0.025 * Math.abs(Math.sin(t * 5 + i)))
      tmp.updateMatrix()
      sparks.current.setMatrixAt(i, tmp.matrix)
    }
    sparks.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      <mesh ref={hit} geometry={CYL} position={[0, 1.1, 0]} scale={[0.8, 2.2, 0.8]} visible={false} />
      <B g={CYL} c="#2a1d4e" o={{ metalness: 0.5, roughness: 0.4 }} p={[0, 0.45, 0]} s={[0.7, 0.9, 0.7]} />
      <B g={CYL} c="#ffcf3a" o={{ metalness: 1, roughness: 0.25 }} p={[0, 0.92, 0]} s={[0.75, 0.06, 0.75]} />
      <group ref={statue} position={[0, 0.95, 0]} scale={2.4}>
        <RyanJr />
      </group>
      <instancedMesh ref={sparks} args={[SPH, useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff3b0' }), []), 14]} />
      <pointLight color="#ffd23f" intensity={4} distance={6} position={[0, 2, 0.6]} />
      <sprite ref={bubble} material={lines.idle} position={[0, 3.1, 0]} scale={[2.4, 1.12, 1]} />
    </group>
  )
}

// ---------- big countdown over the stage
function CountdownSign() {
  const ref = useRef()
  const last = useRef('')
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return { canvas, tex }
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true }), [tex])
  useFrame(({ clock }) => {
    const { phase, countdownLeft } = concert.timeline()
    ref.current.visible = phase === 'countdown'
    if (phase !== 'countdown') return
    ref.current.scale.setScalar(1 + Math.max(0, 1 - (countdownLeft % 1)) * 0.08)
    ref.current.rotation.z = Math.sin(clock.elapsedTime * 3) * 0.03
    const key = String(Math.ceil(countdownLeft))
    if (key === last.current) return
    last.current = key
    const g = canvas.getContext('2d')
    g.clearRect(0, 0, 512, 256)
    g.fillStyle = 'rgba(29,29,34,0.92)'
    g.beginPath()
    g.roundRect(6, 6, 500, 244, 40)
    g.fill()
    g.strokeStyle = '#ffd23f'
    g.lineWidth = 10
    g.stroke()
    g.textAlign = 'center'
    g.fillStyle = '#ff4fa3'
    g.font = 'bold 40px system-ui, sans-serif'
    g.fillText('THE BAND STARTS IN', 256, 64)
    g.fillStyle = '#ffd23f'
    g.font = 'bold 170px "Arial Black", Impact, sans-serif'
    g.fillText(key, 256, 228)
    tex.needsUpdate = true
  })
  return (
    <mesh ref={ref} material={mat} position={[0, 7.4, -STAGE.d / 2 + 0.4]} visible={false}>
      <planeGeometry args={[4, 2]} />
    </mesh>
  )
}

// ---------- the band

function Band() {
  const show = useConcert()
  const visible = show.phase === 'show'
  return (
    <group visible={visible}>
      {visible && (
        <>
          <Drummer />
          <Guitarist />
          <Monster kind="bass" position={[3.4, DECK, 0.7]} wood="#3fb6a8" leaf="#2f6fd6" />
          <Monster kind="keys" position={[-3.9, DECK, -1.6]} wood="#9b5de5" leaf="#7cc95a" />
          <Monster kind="vocals" position={[0, DECK, 0.55]} wood="#e76f51" leaf="#ffd23f" />
          <FactBubbles />
        </>
      )}
    </group>
  )
}

function Drummer() {
  const rig = { head: useRef(), mouth: useRef(), upL: useRef(), loL: useRef(), upR: useRef(), loR: useRef() }
  const body = useRef()
  useFrame(() => {
    const { beat, showT } = concert.timeline()
    body.current.rotation.x = bow(showT)
    const hitR = Math.max(0, Math.sin(beat * Math.PI * 2)) // right hand: every beat
    const hitL = Math.max(0, Math.sin(beat * Math.PI * 2 + Math.PI)) // left hand: off-beats
    rig.upR.current.rotation.set(-0.85 - hitR * 0.35, 0, -0.25)
    rig.loR.current.rotation.set(-0.7 + hitR * 0.6, 0, 0.2)
    rig.upL.current.rotation.set(-0.85 - hitL * 0.35, 0, 0.25)
    rig.loL.current.rotation.set(-0.7 + hitL * 0.6, 0, -0.2)
    rig.head.current.rotation.x = Math.abs(Math.sin(beat * Math.PI)) * 0.15
    rig.mouth.current.scale.y = 0.012
  })
  return (
    <group>
      <DrumSet position={[DRUMS_X, DECK, -1.0]} rotation={0} />
      <group ref={body} position={[DRUMS_X, DECK + 0.05, -1.62]}>
        <AllisonBody rig={rig} />
      </group>
    </group>
  )
}

function Guitarist() {
  const root = useRef()
  const rig = { head: useRef(), mouth: useRef(), upL: useRef(), loL: useRef(), upR: useRef(), loR: useRef() }
  useFrame(() => {
    const { beat, showT } = concert.timeline()
    root.current.position.y = DECK + Math.abs(Math.sin(beat * Math.PI)) * 0.12
    root.current.rotation.set(bow(showT), 0, Math.sin(beat * Math.PI * 0.5) * 0.08)
    rig.head.current.rotation.x = Math.abs(Math.sin(beat * Math.PI)) * 0.25
    rig.upR.current.rotation.set(-0.35, 0, -0.1)
    rig.loR.current.rotation.set(-1.1, 0, 0.9 + Math.sin(beat * Math.PI * 4) * 0.3)
    const pump = Math.floor(beat / 8) % 4 === 3 ? Math.max(0, Math.sin(beat * Math.PI)) : 0
    rig.upL.current.rotation.set(-0.7 * (1 - pump), 0, 0.6 + pump * 2.1)
    rig.loL.current.rotation.set(-1.0 * (1 - pump), 0, -0.3 * (1 - pump) + pump * 0.2)
    rig.mouth.current.scale.y = 0.011 + pump * 0.012
  })
  return (
    <group ref={root} position={[-2.4, DECK, 0.6]}>
      <RoseBody rig={rig} />
    </group>
  )
}

function Monster({ kind, position, wood, leaf }) {
  const root = useRef()
  const prop = useRef()
  const parts = useMemo(() => monsterParts({ wood, leaf, skirt: kind !== 'keys' }), [wood, leaf, kind])
  const keys = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 256, 64)
    g.fillStyle = '#1d1d22'
    for (let i = 0; i < 16; i++) {
      g.fillRect(i * 16, 0, 1.5, 64)
      if (![2, 6, 9, 13].includes(i % 7)) g.fillRect(i * 16 + 10, 0, 8, 38)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 })
  }, [])
  useFrame(() => {
    const { beat, showT } = concert.timeline()
    const bounce = Math.abs(Math.sin(beat * Math.PI))
    root.current.position.y = position[1] + bounce * (kind === 'vocals' ? 0.2 : 0.1)
    root.current.rotation.set(bow(showT), 0, Math.sin(beat * Math.PI * 0.5) * 0.12)
    if (prop.current) prop.current.rotation.z = kind === 'vocals' ? Math.sin(beat * Math.PI * 2) * 0.6 : Math.sin(beat * Math.PI) * 0.08
  })
  return (
    <group ref={root} position={position}>
      <group scale={1.15}>
        <Parts parts={parts} />
      </group>
      {kind === 'bass' && (
        <group ref={prop} position={[0, 0.8, 0.48]} rotation={[0, 0, 0.6]}>
          <B c="#d62839" o={{ roughness: 0.3 }} p={[-0.12, 0, 0]} s={[0.2, 0.15, 0.05]} />
          <B g={BOX} c="#3b2617" p={[0.4, 0, 0]} s={[0.8, 0.05, 0.03]} />
          <B g={BOX} c="#1d1d22" p={[0.85, 0, 0]} s={[0.14, 0.08, 0.03]} />
        </group>
      )}
      {kind === 'keys' && (
        <group position={[0, 0, 0.75]}>
          {[-1, 1].map((sx) => (
            <B key={sx} g={BOX} c="#1d1d22" p={[0, 0.45, 0]} r={[0, 0, sx * 0.5]} s={[0.04, 0.95, 0.04]} />
          ))}
          <B g={BOX} c="#2a2a30" p={[0, 0.86, 0]} s={[1.1, 0.07, 0.32]} />
          <mesh material={keys} position={[0, 0.9, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.0, 0.25]} />
          </mesh>
        </group>
      )}
      {kind === 'vocals' && (
        <group ref={prop} position={[0.55, 1.45, 0.3]}>
          {[0, 1].map((k) => (
            <group key={k} position={[k ? -1.1 : 0, 0, 0]}>
              <B g={CYL} c="#6b4426" p={[0, -0.12, 0]} s={[0.02, 0.22, 0.02]} />
              <B c={k ? '#ffd23f' : '#2ec4a6'} p={[0, 0.05, 0]} s={[0.09, 0.11, 0.09]} />
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

// Allison and Rose spot the volcano (seconds into the show)
const VOLCANO_CUES = [
  [39.5, 'allison', 'Uh… why is the crater SMOKING?!'],
  [42.5, 'rose', 'Is that… a VOLCANO?!'],
  [45.3, 'allison', "IT'S A VOLCANO!!! KEEP PLAYING!!!"],
  [48.7, 'rose', 'LAVA + GRUNGE = PERFECT!!'],
  [52.1, 'allison', 'Best. Worst. Day. EVER!'],
]

// random facts above Allison and Rose, taking turns
function FactBubbles() {
  const allison = useRef()
  const rose = useRef()
  const r = useMemo(() => rand(Date.now() & 0xffff), [])
  const slot = useRef(-1)
  useFrame(() => {
    const { showT } = concert.timeline()
    const cue = VOLCANO_CUES.find(([at]) => showT >= at && showT < at + 3.2)
    if (cue) {
      const [at, who, text] = cue
      if (slot.current !== `cue${at}`) {
        slot.current = `cue${at}`
        const [on, off] = who === 'allison' ? [allison.current, rose.current] : [rose.current, allison.current]
        on.material = textBubble(text, '#ff7a1a')
        on.visible = true
        off.visible = false
      }
      return
    }
    if (showT >= VOLCANO_CUES[0][0] && showT < VOLCANO_CUES.at(-1)[0] + 3.5) {
      allison.current.visible = false
      rose.current.visible = false
      return
    }
    const s = Math.floor(showT / 4.5)
    if (s !== slot.current) {
      slot.current = s
      const who = s % 2 === 0 ? allison.current : rose.current
      const other = s % 2 === 0 ? rose.current : allison.current
      who.material = textBubble(s === 0 ? 'FINE. Just this once! 🙄' : pick(s % 2 === 0 ? ALLISON_FACTS : ROSE_FACTS, r), s % 2 === 0 ? '#ff4fa3' : '#d62839')
      who.visible = true
      other.visible = false
    }
    if (showT % 4.5 > 3.6) {
      allison.current.visible = false
      rose.current.visible = false
    }
  })
  return (
    <>
      <sprite ref={allison} position={[DRUMS_X + 0.6, DECK + 2.45, -1.6]} scale={[2.3, 1.08, 1]} visible={false} />
      <sprite ref={rose} position={[-2.4, DECK + 2.35, 0.6]} scale={[2.3, 1.08, 1]} visible={false} />
    </>
  )
}

// ---------- stage lights: sweeping beams, a flashing wash light, a disco ball, smoke
function StageLights() {
  const show = useConcert()
  const beams = useRef([])
  const wash = useRef()
  const ball = useRef()
  const smoke = useRef([])
  const lasers = useRef()
  const laserMats = useMemo(
    () => ['#39ff7a', '#ff2fd0', '#39ff7a', '#2fd8ff', '#ff2fd0', '#39ff7a', '#2fd8ff', '#ff2fd0'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })),
    [],
  )
  const beamMats = useMemo(
    () => ['#ff4fa3', '#2ec4a6', '#ffd23f', '#7a4fd1'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    [],
  )
  const smokeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false, roughness: 1 }), [])
  const discoMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e8f0', metalness: 1, roughness: 0.08, flatShading: true }), [])
  const washColor = useMemo(() => new THREE.Color(), [])
  const on = show.phase === 'show'
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { beat, erupt } = concert.timeline()
    const wild = erupt >= 0
    const f = wild ? 2.6 : 1 // everything sweeps faster once the volcano blows
    beams.current.forEach((b, i) => {
      if (!b) return
      b.visible = on
      b.rotation.set(-0.95 - Math.sin(t * 0.9 * f + i) * 0.25, Math.sin(t * 0.7 * f + i * 1.7) * 0.6, 0)
      beamMats[i].opacity = 0.12 + (beat >= 0 ? Math.max(0, 1 - (beat % 1) * 3) * 0.18 : 0)
    })
    // strobe: white flashes on every half beat after the eruption
    const strobe = wild && (beat * 2) % 1 < 0.12
    wash.current.intensity = on ? (strobe ? 70 : 8 + Math.max(0, 1 - (beat % 1) * 2.5) * 30) : 0
    wash.current.color.copy(strobe ? washColor.set('#ffffff') : washColor.set(COLORS[Math.floor(Math.max(0, beat)) % 6]))
    // lasers fanning out over the crowd
    lasers.current.visible = on && wild
    lasers.current.children.forEach((l, i) => {
      l.rotation.set(-0.12 - Math.abs(Math.sin(t * 1.3 + i)) * 0.25, Math.sin(t * 2.2 + i * 0.8) * 0.9, 0)
    })
    laserMats.forEach((mt, i) => (mt.opacity = 0.5 + Math.abs(Math.sin(t * 9 + i)) * 0.5))
    ball.current.visible = on
    ball.current.rotation.y = t * 1.5
    smoke.current.forEach((s, i) => {
      if (!s) return
      s.visible = on
      const u = ((t * 0.25 + i / 6) % 1)
      s.position.set(-4.5 + i * 1.8, DECK - 0.4 + u * 0.8, STAGE.d / 2 + 0.3 + u * 1.2)
      s.scale.set(0.5 + u * 1.1, 0.3 + u * 0.5, 0.5 + u * 1.1) // low, flat clouds rolling off the stage
    })
    smokeMat.opacity = 0.14
  })
  return (
    <>
      {[-3, -1, 1, 3].map((x, i) => (
        <group key={x} position={[x, 5.15, -STAGE.d / 2 + 0.88]} ref={(el) => (beams.current[i] = el)} visible={false}>
          {/* a long soft cone pointing out toward the crowd */}
          <mesh geometry={CONE} material={beamMats[i]} position={[0, -5, 0]} scale={[1.6, 10, 1.6]} />
        </group>
      ))}
      <pointLight ref={wash} position={[0, 4.5, 2.5]} distance={22} decay={1.2} intensity={0} />
      <group ref={lasers} position={[0, 5.3, -STAGE.d / 2 + 0.7]} visible={false}>
        {laserMats.map((mt, i) => (
          <group key={i}>
            <mesh material={mt} position={[0, 0, 16]} scale={[0.05, 0.05, 32]}>
              <boxGeometry />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={ball} position={[0, 4.9, 1.6]} visible={false}>
        <B g={CYL} c="#c0c4c8" p={[0, 0.5, 0]} s={[0.01, 1, 0.01]} />
        <mesh material={discoMat} scale={0.42}>
          <icosahedronGeometry args={[1, 2]} />
        </mesh>
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(el) => (smoke.current[i] = el)} geometry={SPH} material={smokeMat} visible={false} />
      ))}
    </>
  )
}

// ---------- the crowd: 20 dinos pour in at the start; when the volcano blows, 25 more stampede in,
// a conga line forms and one dino crowd-surfs. All drawn as instanced parts (one mesh per shape).
const CONGA = 6
function buildDinos() {
  const r = rand(2026)
  const kinds = ['rex', 'tri', 'neck']
  const skins = ['#6cc46a', '#4fb3c9', '#ff8fb0', '#b48be0', '#e6c84f', '#f2a65a', '#5fc9a8', '#7fb2ff', '#8fd14f', '#3fa66b']
  const make = (extra) => ({
    parts: dinoParts({ kind: pick(kinds, r), skin: pick(skins, r), accent: pick(COLORS, r), skirt: r() < 0.4 }),
    phase: r() * 2,
    talkEvery: 7 + r() * 9,
    talkOffset: r() * 10,
    line: Math.floor(r() * 100),
    ...extra,
  })
  const out = []
  for (let i = 0; i < 20; i++) {
    const x = AUDIENCE.x0 + 1.2 + Math.floor(i / 5) * 2.2 + (r() - 0.5) * 0.8
    const z = AUDIENCE.z0 + 1.5 + (i % 5) * 2.6 + (r() - 0.5) * 0.9
    out.push(make({ kind: 'crowd', to: [x, z], from: [x + 14 + r() * 8, z + (r() - 0.5) * 10], arrive: r() * 1.2 }))
  }
  for (let i = 0; i < 25; i++) {
    // the second wave fills in behind and around the first, running in from the volcano side
    const x = AUDIENCE.x1 + 0.5 + r() * 7
    const z = AUDIENCE.z0 - 3 + r() * (AUDIENCE.z1 - AUDIENCE.z0 + 6)
    out.push(make({ kind: 'crowd', to: [x, z], from: [x + 30 + r() * 10, z - 30 - r() * 12], arrive: ERUPT_AT + 1 + r() * 6 }))
  }
  for (let i = 0; i < CONGA; i++) out.push(make({ kind: 'conga', slot: i, arrive: ERUPT_AT + 3 }))
  out.push(make({ kind: 'surfer', arrive: ERUPT_AT + 5 }))
  return out
}

function Crowd() {
  const show = useConcert()
  const dinos = useMemo(buildDinos, [])
  if (show.phase !== 'show') return null
  return <CrowdInstanced dinos={dinos} />
}

const CROWD_MAT = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide })
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const AUD = { x: (AUDIENCE.x0 + AUDIENCE.x1) / 2 + 2, z: (AUDIENCE.z0 + AUDIENCE.z1) / 2 }

function CrowdInstanced({ dinos }) {
  const meshes = useRef({})
  const sprites = useRef([])
  const lines = useRef([])
  // per shape: the (dino, local matrix, color) entries drawn by that instanced mesh
  const buckets = useMemo(() => {
    const out = {}
    dinos.forEach((d, i) => d.parts.forEach((p) => (out[p.bucket] ??= []).push({ i, m: p.m, color: p.color })))
    return Object.entries(out)
  }, [dinos])
  const roots = useMemo(() => dinos.map(() => new THREE.Matrix4()), [dinos])
  const shown = useMemo(() => dinos.map(() => false), [dinos])
  const tmp = useMemo(() => new THREE.Matrix4(), [])
  const V3 = useMemo(() => new THREE.Vector3(), [])
  const Q4 = useMemo(() => new THREE.Quaternion(), [])
  const EU = useMemo(() => new THREE.Euler(), [])
  const S3 = useMemo(() => new THREE.Vector3(1.5, 1.5, 1.5), [])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    for (const [g, list] of buckets) {
      list.forEach((e, k) => meshes.current[g].setColorAt(k, c.set(e.color)))
      meshes.current[g].instanceColor.needsUpdate = true
    }
  }, [buckets])

  useFrame(() => {
    const { showT, beat, erupt } = concert.timeline()
    const wild = erupt >= 0 ? 1.7 : 1
    dinos.forEach((d, i) => {
      let x
      let z
      let y = 0
      let yaw = -Math.PI / 2
      let pitch = 0
      let roll = 0
      const u = Math.min(1, Math.max(0, (showT - d.arrive) / 3))
      shown[i] = showT >= d.arrive
      if (d.kind === 'crowd') {
        x = d.from[0] + (d.to[0] - d.from[0]) * u
        z = d.from[1] + (d.to[1] - d.from[1]) * u
        if (u < 1) {
          yaw = Math.atan2(d.to[0] - d.from[0], d.to[1] - d.from[1])
          y = Math.abs(Math.sin(showT * 9)) * 0.15
        } else {
          y = Math.abs(Math.sin((beat + d.phase) * Math.PI)) * 0.5 * wild
          yaw += Math.sin(beat * 0.5 + d.phase) * 0.3 * wild
          roll = Math.sin((beat + d.phase) * Math.PI) * 0.15 * wild
        }
      } else if (d.kind === 'conga') {
        const a = (showT - d.arrive) * 0.45 - d.slot * 0.42
        x = AUD.x + Math.cos(a) * 7.5
        z = AUD.z + Math.sin(a) * 10
        yaw = Math.atan2(-Math.sin(a), Math.cos(a))
        y = Math.abs(Math.sin(beat * Math.PI)) * 0.25
        roll = Math.sin(beat * Math.PI * 0.5) * 0.3
      } else {
        // crowd surfing: on its back, carried over everyone's heads
        x = AUD.x + Math.sin(showT * 0.5) * 4
        z = AUD.z + Math.sin(showT * 0.37) * 7
        y = 2.3 + Math.sin(showT * 3) * 0.25
        pitch = -1.3
        roll = Math.sin(showT * 4) * 0.4
        yaw = showT * 0.6
      }
      y += heightAt(x, z)
      roots[i].compose(V3.set(x, y, z), Q4.setFromEuler(EU.set(pitch, yaw, roll, 'YXZ')), S3)

      // every so often, shout something
      const sp = sprites.current[i]
      if (sp) {
        const k = Math.floor((showT + d.talkOffset) / d.talkEvery)
        const talking = shown[i] && u >= 1 && (showT + d.talkOffset) % d.talkEvery < 2.6
        const pool = erupt >= 0 ? VOLCANO_LINES : CROWD_LINES
        const key = `${erupt >= 0}${k}`
        if (talking && lines.current[i] !== key) {
          lines.current[i] = key
          sp.material = textBubble(pool[(d.line + k * 7) % pool.length], erupt >= 0 ? '#ff7a1a' : '#2ec4a6')
        }
        sp.visible = talking
        sp.position.set(x, y + 2.3, z)
      }
    })
    for (const [g, list] of buckets) {
      const mesh = meshes.current[g]
      list.forEach((e, k) => mesh.setMatrixAt(k, shown[e.i] ? tmp.multiplyMatrices(roots[e.i], e.m) : ZERO))
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      {buckets.map(([g, list]) => (
        <instancedMesh key={g} ref={(el) => (meshes.current[g] = el)} args={[GEO[g], CROWD_MAT, list.length]} frustumCulled={false} />
      ))}
      {dinos.map((_, i) => (
        <sprite key={i} ref={(el) => (sprites.current[i] = el)} scale={[2.1, 1.0, 1]} visible={false} />
      ))}
    </>
  )
}

// ---------- fireworks: rockets from behind the stage burst into colored sparks
const N_ROCKETS = 20
const SPARKS = 48
function Fireworks() {
  const show = useConcert()
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const rockets = useMemo(() => {
    const r = rand(7)
    return Array.from({ length: N_ROCKETS }, () => ({
      launch: -99,
      x: 0,
      z: 0,
      h: 0,
      dirs: Array.from({ length: SPARKS }, () => {
        const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize()
        return v.multiplyScalar(7 + r() * 4)
      }),
      r,
    }))
  }, [])
  const next = useRef(0)
  const lastBeat = useRef(-1)
  useFrame(() => {
    const now = performance.now() / 1000
    const { beat } = concert.timeline()
    const bar = Math.floor(beat / 4)
    const b = Math.floor(beat * 2) / 2
    // launch: every 2 beats in the choruses, every half beat in the finale
    const chorus = (bar >= 12 && bar < 20) || bar >= 24
    const every = bar >= 44 ? 0.5 : bar >= 24 ? 1 : 2 // every beat once the volcano blows
    if (beat >= 0 && chorus && bar < 47 && b !== lastBeat.current && b % every === 0) {
      lastBeat.current = b
      const k = rockets[next.current++ % N_ROCKETS]
      k.launch = now
      const wide = bar >= 24
      k.x = STAGE.x - 3 - k.r() * 4 + (wide ? k.r() * 30 : 0)
      k.z = STAGE.z + (k.r() - 0.5) * (wide ? 30 : 16)
      k.h = 16 + k.r() * (wide ? 18 : 10)
      const c = color.set(pick(COLORS, k.r))
      for (let i = 0; i < SPARKS; i++) ref.current.setColorAt(rockets.indexOf(k) * (SPARKS + 1) + i, c)
      ref.current.setColorAt(rockets.indexOf(k) * (SPARKS + 1) + SPARKS, color.set('#fff3b0'))
      ref.current.instanceColor.needsUpdate = true
    }
    rockets.forEach((k, ri) => {
      const a = now - k.launch
      const base = ri * (SPARKS + 1)
      const rise = 1.1
      // the rocket itself
      if (show.phase === 'show' && a >= 0 && a < rise) {
        tmp.position.set(k.x, 2 + (k.h - 2) * (a / rise), k.z)
        tmp.scale.setScalar(0.18)
      } else tmp.scale.setScalar(0)
      tmp.updateMatrix()
      ref.current.setMatrixAt(base + SPARKS, tmp.matrix)
      // the burst
      const e = a - rise
      for (let i = 0; i < SPARKS; i++) {
        if (show.phase === 'show' && e >= 0 && e < 1.9) {
          const v = k.dirs[i]
          tmp.position.set(k.x + v.x * e, k.h + v.y * e - 4.9 * e * e * 0.6, k.z + v.z * e)
          tmp.scale.setScalar(0.28 * (1 - e / 1.9))
        } else tmp.scale.setScalar(0)
        tmp.updateMatrix()
        ref.current.setMatrixAt(base + i, tmp.matrix)
      }
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[SPH, useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []), N_ROCKETS * (SPARKS + 1)]} frustumCulled={false} />
}

// ---------- confetti cannons at the front corners of the stage, firing over the crowd
const N_CONFETTI = 360
function Confetti() {
  const show = useConcert()
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const pieces = useMemo(() => {
    const r = rand(11)
    return Array.from({ length: N_CONFETTI }, (_, i) => ({
      side: i % 2 ? 1 : -1,
      delay: r() * 3,
      vx: 4 + r() * 6,
      vy: 6 + r() * 5,
      vz: (r() - 0.5) * 7,
      spin: [r() * 8, r() * 8, r() * 8],
      color: pick(COLORS, r),
    }))
  }, [])
  useLayoutEffect(() => {
    const c = new THREE.Color()
    pieces.forEach((p, i) => ref.current.setColorAt(i, c.set(p.color)))
    ref.current.instanceColor.needsUpdate = true
  }, [pieces])
  useFrame(() => {
    const { showT, beat } = concert.timeline()
    const bar = Math.floor(beat / 4)
    // cannon blasts at the start of each big section (in bars), lasting ~6 s each
    const blasts = [12, 20, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44].map((b) => (b * 4 * 60) / BPM)
    const since = blasts.filter((s) => s <= showT).pop()
    const y0 = STAGE_Y() + 1.2
    pieces.forEach((p, i) => {
      const a = since != null ? showT - since - p.delay * 0.4 : -1
      if (show.phase !== 'show' || a < 0 || a > 6 || bar < 0) {
        tmp.scale.setScalar(0)
      } else {
        // shoot out, then flutter down slowly
        const fall = Math.max(0, a - 0.8)
        const x = STAGE.x + STAGE.d / 2 + p.vx * Math.min(a, 0.8) + Math.sin(a * 3 + i) * 0.3
        const y = y0 + p.vy * Math.min(a, 0.8) - 4.9 * Math.min(a, 0.8) ** 2 - fall * 1.6
        const z = STAGE.z + p.side * (STAGE.w / 2 - 0.5) + p.vz * Math.min(a, 1.2) - p.side * a * 1.2
        tmp.position.set(x, Math.max(y, heightAt(x, z) + 0.02), z)
        tmp.rotation.set(a * p.spin[0], a * p.spin[1], a * p.spin[2])
        tmp.scale.set(0.12, 0.012, 0.08)
      }
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[BOX, useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), []), N_CONFETTI]} frustumCulled={false} />
}

// ---------- beach balls bouncing over the crowd
function BeachBalls() {
  const show = useConcert()
  const balls = useRef([])
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')
    ;['#ff4f5e', '#ffffff', '#2f6fd6', '#ffffff', '#ffd23f', '#ffffff'].forEach((col, i) => {
      g.fillStyle = col
      g.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 64)
    })
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 })
  }, [])
  useFrame(() => {
    const { showT } = concert.timeline()
    balls.current.forEach((b, i) => {
      if (!b) return
      b.visible = show.phase === 'show' && (i < 3 || showT >= ERUPT_AT)
      const t = showT * (0.8 + i * 0.15) + i * 3
      const x = (AUDIENCE.x0 + AUDIENCE.x1) / 2 + Math.sin(t * 0.7) * 3.5
      const z = (AUDIENCE.z0 + AUDIENCE.z1) / 2 + Math.sin(t * 0.53 + i) * 5
      b.position.set(x, heightAt(x, z) + 2.4 + Math.abs(Math.sin(t * 2.2)) * 2.2, z)
      b.rotation.set(t * 2, t * 1.3, 0)
    })
  })
  return [0, 1, 2, 3, 4, 5].map((i) => (
    <mesh key={i} ref={(el) => (balls.current[i] = el)} geometry={SPH} material={mat} scale={0.45} visible={false} />
  ))
}
