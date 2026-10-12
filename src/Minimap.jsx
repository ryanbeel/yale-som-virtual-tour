import { useEffect, useRef } from 'react'
import { BEIN, BOUNDS, COURTYARD, DRUMS, LIBRARY, MEETING, STAIRS, arc } from './layout.js'
import { DAN } from './HandsomeDan.jsx'
import * as I from './island.js'
import { catCount, catXZ } from './IslandCats.jsx'
import { sharkPos } from './Shark.jsx'

const PAD = 3
const X0 = BOUNDS.xMin - PAD
const X1 = BOUNDS.xMax + BEIN.terrace + PAD
const Z0 = BOUNDS.zMin - PAD
const Z1 = BOUNDS.zMax + PAD
const S = 2.6 // px per meter
const Wpx = Math.round((X1 - X0) * S)
const Hpx = Math.round((Z1 - Z0) * S)
const px = (x, z) => [(x - X0) * S, (z - Z0) * S]

function drawStatic(g) {
  g.fillStyle = '#0b0b0d'
  g.fillRect(0, 0, Wpx, Hpx)
  const path = (pts, close = true) => {
    g.beginPath()
    pts.forEach((p, i) => (i ? g.lineTo(...px(...p)) : g.moveTo(...px(...p))))
    if (close) g.closePath()
  }
  // building
  g.fillStyle = '#1a1a1f'
  g.strokeStyle = '#ff4fa3'
  g.lineWidth = 1.5
  path([[BOUNDS.xMin, BOUNDS.zMin], [BOUNDS.xMax, BOUNDS.zMin], [BOUNDS.xMax, BOUNDS.zMax], [BOUNDS.xMin, BOUNDS.zMax]])
  g.fill()
  g.stroke()
  // terrace + Beinecke
  path(arc(BEIN.c, BEIN.terrace, BEIN.terrace, 0, Math.PI, 30))
  g.fillStyle = '#2a2622'
  g.fill()
  path(arc(BEIN.c, BEIN.r, BEIN.r, 0, Math.PI, 30))
  g.fillStyle = '#3a2a33'
  g.fill()
  g.stroke()
  // courtyard
  path(COURTYARD)
  g.fillStyle = '#18321a'
  g.fill()
  g.strokeStyle = '#ffb3d9'
  g.stroke()
  // drums
  g.strokeStyle = '#ff4fa3'
  for (const d of DRUMS) {
    path(arc(d.c, d.rx, d.rz, 0, Math.PI * 2, 48))
    g.fillStyle = '#16244f'
    g.fill()
    for (const [a0, a1] of d.arcs) {
      path(arc(d.c, d.rx, d.rz, a0, a1, 32), false)
      g.stroke()
    }
  }
  // library, meeting rooms, stairs
  g.fillStyle = '#3b2a1c'
  g.fillRect(...px(LIBRARY.x0, LIBRARY.z0), (LIBRARY.x1 - LIBRARY.x0) * S, (LIBRARY.z1 - LIBRARY.z0) * S)
  g.fillStyle = '#26262e'
  for (const m of MEETING) g.fillRect(...px(m.x - 2.6, m.z - 2.8), 5.2 * S, 5.6 * S)
  g.fillStyle = '#ff4fa3'
  g.font = 'bold 10px system-ui, sans-serif'
  for (const s of STAIRS) {
    g.fillRect(...px(s.c[0] - s.w / 2, s.c[1] - s.d / 2), s.w * S, s.d * S)
    g.fillStyle = '#0b0b0d'
    g.fillText(s.id, ...px(s.c[0] - 0.9, s.c[1] + 1.2))
    g.fillStyle = '#ff4fa3'
  }
  g.fillStyle = '#ffd6ea'
  g.font = '9px system-ui, sans-serif'
  g.fillText('ROSS LIB', ...px(LIBRARY.x0 + 0.6, 1))
  g.fillText('BEINECKE', ...px(BEIN.c[0] + 2, 1))
  g.fillText('COURTYARD', ...px(-7, 1))
  g.fillText('N ↑', ...px(BOUNDS.xMax + 6, BOUNDS.zMin + 2))
  for (const d of DRUMS) g.fillText(d.id, ...px(d.c[0] - 2.4, d.c[1] + 1))
  // the portal to Ryan Jr. Island, at the back of room 2220
  const [qx, qy] = px(0, -37.3)
  g.fillStyle = '#00c2c7'
  g.shadowColor = '#00c2c7'
  g.shadowBlur = 8
  g.beginPath()
  g.arc(qx, qy, 4.5, 0, Math.PI * 2)
  g.fill()
  g.shadowBlur = 0
}

// ---------- Ryan Jr. Island
const IS = 1.55 // px per meter
const IR = 80 // meters shown from the center
const IW = Math.round(IR * 2 * IS)
const ipx = (x, z) => [(x + IR) * IS, (z + IR) * IS]

