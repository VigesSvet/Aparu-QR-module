import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 360
const H = 480
const GRAVITY = 0.52
const JUMP_FORCE = -8.0
const SCROLL_SPEED = 4.2
const GAP_SIZE = 138
const BUILDING_W = 58
const SPAWN_INTERVAL = 130  // frames
const ROAD_H = 56
const PLAY_H = H - ROAD_H   // 424 — the vertical play area
const CAR_X = 72
const CAR_W = 52
const CAR_H = 28
const DEPTH = 12            // 3-D isometric depth

// ─── Types ────────────────────────────────────────────────────────────────────
interface WindowSpec { x: number; y: number; lit: boolean }

interface Building {
  x: number
  gapTop: number    // y-coord where the gap starts (top of bottom pipe)
  passed: boolean
  topWins: WindowSpec[]
  botWins: WindowSpec[]
}

interface GState {
  carY: number
  carVY: number
  buildings: Building[]
  score: number
  phase: 'idle' | 'playing' | 'dead'
  spawnAccum: number   // accumulated "virtual 60fps frames" for spawn timing
  roadOffset: number
  lastTime: number     // timestamp of previous rAF call
}

// ─── Window generation ────────────────────────────────────────────────────────
function genWindows(bx: number, y: number, h: number, fromTop: boolean): WindowSpec[] {
  if (h < 24) return []
  const rows = Math.min(Math.floor((h - 14) / 26), 6)
  const cols = 2
  const wins: WindowSpec[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = bx + 7 + c * 24
      const wy = fromTop
        ? y + 10 + r * 26
        : y + 10 + r * 26
      if (wy + 9 < y + h) {
        wins.push({ x: wx - bx, y: wy - y, lit: Math.random() > 0.38 })
      }
    }
  }
  return wins
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────
function draw3DBuilding(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fromTop: boolean,
  wins: WindowSpec[],
) {
  if (h <= 0) return

  // Front face
  ctx.fillStyle = '#9CA3AF'
  ctx.fillRect(x, y, w, h)

  // Roof / floor 3-D face
  if (fromTop) {
    // Bottom face of ceiling block (faces downward)
    ctx.fillStyle = '#6B7280'
    ctx.beginPath()
    ctx.moveTo(x,       y + h)
    ctx.lineTo(x + DEPTH, y + h - DEPTH)
    ctx.lineTo(x + w + DEPTH, y + h - DEPTH)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
    ctx.fill()
  } else {
    // Top face of floor block (faces upward / toward viewer)
    ctx.fillStyle = '#D1D5DB'
    ctx.beginPath()
    ctx.moveTo(x,       y)
    ctx.lineTo(x + DEPTH, y - DEPTH)
    ctx.lineTo(x + w + DEPTH, y - DEPTH)
    ctx.lineTo(x + w, y)
    ctx.closePath()
    ctx.fill()
  }

  // Right side face
  ctx.fillStyle = '#6B7280'
  ctx.beginPath()
  ctx.moveTo(x + w,       y)
  ctx.lineTo(x + w + DEPTH, y - DEPTH)
  ctx.lineTo(x + w + DEPTH, y + h - DEPTH)
  ctx.lineTo(x + w,       y + h)
  ctx.closePath()
  ctx.fill()

  // Windows
  wins.forEach(win => {
    ctx.fillStyle = win.lit
      ? 'rgba(255, 240, 100, 0.75)'
      : 'rgba(90, 110, 140, 0.45)'
    ctx.fillRect(x + win.x, y + win.y, 12, 9)
  })

  // Edge outline (subtle)
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building) {
  // Top block (hangs from ceiling)
  draw3DBuilding(ctx, b.x, 0,            BUILDING_W, b.gapTop,                  true,  b.topWins)
  // Bottom block (rises from play-floor)
  draw3DBuilding(ctx, b.x, b.gapTop + GAP_SIZE, BUILDING_W, PLAY_H - b.gapTop - GAP_SIZE, false, b.botWins)
}

