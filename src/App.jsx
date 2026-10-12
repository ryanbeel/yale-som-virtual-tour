import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Island from './Island.jsx'
import Player from './Player.jsx'
import Minimap from './Minimap.jsx'
import TouchControls from './TouchControls.jsx'
import ChatWindow from './ChatWindow.jsx'
import { chat, talkTo, useChat } from './chat.js'
import { concert, useConcert } from './concert.js'
import { SNEEZES, T as PRESS, usePress } from './donotpress.js'
import { W as WAR_T, useWar } from './war.js'
import { EYE, SPAWN, collide, floorAt, locate } from './layout.js'
import * as island from './island.js'
import { useWorld } from './world.js'

// each world's physics for the player: walls, floor heights, room names, and where you appear
const ENVS = {
  evans: { collide, floorAt, locate, spawn: { x: SPAWN.x, z: SPAWN.z, yaw: 0 } },
  island: { collide: island.collide, floorAt: island.floorAt, locate: island.locate, spawn: island.SPAWN },
}

export default function App() {
  const [locked, setLocked] = useState(false)
  const [where, setWhere] = useState('')
  const [showMap, setShowMap] = useState(true)
  const lockRef = useRef()
  const mapRef = useRef()
  const onLock = useCallback((v) => setLocked(v), [])
  const onWhere = useCallback((w) => setWhere(w), [])
  // phones have no pointer lock, so they get a joystick + drag-to-look instead
  const [isTouch] = useState(() => matchMedia('(pointer: coarse)').matches) // phones + tablets; touchscreen laptops still get mouse mode
  const [touchOn, setTouchOn] = useState(false)
  const touchRef = useRef({ active: false, move: [0, 0], look: [0, 0], jump: false })
  const setTouch = (on) => {
    touchRef.current.active = on
    touchRef.current.move = [0, 0]
    setTouchOn(on)
  }
  const playing = locked || touchOn
  const here = useWorld()
  const show = useConcert()
  const pressed = usePress()
  const battle = useWar()
  // the war shakes the screen: the march, the clash, the giants arriving, the mega-explosion
  useEffect(() => {
    if (!battle.active) return
    const body = document.body.classList
    const at = (s, fn) => setTimeout(fn, s * 1000)
    const quake = (s, len) => [at(s, () => body.add('quake')), at(s + len, () => body.remove('quake'))]
    const timers = [
      at(WAR_T.MARCH, () => body.add('rumble')),
      at(WAR_T.CLASH + 1.5, () => body.remove('rumble')),
      ...quake(WAR_T.CLASH, 0.9),
      ...quake(WAR_T.REINFORCE, 1.2),
      ...quake(WAR_T.MEGA, 2),
    ]
    return () => {
      timers.forEach(clearTimeout)
      body.remove('rumble', 'quake')
    }
  }, [battle.active, battle.plays])
  // DO NOT PRESS: shake the screen while the giant rises, hard on the sneeze, gently while he purrs
  useEffect(() => {
    if (!pressed.active) return
    const body = document.body.classList
    const at = (ms, fn) => setTimeout(fn, ms)
    const timers = [
      at(3000, () => body.add('rumble')),
      at(PRESS.RISEN * 1000, () => body.remove('rumble')),
      at(PRESS.CLOSER * 1000, () => body.add('rumble')), // he's wading closer...
      ...SNEEZES.flatMap((sn) => [
        at(sn.at * 1000, () => {
          body.remove('rumble')
          body.add('quake')
        }),
        at((sn.at + 1.2 + sn.power) * 1000, () => body.remove('quake')),
      ]),
      at((SNEEZES.at(-1).at + 3) * 1000, () => body.add('rumble')), // the purr
      at(PRESS.SINK * 1000, () => body.remove('rumble')),
    ]
    return () => {
      timers.forEach(clearTimeout)
      body.remove('rumble', 'quake')
    }
  }, [pressed.active, pressed.presses])
  const talkingTo = useChat((s) => s.open)
  const aim = useChat((s) => s.aim)
  const near = useChat((s) => s.near)
  // opening a chat frees the mouse so you can type (and stops any joystick drift)
  useEffect(() => {
    if (!talkingTo) return
    touchRef.current.move = [0, 0]
    if (document.pointerLockElement) document.exitPointerLock()
  }, [talkingTo])
  const closeChat = (resume) => {
    chat.set({ open: null })
    if (resume && !touchOn) lockRef.current?.() // the close click counts as a gesture, so we can re-lock
  }
  useEffect(() => {
    const k = (e) => e.code === 'KeyM' && setShowMap((v) => !v)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <>
      <Canvas
        camera={{ fov: 72, near: 0.05, far: 800, position: [SPAWN.x, EYE, SPAWN.z] }}
        dpr={[1, 1.75]}
      >
        {here.name === 'island' ? <Island /> : <World />}
        <Player lockRef={lockRef} mapRef={mapRef} touchRef={touchRef} onLock={onLock} onWhere={onWhere} env={ENVS[here.name]} />
      </Canvas>

      <div className="where">
        <span className="dot" />
        {where}
      </div>
      <div className={showMap ? 'mapwrap' : 'mapwrap hidden'}>
        <Minimap key={here.name} drawRef={mapRef} world={here.name} />
      </div>
      <button className="maptoggle" onClick={() => setShowMap((s) => !s)}>
        {showMap ? 'hide map' : 'map'}
      </button>
      {playing && !talkingTo && <div className="crosshair" />}
      {locked && !talkingTo && aim && <div className="aimhint">{aim.hint ?? `Click to chat with Prof. ${aim.name.split(' ').pop()}`}</div>}
      {touchOn && !talkingTo && <TouchControls touchRef={touchRef} onPause={() => setTouch(false)} />}
      {touchOn && !talkingTo && near && (
        <button className="go talkbtn" onClick={() => talkTo(near)}>
          {near.talk ?? `Talk to Prof. ${near.name.split(' ').pop()}`}
        </button>
      )}
      <ChatWindow onClose={closeChat} />
      {here.name === 'island' && (
        <button className="mute" onClick={() => concert.setMuted(!show.muted)} aria-label={show.muted ? 'Unmute music' : 'Mute music'}>
          {show.muted ? '🔇' : '🔊'}
        </button>
      )}
      {here.flash > 0 && <div key={here.flash} className="flash" />}
      {here.name === 'island' && show.erupted && <div className="flash erupt" />}
      {here.name === 'island' && pressed.active && (
        <>
          {pressed.stage === 'alarm' && <div className="alarm-vignette" />}
          {pressed.stage === 'alarm' && <div className="event-title red">⚠️ YOU PRESSED IT ⚠️</div>}
          {pressed.stage === 'giant' && <div className="event-title">😱 GIANT RYAN JR.!!!</div>}
          {pressed.stage === 'sneeze1' && (
            <>
              <div className="flash" />
              <div className="event-title huge">ACHOO!</div>
            </>
          )}
          {pressed.stage === 'notdone' && <div className="event-title soft">…he's not done.</div>}
          {pressed.stage === 'sneeze2' && (
            <>
              <div className="flash" />
              <div className="event-title huge">ACHOO!!</div>
            </>
          )}
          {pressed.stage === 'closer' && <div className="event-title red">😨 HE'S COMING CLOSER</div>}
          {pressed.stage === 'ahh' && <div className="event-title shiver">ah… AH… AAAHHHH…</div>}
          {pressed.stage === 'sneeze3' && (
            <>
              <div className="flash long" />
              <div className="event-title mega">ACHOOOOOO!!!</div>
            </>
          )}
          {pressed.stage === 'bless' && <div className="event-title soft">bless you. 🐾</div>}
        </>
      )}
      {here.name === 'island' && battle.active && (
        <>
          {battle.stage === 'game' && <div className="event-title soft">🎲 game night 🎲</div>}
          {battle.stage === 'cheat' && <div className="event-title red wrap">🚨 THE TIKI CHEATED 🚨</div>}
          {battle.stage === 'war' && <div className="event-title wrap">⚔️ THE GREAT TIKI–DINO WAR ⚔️</div>}
          {battle.stage === 'charge' && <div className="event-title huge charge">CHAAAARGE!!!</div>}
          {battle.stage === 'reinforce' && <div className="event-title red wrap">⚠️ REINFORCEMENTS ⚠️</div>}
          {battle.stage === 'mega' && (
            <>
              <div className="flash long" />
              <div className="event-title mega">💥💥💥</div>
            </>
          )}
          {battle.stage === 'heap' && <div className="event-title soft wrap">Nobody won. Everybody flew.</div>}
        </>
      )}
      {here.name === 'island' && show.shark && (
        <>
          <div className="flash" />
          <div className="shark-solo">🦈 SHARK SOLO! 🦈</div>
        </>
      )}

      {!playing && !talkingTo && (
        <div className="overlay" onClick={() => (isTouch ? setTouch(true) : lockRef.current?.())}>
          <div className="card">
            {here.name === 'island' ? (
              <>
                <div className="kicker">Through the portal</div>
                <h1>Ryan Jr. Island</h1>
                <p className="sub">Beaches, a tiki party, the Clone-O-Matic and a whole lot of Ryan Jr. Stay out of the water (or don&apos;t).</p>
              </>
            ) : (
              <>
                <div className="kicker">Yale SOM · Evans Hall</div>
                <h1>Floor 2</h1>
                <p className="sub">Classroom drums, the cloister, Ross Library, the Beinecke Terrace Room, and the courtyard. Find the portal in room 2220!</p>
              </>
            )}
            <button className="go">{isTouch ? 'Tap to walk in' : 'Click to walk in'}</button>
            {!isTouch && (
              <button
                className="go alt"
                onClick={(e) => {
                  e.stopPropagation()
                  setTouch(true)
                }}
              >
                Use on-screen joystick
              </button>
            )}
            {isTouch ? (
              <div className="keys">
                <span><b>Left thumb</b> joystick to walk (push all the way to hurry)</span>
                <span><b>Right thumb</b> drag to look</span>
              </div>
            ) : (
              <div className="keys">
                <span><b>W A S D</b> walk</span>
                <span><b>Mouse</b> look</span>
                <span><b>Shift</b> sprint</span>
                <span><b>Space</b> jump</span>
                <span><b>C</b> crouch</span>
                <span><b>M</b> map</span>
                <span><b>Esc</b> pause</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
