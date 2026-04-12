import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations } from '@/lib/services/api'
import type { LocationOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'
import QRCode from 'qrcode'

// --- Shared QR drawing logic ---
async function drawQROnCanvas(canvas: HTMLCanvasElement, locationId: number): Promise<void> {
  const url = `${window.location.origin}/scan/${locationId}`
  const qrData = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const moduleCount = qrData.modules.size
  const modules = qrData.modules.data

  const PIXEL = 8
  const PADDING = 3
  const RADIUS = PIXEL * 0.45
  const TOTAL = (moduleCount + PADDING * 2) * PIXEL
  const logoModules = Math.round(moduleCount * 0.24)
  const logoOffset = Math.floor((moduleCount - logoModules) / 2)
  const logoEnd = logoOffset + logoModules

  canvas.width = TOTAL
  canvas.height = TOTAL
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, TOTAL, TOTAL)

  ctx.fillStyle = '#2A3037'
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules[row * moduleCount + col]) continue
      if (row >= logoOffset && row < logoEnd && col >= logoOffset && col < logoEnd) continue
      const x = (col + PADDING) * PIXEL
      const y = (row + PADDING) * PIXEL
      ctx.beginPath()
      ctx.roundRect(x, y, PIXEL, PIXEL, RADIUS)
      ctx.fill()
    }
  }

  const logoPx = logoModules * PIXEL
  const logoX = (logoOffset + PADDING) * PIXEL
  const logoY = (logoOffset + PADDING) * PIXEL
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.roundRect(logoX, logoY, logoPx, logoPx, PIXEL)
  ctx.fill()

  const logoInset = PIXEL * 0.5
  await new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, logoX + logoInset, logoY + logoInset, logoPx - logoInset * 2, logoPx - logoInset * 2)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = '/aparu-logo.png'
  })
}

// --- QR Card (desktop grid) ---
interface QRCardProps {
  loc: LocationOut
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onQrReady: (id: number, dataUrl: string) => void
}

function QRCard({ loc, selected, onToggle, onEdit, onDelete, onQrReady }: QRCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    drawQROnCanvas(canvas, loc.id).then(() => {
      const url = canvas.toDataURL('image/png')
      setQrDataUrl(url)
      onQrReady(loc.id, url)
    })
  }, [loc.id])

  function handleDownload() {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `qr-${loc.name ?? loc.id}.png`
    link.href = qrDataUrl
    link.click()
  }

  return (
    <div
      className={`relative rounded-xl border bg-white shadow-sm transition-all group
        ${selected
          ? 'border-brand-orange ring-2 ring-brand-orange/20'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
        }`}
    >
      {/* Checkbox — top-left */}
      <button
        className="absolute top-2.5 left-2.5 z-10"
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        title={selected ? 'Снять выделение' : 'Выделить'}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
          ${selected
            ? 'bg-brand-orange border-brand-orange'
            : 'bg-white/90 border-gray-300 group-hover:border-brand-orange/60'
          }`}
        >
          {selected && <CheckIcon />}
        </div>
      </button>

      {/* Action buttons — top-right, above QR */}
      <div
        className="absolute top-2 right-2 flex gap-1 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-100 flex items-center justify-center text-text-muted hover:text-brand-orange hover:border-brand-orange transition-colors shadow-sm"
          title="Изменить"
        >
          <PencilIcon />
        </button>
        <button
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-100 flex items-center justify-center text-text-muted hover:text-brand-orange hover:border-brand-orange transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title="Скачать PNG"
        >
          <DownloadIcon />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-100 flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-300 transition-colors shadow-sm"
          title="Удалить"
        >
          <TrashIcon />
        </button>
      </div>

      {/* QR image — main content */}
      <div className="px-4 pt-11 pb-2 flex justify-center">
        <div className="w-full aspect-square max-w-[200px] flex items-center justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR ${loc.name}`}
              className="w-full h-full"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Info — bottom */}
      <div className="px-4 pb-4 pt-1">
        <p className="text-sm font-semibold text-text-primary truncate">{loc.name || '—'}</p>
        <p className="text-xs font-mono text-text-muted mt-0.5">
          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
        </p>
      </div>
    </div>
  )
}