function drawCar(ctx: CanvasRenderingContext2D, y: number) {
  const x = CAR_X
  const w = CAR_W
  const h = CAR_H
  const bodyH = Math.round(h * 0.62)
  const cabH  = Math.round(h * 0.52)
  const cabX  = x + Math.round(w * 0.18)
  const cabW  = Math.round(w * 0.64)
  const wheelY = y + bodyH + 4
  const wheelR = 7

  // Body
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.roundRect(x, y + cabH - 4, w, bodyH + 2, 5)
  ctx.fill()

  // Cabin
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.roundRect(cabX, y, cabW, cabH, [5, 5, 0, 0])
  ctx.fill()

  // Windshield (front, right side in canvas)
  ctx.fillStyle = 'rgba(252, 101, 0, 0.45)'
  ctx.beginPath()
  ctx.roundRect(cabX + cabW * 0.52, y + 3, cabW * 0.44, cabH - 4, [2, 2, 0, 0])
  ctx.fill()

  // Rear window
  ctx.fillStyle = 'rgba(252, 101, 0, 0.45)'
  ctx.beginPath()
  ctx.roundRect(cabX + 2, y + 3, cabW * 0.44, cabH - 4, [2, 2, 0, 0])
  ctx.fill()

  // Door divider
  ctx.strokeStyle = 'rgba(200,200,200,0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + w * 0.5, y + cabH - 4)
  ctx.lineTo(x + w * 0.5, y + cabH + bodyH - 2)
  ctx.stroke()

  // Left wheel (rear)
  const wx1 = x + Math.round(w * 0.2)
  ctx.fillStyle = '#E05600'; ctx.beginPath(); ctx.arc(wx1, wheelY, wheelR, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#C04800'; ctx.beginPath(); ctx.arc(wx1, wheelY, wheelR - 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(wx1, wheelY, 2.5, 0, Math.PI * 2); ctx.fill()

  // Right wheel (front)
  const wx2 = x + Math.round(w * 0.8)
  ctx.fillStyle = '#E05600'; ctx.beginPath(); ctx.arc(wx2, wheelY, wheelR, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#C04800'; ctx.beginPath(); ctx.arc(wx2, wheelY, wheelR - 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(wx2, wheelY, 2.5, 0, Math.PI * 2); ctx.fill()

  // Headlight
  ctx.fillStyle = 'rgba(255,255,200,0.9)'
  ctx.beginPath()
  ctx.roundRect(x + w - 4, y + cabH, 4, bodyH * 0.55, 2)
  ctx.fill()

  // Tail light
  ctx.fillStyle = 'rgba(255,80,80,0.6)'
  ctx.beginPath()
  ctx.roundRect(x, y + cabH, 4, bodyH * 0.55, 2)
  ctx.fill()
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FlappyCarGame({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  const stateRef = useRef<GState>({
    carY: PLAY_H / 2 - CAR_H / 2,
    carVY: 0,
    buildings: [],
    score: 0,
    phase: 'idle',
    spawnAccum: 0,
    roadOffset: 0,
    lastTime: 0,
  })

  const [uiPhase, setUiPhase] = useState<GState['phase']>('idle')
  const [score,   setScore]   = useState(0)

  // ── spawn building ──────────────────────────────────────────────────────────
  function spawnBuilding(): Building {
    const minGap = 50
    const maxGap = PLAY_H - GAP_SIZE - 50
    const gapTop = Math.random() * (maxGap - minGap) + minGap
    return {
      x: W + 20,
      gapTop,
      passed: false,
      topWins: genWindows(W + 20, 0,            gapTop,                           true),
      botWins: genWindows(W + 20, gapTop + GAP_SIZE, PLAY_H - gapTop - GAP_SIZE,  false),
    }
  }

  // ── main tick ───────────────────────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = stateRef.current

    // dt normalised to 1.0 at 60 fps; capped at 3 to avoid huge jumps after tab switch
    const dt = s.lastTime === 0 ? 1 : Math.min((timestamp - s.lastTime) / (1000 / 60), 3)
    s.lastTime = timestamp

    ctx.clearRect(0, 0, W, H)

    // --- Sky gradient ---
    const sky = ctx.createLinearGradient(0, 0, 0, PLAY_H)
    sky.addColorStop(0, '#93C5FD')
    sky.addColorStop(1, '#BFDBFE')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, PLAY_H)

    // --- Road ---
    ctx.fillStyle = '#374151'
    ctx.fillRect(0, PLAY_H, W, ROAD_H)

    // Road center line (animated dashes)
    s.roadOffset = (s.roadOffset - (s.phase === 'playing' ? SCROLL_SPEED * dt : 0) + 50) % 50
    ctx.strokeStyle = '#F59E0B'
    ctx.lineWidth = 2.5
    ctx.setLineDash([28, 22])
    ctx.lineDashOffset = -s.roadOffset
    ctx.beginPath()
    ctx.moveTo(0, PLAY_H + ROAD_H / 2)
    ctx.lineTo(W, PLAY_H + ROAD_H / 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Kerb stripe
    ctx.fillStyle = '#4B5563'
    ctx.fillRect(0, PLAY_H, W, 4)

    // --- Game logic (only in 'playing' phase) ---
    if (s.phase === 'playing') {
      s.spawnAccum += dt

      // Physics
      s.carVY += GRAVITY * dt
      s.carY  += s.carVY * dt

      // Out of bounds?
      if (s.carY > PLAY_H - 2) {
        s.carY  = PLAY_H - 2
        s.carVY = 0
        die(s)
      } else if (s.carY < -CAR_H) {
        s.carY  = -CAR_H
        s.carVY = 0
        die(s)
      }

      // Spawn
      if (s.spawnAccum >= SPAWN_INTERVAL) {
        s.spawnAccum -= SPAWN_INTERVAL
        s.buildings.push(spawnBuilding())
      }

      // Move & score & collide
      for (const b of s.buildings) {
        b.x -= SCROLL_SPEED * dt

        // Score
        if (!b.passed && b.x + BUILDING_W < CAR_X) {
          b.passed = true
          s.score++
          setScore(s.score)
        }

        // Collision (with small forgiveness margin)
        const margin = 4
        const cl = CAR_X + margin
        const cr = CAR_X + CAR_W - margin
        const ct = s.carY + margin
        const cb = s.carY + CAR_H - margin + 8  // +8: wheel protrusion

        const bl = b.x
        const br = b.x + BUILDING_W

        if (cr > bl && cl < br) {
          if (ct < b.gapTop || cb > b.gapTop + GAP_SIZE) {
            die(s)
          }
        }
      }

      // Prune off-screen
      s.buildings = s.buildings.filter(b => b.x > -BUILDING_W - DEPTH - 4)
    }

    // --- Draw buildings ---
    s.buildings.forEach(b => drawBuilding(ctx, b))

    // --- Draw car (rotated with velocity) ---
    ctx.save()
    const cx = CAR_X + CAR_W / 2
    const cy = s.carY + CAR_H / 2
    ctx.translate(cx, cy)
    const angle = Math.max(-0.35, Math.min(0.45, s.carVY * 0.048))
    ctx.rotate(angle)
    ctx.translate(-cx, -cy)
    drawCar(ctx, s.carY)
    ctx.restore()

    // --- Idle overlay ---
    if (s.phase === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'white'
      ctx.font = 'bold 20px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Нажми, чтобы начать!', W / 2, H / 2 - 14)
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.fillText('Пролетай между зданиями', W / 2, H / 2 + 16)
    }

    if (s.phase !== 'dead') {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function die(s: GState) {
    s.phase = 'dead'
    setUiPhase('dead')
    setScore(s.score)
  }

  // ── jump ────────────────────────────────────────────────────────────────────
  const handleJump = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const s = stateRef.current
    if (s.phase === 'idle') {
      s.phase = 'playing'
      setUiPhase('playing')
      s.carVY = JUMP_FORCE
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick)
    } else if (s.phase === 'playing') {
      s.carVY = JUMP_FORCE
    }
  }, [tick])

  // ── start / cleanup ─────────────────────────────────────────────────────────
  useEffect(() => {
    reset()
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    stateRef.current = {
      carY: PLAY_H / 2 - CAR_H / 2,
      carVY: 0,
      buildings: [],
      score: 0,
      phase: 'idle',
      spawnAccum: 0,
      roadOffset: 0,
      lastTime: 0,
    }
    setUiPhase('idle')
    setScore(0)
    rafRef.current = requestAnimationFrame(tick)
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm flex items-end justify-center">
      <div className="relative w-full max-w-[480px] bg-white rounded-t-[28px] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-bold text-brand-orange uppercase tracking-widest">Бонусная программа</p>
            <h2 className="text-[17px] font-bold text-text-primary leading-tight">Авто-прыжки</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right min-w-[44px]">
              <p className="text-[10px] text-text-muted uppercase tracking-wide">Очки</p>
              <p className="text-[24px] font-black text-brand-orange leading-none">{score}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-text-muted text-[15px] active:bg-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="select-none"
          onPointerDown={handleJump}
          style={{ cursor: 'pointer' }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block w-full"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Game-over overlay */}
        {uiPhase === 'dead' && (
          <div className="absolute inset-0 flex items-center justify-center px-5"
               style={{ background: 'rgba(0,0,0,0.52)' }}>
            <div className="w-full rounded-[24px] bg-white px-6 py-7 text-center shadow-2xl">
              <p className="text-[30px] leading-none mb-1">🏁</p>
              <p className="text-[20px] font-black text-text-primary mb-0.5">Игра окончена!</p>
              <p className="text-[15px] text-text-muted mb-6">
                Ваш результат: <span className="font-bold text-text-primary">{score}</span> очков
              </p>
              <button
                type="button"
                onClick={reset}
                className="w-full h-12 rounded-full bg-brand-orange text-white font-bold text-[15px] mb-2 active:opacity-80 transition-opacity"
              >
                Играть снова
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 text-text-muted text-[14px]"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