function drawIsland(g) {
  g.fillStyle = '#0d5f78'
  g.fillRect(0, 0, IW, IW)
  const ring = (rOf, close = true) => {
    g.beginPath()
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2
      const r = rOf(a)
      const [x, y] = ipx(Math.cos(a) * r, Math.sin(a) * r)
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    if (close) g.closePath()
  }
  ring((a) => I.SHORE(a) + 9)
  g.fillStyle = '#19b5c9'
  g.fill()
  ring((a) => I.SHORE(a))
  g.fillStyle = '#f2e2b4'
  g.fill()
  g.strokeStyle = '#ff4fa3'
  g.lineWidth = 1.5
  g.stroke()
  ring((a) => I.SHORE(a) - 11)
  g.fillStyle = '#4f9e42'
  g.fill()
  // crater
  const [cx, cy] = ipx(I.CRATER.x, I.CRATER.z)
  g.fillStyle = '#8f7a52'
  g.beginPath()
  g.arc(cx, cy, (I.CRATER.r + 5) * IS, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#5fae4a'
  g.beginPath()
  g.arc(cx, cy, (I.CRATER.r - 3) * IS, 0, Math.PI * 2)
  g.fill()
  // plaza, huts, stage, bar
  const [plx, ply] = ipx(I.PLAZA.x, I.PLAZA.z)
  g.fillStyle = '#ffe9b8'
  g.beginPath()
  g.arc(plx, ply, I.PLAZA.r * IS, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#c49a48'
  for (const [x, z] of I.HUTS) {
    const [hx, hy] = ipx(x, z)
    g.fillRect(hx - 3, hy - 3, 6, 6)
  }
  const [sx, sy] = ipx(I.STAGE.x, I.STAGE.z)
  g.fillStyle = '#2a1d4e'
  g.fillRect(sx - (I.STAGE.d / 2) * IS, sy - (I.STAGE.w / 2) * IS, I.STAGE.d * IS, I.STAGE.w * IS)
  const [bx, by] = ipx(I.BAR.x, I.BAR.z)
  g.fillStyle = '#b8935a'
  g.fillRect(bx - 4, by - 4, 8, 8)
  // sign + machine
  const [gx, gy] = ipx(I.SIGN.x, I.SIGN.z)
  g.fillStyle = '#ffd23f'
  g.fillRect(gx - 10, gy - 1.5, 20, 3)
  const [mx, my] = ipx(I.MACHINE.x, I.MACHINE.z)
  g.fillStyle = '#7ffcff'
  g.beginPath()
  g.arc(mx, my, 4, 0, Math.PI * 2)
  g.fill()
  // the DO NOT PRESS button
  const [nx, ny] = ipx(I.BUTTON.x, I.BUTTON.z)
  g.fillStyle = '#e8222e'
  g.beginPath()
  g.arc(nx, ny, 4, 0, Math.PI * 2)
  g.fill()
  // portal home
  const [ox, oy] = ipx(I.RETURN_PORTAL.x, I.RETURN_PORTAL.z)
  g.fillStyle = '#ff4fa3'
  g.beginPath()
  g.arc(ox, oy, 4, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = 'bold 9px system-ui, sans-serif'
  g.fillText('CRATER', cx - 17, cy + 3)
  g.fillText('STAGE', sx - 14, sy - (I.STAGE.w / 2) * IS - 3)
  g.fillText('BAR', bx - 8, by + 14)
  g.fillText('CLONES', mx + 6, my + 3)
  g.fillText('HOME', ox + 6, oy + 3)
  g.fillStyle = '#ff6b6b'
  g.fillText('???', nx + 6, ny + 3)
  g.fillText('N ↑', IW - 22, 12)
}

function IslandMap({ drawRef }) {
  const ref = useRef()
  useEffect(() => {
    const bg = document.createElement('canvas')
    bg.width = IW
    bg.height = IW
    drawIsland(bg.getContext('2d'))
    const g = ref.current.getContext('2d')
    drawRef.current = (x, z, fx, fz) => {
      g.drawImage(bg, 0, 0)
      g.fillStyle = '#ffffff'
      for (let i = 0; i < catCount.n; i++) {
        const [cx, cy] = ipx(catXZ[i * 2], catXZ[i * 2 + 1])
        g.fillRect(cx - 1, cy - 1, 2, 2)
      }
      const [kx, ky] = ipx(sharkPos.x, sharkPos.z)
      g.fillStyle = '#e8222e'
      g.font = 'bold 12px system-ui, sans-serif'
      g.fillText('▲', kx - 5, ky + 4)
      const [cx, cy] = ipx(x, z)
      g.fillStyle = 'rgba(255,79,163,0.35)'
      g.beginPath()
      g.moveTo(cx, cy)
      const a = Math.atan2(fz, fx)
      g.arc(cx, cy, 22, a - 0.5, a + 0.5)
      g.closePath()
      g.fill()
      g.fillStyle = '#ff4fa3'
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(cx, cy, 4.5, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }
  }, [drawRef])
  return <canvas ref={ref} className="minimap" width={IW} height={IW} />
}

export default function Minimap({ drawRef, world = 'evans' }) {
  return world === 'island' ? <IslandMap drawRef={drawRef} /> : <EvansMap drawRef={drawRef} />
}

function EvansMap({ drawRef }) {
  const ref = useRef()
  useEffect(() => {
    const bg = document.createElement('canvas')
    bg.width = Wpx
    bg.height = Hpx
    drawStatic(bg.getContext('2d'))
    const g = ref.current.getContext('2d')
    drawRef.current = (x, z, fx, fz) => {
      g.drawImage(bg, 0, 0)
      // Handsome Dan
      const [dx, dy] = px(DAN.x, DAN.z)
      g.fillStyle = '#4a90ff'
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(dx, dy, 4, 0, Math.PI * 2)
      g.fill()
      g.stroke()
      const [cx, cy] = px(x, z)
      g.fillStyle = 'rgba(255,79,163,0.25)'
      g.beginPath()
      g.moveTo(cx, cy)
      const a = Math.atan2(fz, fx)
      g.arc(cx, cy, 26, a - 0.5, a + 0.5)
      g.closePath()
      g.fill()
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(cx, cy, 4, 0, Math.PI * 2)
      g.fill()
    }
  }, [drawRef])
  return <canvas ref={ref} className="minimap" width={Wpx} height={Hpx} />
}

