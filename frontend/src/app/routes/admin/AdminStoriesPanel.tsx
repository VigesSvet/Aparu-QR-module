import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/AuthContext'
import { useNavigate } from 'react-router-dom'
import { stories as storiesApi } from '@/lib/services/api'
import type { StoryOut } from '@/lib/services/api'
import QRCode from 'qrcode'
import { getQRBaseUrl } from '@/lib/qrDomain'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const PIXEL = 8
const PADDING = 3
const RADIUS = PIXEL * 0.45

async function drawStoriesQR(canvas: HTMLCanvasElement): Promise<void> {
  const url = `${getQRBaseUrl()}/storis`
  const qrData = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const moduleCount = qrData.modules.size
  const modules = qrData.modules.data
  const TOTAL = (moduleCount + PADDING * 2) * PIXEL

  canvas.width = TOTAL
  canvas.height = TOTAL

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, TOTAL, TOTAL)

  const logoModules = Math.round(moduleCount * 0.24)
  const logoOffset = Math.floor((moduleCount - logoModules) / 2)
  const logoEnd = logoOffset + logoModules

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

  await new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const inset = PIXEL * 0.5
      ctx.drawImage(img, logoX + inset, logoY + inset, logoPx - inset * 2, logoPx - inset * 2)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = '/aparu-logo.png'
  })
}

export function AdminStoriesPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [storyList, setStoryList] = useState<StoryOut[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState(() => getQRBaseUrl())

  function loadStories() {
    return storiesApi.list().then(setStoryList).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/admin/login'); return }
    loadStories()
  }, [user, navigate])

  useEffect(() => {
    setBaseUrl(getQRBaseUrl())
    if (qrCanvasRef.current) {
      drawStoriesQR(qrCanvasRef.current)
    }
  }, [])

  function downloadQR() {
    const canvas = qrCanvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'qr-storis.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await storiesApi.upload(file)
      await loadStories()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить эту сторис?')) return
    await storiesApi.delete(id)
    setStoryList((prev) => prev.filter((s) => s.id !== id))
  }

  async function moveStory(index: number, direction: 'up' | 'down') {
    const newList = [...storyList]
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= newList.length) return
    ;[newList[index], newList[swapIdx]] = [newList[swapIdx], newList[index]]

    const reordered = newList.map((s, i) => ({ ...s, sort_order: i }))
    setStoryList(reordered)

    await storiesApi.reorder(reordered.map((s) => ({ id: s.id, sort_order: s.sort_order })))
  }

  return (
    <div className="flex flex-col flex-1 p-8 overflow-y-auto gap-8">
      <h1 className="text-xl font-bold text-text-primary">Сторисы</h1>

      {/* ── QR Generator ─────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <p className="text-sm font-semibold text-text-primary mb-1">QR-код для сторисов</p>
        <p className="text-xs text-text-muted mb-5">Ведёт на страницу <span className="font-mono">/storis</span> — покажите его пользователям для запуска онбординга</p>

        <div className="flex items-start gap-6">
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 shrink-0">
            <canvas ref={qrCanvasRef} className="block" style={{ width: 160, height: 160, imageRendering: 'pixelated' }} />
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs text-text-muted">
              URL: <span className="font-mono text-text-primary">{baseUrl}/storis</span>
            </p>
            <button
              onClick={downloadQR}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-medium hover:bg-brand-orange/90 transition-colors w-fit"
            >
              <DownloadIcon />
              Скачать PNG
            </button>
          </div>
        </div>
      </section>

      {/* ── Stories Editor ────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-semibold text-text-primary">Редактор сторисов</p>
            <p className="text-xs text-text-muted mt-0.5">Загруженные изображения показываются на странице /storis в указанном порядке</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-orange text-white text-sm font-medium hover:bg-brand-orange/90 disabled:opacity-50 transition-colors shrink-0"
          >
            {uploading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadIcon />
            )}
            Загрузить сторис
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleUpload}
          />
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : storyList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <p className="text-sm text-text-muted">Сторисов пока нет</p>
            <p className="text-xs text-text-muted">Загрузите первое изображение, чтобы начать</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="grid grid-cols-[40px_1fr_80px_80px] gap-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <span>#</span>
              <span>Превью</span>
              <span className="text-center">Порядок</span>
              <span></span>
            </div>

            {storyList.map((story, idx) => (
              <div
                key={story.id}
                className="grid grid-cols-[40px_1fr_80px_80px] gap-3 items-center px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                {/* Index */}
                <span className="text-sm font-medium text-text-muted">{idx + 1}</span>

                {/* Preview */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={`${API_BASE}/uploads/stories/${story.filename}`}
                    alt={`Story ${story.id}`}
                    className="w-14 h-10 object-cover rounded-md border border-gray-100 shrink-0"
                  />
                  <span className="text-xs text-text-muted truncate font-mono">{story.filename}</span>
                </div>

                {/* Reorder buttons */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    disabled={idx === 0}
                    onClick={() => moveStory(idx, 'up')}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    title="Выше"
                  >
                    <ChevronUpIcon />
                  </button>
                  <button
                    disabled={idx === storyList.length - 1}
                    onClick={() => moveStory(idx, 'down')}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                    title="Ниже"
                  >
                    <ChevronDownIcon />
                  </button>
                </div>

                {/* Delete */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleDelete(story.id)}
                    className="p-1.5 rounded hover:bg-red-50 hover:text-red-500 text-text-muted transition-colors"
                    title="Удалить"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}

            {/* Final "download app" screen hint */}
            <div className="grid grid-cols-[40px_1fr_80px_80px] gap-3 items-center px-3 py-2 rounded-lg border border-dashed border-gray-200 opacity-50">
              <span className="text-sm font-medium text-text-muted">{storyList.length + 1}</span>
              <div className="flex items-center gap-3">
                <div className="w-14 h-10 rounded-md bg-[#FE6601] flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-bold">APP</span>
                </div>
                <span className="text-xs text-text-muted">Экран скачивания приложения (фиксированный)</span>
              </div>
              <div />
              <div />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v7M4.5 6.5L7 9l2.5-2.5M2 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 9V2M4.5 4.5L7 2l2.5 2.5M2 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 9l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
