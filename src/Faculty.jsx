import { useMemo } from 'react'
import * as THREE from 'three'
import Professor, { PROFESSORS } from './Professor.jsx'
import Zaman, { ZAMAN } from './Zaman.jsx'
import Schott, { SCHOTT } from './Schott.jsx'
import Allison, { ALLISON } from './Allison.jsx'
import Rose, { ROSE } from './Rose.jsx'
import { DRUMS, LECTERNS } from './layout.js'

// who teaches in which classroom: Hogwarts professors (matching the slide decks), plus real SOM
// professors you can chat with (AVATARS): Zaman in 2200, where the catalog says MGT 409 meets,
// Schott teaching stats in 2210 next door, honorary professor Allison in 2400, and Rose in 2410
export const ROOM_PROFESSOR = {
  2400: 'allison', // honorary professor (with Ryan Jr. the cat)
  2410: 'rose', // guitar, grunge & horses
  2420: 'trelawney', // MGT 403 Probability Modeling & Statistics
  2430: 'slughorn', // MGT 887 Negotiations
  2200: 'zaman', // MGT 409 AI Foundations for Managers (EVANS 2200 in the catalog)
  2210: 'schott', // MGT 403 Probability Modeling & Statistics
  2220: 'moody', // MGT 800 Crisis Management in Tech
  2230: 'flitwick', // MGT 541 Corporate Finance
}

// chat-enabled professors: their 3D component + profile ({ id, name, course, greeting, thinking })
const AVATARS = {
  zaman: [Zaman, ZAMAN],
  schott: [Schott, SCHOTT],
  allison: [Allison, ALLISON],
  rose: [Rose, ROSE],
}

function plaqueTex(name) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#c9a44a'
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#2a1d0c'
  g.fillRect(8, 8, 496, 112)
  g.fillStyle = '#f3dfa8'
  g.font = 'bold 44px Georgia, serif'
  g.textAlign = 'center'
  g.fillText(`Prof. ${name.split(' ').slice(-1)[0]}`, 256, 80)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Faculty() {
  const items = useMemo(
    () =>
      DRUMS.map((d, i) => {
        const who = ROOM_PROFESSOR[d.id]
        const { fc, back, t, half, rot } = d.front
        const lec = LECTERNS[i]
        return {
          who,
          pos: [fc[0] + back[0] * 1.15 - t[0] * half * 0.3, 0, fc[1] + back[1] * 1.15 - t[1] * half * 0.3],
          rot,
          front: d.front,
          plaque: { p: [lec.x + back[0] * 0.26, 0.85, lec.z + back[1] * 0.26], rot, mat: new THREE.MeshBasicMaterial({ map: plaqueTex(AVATARS[who]?.[1].name ?? PROFESSORS[who].name) }) },
        }
      }),
    [],
  )
  return (
    <>
      {items.map((it, i) => {
        const Avatar = AVATARS[it.who]?.[0]
        return (
          <group key={i}>
            {Avatar ? (
              <Avatar position={it.pos} rotation={it.rot} front={it.front} />
            ) : (
              <Professor who={it.who} position={it.pos} rotation={it.rot} phase={i * 1.7} />
            )}
            <mesh position={it.plaque.p} rotation={[0, it.plaque.rot, 0]} material={it.plaque.mat}>
              <planeGeometry args={[0.6, 0.15]} />
            </mesh>
          </group>
        )
      })}
      {/* Hagrid keeps an eye on the Labubus in the courtyard */}
      <Professor who="hagrid" position={[-10.5, -5, -2]} rotation={Math.PI / 2} />
    </>
  )
}