// --- Main component ---
export function AdminLocations() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<LocationOut[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const qrDataUrlsRef = useRef<Map<number, string>>(new Map())

  function loadData() {
    locations.list().then(setList).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/admin/login'); return }
    loadData()
  }, [user, navigate])

  async function handleDelete(id: number) {
    if (!confirm('Удалить эту точку?')) return
    await locations.delete(id)
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    loadData()
  }

  async function handleBulkDelete() {
    if (!confirm(`Удалить ${selected.size} точк${selected.size === 1 ? 'у' : selected.size < 5 ? 'и' : ''}?`)) return
    await Promise.all([...selected].map((id) => locations.delete(id)))
    setSelected(new Set())
    loadData()
  }

  function handleBulkDownload() {
    for (const id of selected) {
      const dataUrl = qrDataUrlsRef.current.get(id)
      if (!dataUrl) continue
      const loc = list.find((l) => l.id === id)
      const link = document.createElement('a')
      link.download = `qr-${loc?.name ?? id}.png`
      link.href = dataUrl
      link.click()
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === list.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(list.map((l) => l.id)))
    }
  }

  const allSelected = list.length > 0 && selected.size === list.length

  return (
    <>
      {/* ── MOBILE view (hidden on md+) ── */}
      <div className="md:hidden">
        <PageShell>
          <header className="flex items-center gap-3 px-4 pt-6 pb-4">
            <button onClick={() => navigate('/admin')} className="w-8 h-8 flex items-center justify-center text-text-muted">
              <ChevronLeftIcon />
            </button>
            <h1 className="text-lg font-bold text-text-primary flex-1">QR-точки</h1>
            <button
              onClick={() => navigate('/admin/locations/new')}
              className="text-sm font-medium text-brand-orange"
            >
              + Добавить
            </button>
          </header>

          <main className="flex flex-col flex-1 px-4 gap-4 pb-8">
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center gap-4 mt-12">
                <p className="text-sm text-text-muted text-center">Нет QR-точек</p>
                <Button fullWidth={false} onClick={() => navigate('/admin/locations/new')}>
                  Создать первую точку
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((loc) => (
                  <div key={loc.id} className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center shrink-0 mt-0.5">
                          <PinIcon />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary text-sm truncate">{loc.name || '—'}</p>
                          {loc.address && (
                            <p className="text-xs text-text-muted mt-0.5 truncate">{loc.address}</p>
                          )}
                          <p className="text-xs text-text-muted mt-0.5 font-mono">
                            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <button
                          onClick={() => navigate(`/admin/locations/${loc.id}/edit`)}
                          className="text-xs text-brand-orange hover:text-orange-600 transition-colors"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </PageShell>
      </div>

      {/* ── DESKTOP view (hidden below md) ── */}
      <div className="hidden md:flex flex-col min-h-screen bg-surface-base">
        {/* Desktop header */}
        <header className="flex items-center gap-3 px-6 h-14 bg-white border-b border-gray-100 shadow-sm shrink-0">
          <button
            onClick={() => navigate('/admin')}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeftIcon />
          </button>
          <h1 className="text-base font-bold text-text-primary">QR-точки</h1>

          {list.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="ml-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              {allSelected ? 'Снять всё' : 'Выбрать все'}
            </button>
          )}

          <div className="flex-1" />

          {selected.size > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted">Выделено: {selected.size}</span>
              <button
                onClick={handleBulkDownload}
                className="flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:text-orange-600 transition-colors"
              >
                <DownloadIcon />
                Скачать ({selected.size})
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-600 transition-colors"
              >
                <TrashIcon />
                Удалить ({selected.size})
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Отменить
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/admin/locations/new')}
              className="flex items-center gap-1 text-sm font-medium text-brand-orange hover:text-orange-600 transition-colors"
            >
              <span className="text-base leading-none">+</span> Добавить
            </button>
          )}
        </header>

        {/* Desktop body */}
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-4 mt-24">
              <p className="text-sm text-text-muted">Нет QR-точек</p>
              <Button fullWidth={false} onClick={() => navigate('/admin/locations/new')}>
                Создать первую точку
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {list.map((loc) => (
                <QRCard
                  key={loc.id}
                  loc={loc}
                  selected={selected.has(loc.id)}
                  onToggle={() => toggleSelect(loc.id)}
                  onEdit={() => navigate(`/admin/locations/${loc.id}/edit`)}
                  onDelete={() => handleDelete(loc.id)}
                  onQrReady={(id, url) => { qrDataUrlsRef.current.set(id, url) }}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

// --- Icons ---

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5C5.07 1.5 3.5 3.07 3.5 5C3.5 7.5 7 12.5 7 12.5C7 12.5 10.5 7.5 10.5 5C10.5 3.07 8.93 1.5 7 1.5Z" fill="white" />
      <circle cx="7" cy="5" r="1.5" fill="#FC6500" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2.5L11.5 4.5M2 12l2.5-.5 7-7-2-2-7 7L2 12z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v7M4.5 6.5L7 9l2.5-2.5M2 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2.5h3v1M5 3.5l.5 7.5h3l.5-7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
