import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import QRCode from 'qrcode'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations, maps } from '@/lib/services/api'
import type { LocationOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { getQRBaseUrl } from '@/lib/qrDomain'

const DEFAULT_CENTER: [number, number] = [82.6, 49.9]
const DEFAULT_ZOOM = 12

export function AdminLocationEditor() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [longitude, setLongitude] = useState('')
  const [latitude, setLatitude] = useState('')
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [savedLocation, setSavedLocation] = useState<LocationOut | null>(null)

  // QR state
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const [qrSide, setQrSide] = useState('10')
  const [qrGenerated, setQrGenerated] = useState(false)

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/admin/login'); return }
    if (isEdit) {
      locations.get(parseInt(id!)).then((loc) => {
        setName(loc.name ?? '')
        setDescription(loc.address ?? '')
        setLongitude(loc.longitude.toString())
        setLatitude(loc.latitude.toString())
        setSavedLocation(loc)
      })
    }
  }, [user, navigate, isEdit, id])

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: '/api/v1/maps/style',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      transformRequest: (url) => {
        return { url: url.replace(/^https?:\/\/testtaxi3\.aparu\.kz/, '/map-proxy') }
      },
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat
      setLongitude(lng.toFixed(6))
      setLatitude(lat.toFixed(6))
      placeMarker(map, [lng, lat])
      setGeocoding(true)
      maps.reverseGeocode(lat, lng).then((res) => {
        setName(res.placeName ?? '')
      }).catch(() => {
        setName('')
      }).finally(() => {
        setGeocoding(false)
      })
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Move marker when editing existing location
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isEdit) return
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (!isNaN(lat) && !isNaN(lng)) {
      const fly = () => {
        placeMarker(map, [lng, lat])
        map.flyTo({ center: [lng, lat], zoom: 14 })
      }
      if (map.loaded()) fly()
      else map.once('load', fly)
    }
  }, [isEdit, latitude, longitude])

  function placeMarker(map: maplibregl.Map, coords: [number, number]) {
    if (markerRef.current) {
      markerRef.current.setLngLat(coords)
    } else {
      markerRef.current = new maplibregl.Marker({ color: '#FC6500' })
        .setLngLat(coords)
        .addTo(map)
    }
  }

  // Sync marker + reverse geocode when user types coordinates manually
  const syncMarkerFromFields = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      placeMarker(map, [lng, lat])
      setGeocoding(true)
      maps.reverseGeocode(lat, lng).then((res) => {
        setName(res.placeName ?? '')
      }).catch(() => {
        setName('')
      }).finally(() => {
        setGeocoding(false)
      })
    }
  }, [latitude, longitude])

  // Generate QR on canvas with rounded modules and centered logo
  async function generateQR() {
    if (!savedLocation || !qrCanvasRef.current) return
    const url = `${getQRBaseUrl()}/scan/${savedLocation.id}`

    // High error correction — allows logo to cover up to ~30% of QR
    const qrData = QRCode.create(url, { errorCorrectionLevel: 'H' })
    const moduleCount = qrData.modules.size
    const modules = qrData.modules.data

    const PIXEL = 8          // px per QR module
    const PADDING = 3        // quiet zone in modules
    const RADIUS = PIXEL * 0.45  // rounding radius per dot
    const TOTAL = (moduleCount + PADDING * 2) * PIXEL

    // Logo covers central ~24% of QR area (safe with H level)
    const logoModules = Math.round(moduleCount * 0.24)
    const logoOffset = Math.floor((moduleCount - logoModules) / 2)
    const logoEnd = logoOffset + logoModules

    const canvas = qrCanvasRef.current
    canvas.width = TOTAL
    canvas.height = TOTAL

    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, TOTAL, TOTAL)

    ctx.fillStyle = '#2A3037'
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!modules[row * moduleCount + col]) continue
        // Skip center region — will be covered by logo
        if (row >= logoOffset && row < logoEnd && col >= logoOffset && col < logoEnd) continue

        const x = (col + PADDING) * PIXEL
        const y = (row + PADDING) * PIXEL
        ctx.beginPath()
        ctx.roundRect(x, y, PIXEL, PIXEL, RADIUS)
        ctx.fill()
      }
    }

    // White background exactly covering the skipped module zone (no overflow into adjacent modules)
    const logoPx = logoModules * PIXEL
    const logoX = (logoOffset + PADDING) * PIXEL
    const logoY = (logoOffset + PADDING) * PIXEL
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.roundRect(logoX, logoY, logoPx, logoPx, PIXEL)
    ctx.fill()

    // Logo drawn with a small inset so it doesn't touch the QR border
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

    setQrGenerated(true)
  }

  useEffect(() => {
    if (savedLocation) generateQR()
  }, [savedLocation])

  async function handleSave() {
    if (!name || !latitude || !longitude) return
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (isNaN(lat) || isNaN(lng)) return
    setSaving(true)
    try {
      let loc: LocationOut
      if (isEdit) {
        loc = await locations.update(parseInt(id!), { name, address: description, latitude: lat, longitude: lng })
      } else {
        loc = await locations.create({ name, address: description, latitude: lat, longitude: lng })
        navigate(`/admin/locations/${loc.id}/edit`, { replace: true })
      }
      setSavedLocation(loc)
    } finally {
      setSaving(false)
    }
  }

  function handleDownloadPng() {
    const canvas = qrCanvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-${savedLocation?.name ?? 'location'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handleDownloadPngWithLabel() {
    const qrCanvas = qrCanvasRef.current
    if (!qrCanvas) return
    const label = savedLocation?.name ?? ''
    const fontSize = Math.round(qrCanvas.width * 0.055)
    const gap = Math.round(qrCanvas.width * 0.04)
    const labelH = label ? fontSize + gap * 2 : 0

    const off = document.createElement('canvas')
    off.width = qrCanvas.width
    off.height = qrCanvas.height + labelH
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, off.width, off.height)
    ctx.drawImage(qrCanvas, 0, 0)
    if (label) {
      ctx.fillStyle = '#2A3037'
      ctx.font = `600 ${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, off.width / 2, qrCanvas.height + gap + fontSize / 2)
    }

    const link = document.createElement('a')
    link.download = `qr-${label || 'location'}-с-названием.png`
    link.href = off.toDataURL('image/png')
    link.click()
  }

  function openPrintWindow(withLabel: boolean) {
    const canvas = qrCanvasRef.current
    if (!canvas) return
    const side = parseFloat(qrSide) || 10
    const dataUrl = canvas.toDataURL('image/png')
    const label = savedLocation?.name ?? ''

    const win = window.open('', '_blank')
    if (!win) return

    win.document.open()
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>QR — ${label}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
    .qr-img { width: ${side}cm; height: ${side}cm; image-rendering: pixelated; display: block; }
    .qr-label { font-size: 14pt; font-weight: 600; color: #2A3037; margin-top: 10px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <img class="qr-img" src="${dataUrl}" alt="QR" />
  ${withLabel && label ? `<p class="qr-label">${label}</p>` : ''}
  <script>
    window.addEventListener('load', function () {
      window.focus();
      window.print();
      window.close();
    });
  <\/script>
</body>
</html>`)
    win.document.close()
  }

  const qrUrl = savedLocation ? `${getQRBaseUrl()}/scan/${savedLocation.id}` : null

  return (
    <div className="flex flex-col h-screen bg-surface-base overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 h-14 bg-white border-b border-gray-100 shrink-0 shadow-sm">
        <button
          onClick={() => navigate('/admin', { state: { tab: 'locations' } })}
          className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-base font-bold text-text-primary">
          {isEdit ? 'Редактировать точку' : 'Новая QR-точка'}
        </h1>
        {savedLocation && (
          <span className="ml-auto text-xs text-text-muted">ID: {savedLocation.id}</span>
        )}
      </header>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Form + QR */}
        <div className="w-[440px] shrink-0 flex flex-col overflow-y-auto border-r border-gray-100 bg-white">
          <div className="flex flex-col gap-5 p-6">
            {/* Form fields */}
            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
                Данные точки
              </h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Название"
                  placeholder={geocoding ? 'Определяем место...' : 'ТЦ Мега, Аэропорт Усть-Каменогорск...'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={geocoding}
                />
                <Input
                  label="Описание"
                  placeholder="Главный вход, 1 этаж..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex gap-3">
                  <Input
                    label="Долгота"
                    placeholder="82.600000"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    onBlur={syncMarkerFromFields}
                  />
                  <Input
                    label="Широта"
                    placeholder="49.900000"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    onBlur={syncMarkerFromFields}
                  />
                </div>
                <p className="text-xs text-text-muted -mt-1">
                  Кликните по карте справа, чтобы задать координаты
                </p>
              </div>
            </section>

            <Button
              onClick={handleSave}
              disabled={saving || !name || !latitude || !longitude}
            >
              {saving ? 'Сохранение...' : isEdit ? 'Сохранить изменения' : 'Создать точку'}
            </Button>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* QR section */}
            <section>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
                QR-код
              </h2>

              {!savedLocation ? (
                <div className="rounded-card border border-dashed border-brand-muted bg-surface-base p-6 flex flex-col items-center gap-2 text-center">
                  <QrPlaceholderIcon />
                  <p className="text-sm text-text-muted">
                    Сохраните точку, чтобы сгенерировать QR-код
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {qrUrl && (
                    <p className="text-xs font-mono text-text-muted break-all bg-surface-base rounded-btn px-3 py-2">
                      {qrUrl}
                    </p>
                  )}

                  <div className="flex justify-center">
                    <div className="rounded-card border border-gray-100 p-3 bg-white shadow-sm inline-flex">
                      <canvas ref={qrCanvasRef} />
                    </div>
                  </div>

                  {/* Print size */}
                  <div className="flex items-end gap-3">
                    <Input
                      label="Длина стороны QR-кода (см)"
                      placeholder="10"
                      value={qrSide}
                      onChange={(e) => setQrSide(e.target.value)}
                      type="number"
                      min="2"
                      max="100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="main-stroke"
                      onClick={handleDownloadPng}
                      disabled={!qrGenerated}
                      icon={<DownloadIcon />}
                    >
                      Скачать PNG
                    </Button>
                    <Button
                      variant="main-stroke"
                      onClick={handleDownloadPngWithLabel}
                      disabled={!qrGenerated}
                      icon={<DownloadIcon />}
                    >
                      PNG + название
                    </Button>
                    <Button
                      onClick={() => openPrintWindow(false)}
                      disabled={!qrGenerated}
                      icon={<PrintIcon />}
                    >
                      Печать
                    </Button>
                    <Button
                      onClick={() => openPrintWindow(true)}
                      disabled={!qrGenerated}
                      icon={<PrintIcon />}
                    >
                      Печать + название
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* RIGHT — Map */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="absolute inset-0" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-btn px-4 py-2 text-xs text-text-muted shadow-sm pointer-events-none">
            Кликните на карту, чтобы разместить точку
          </div>
        </div>
      </div>
    </div>
  )
}

// Icons

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="1" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 7H1.5A.5.5 0 001 7.5v5a.5.5 0 00.5.5H3v-3h10v3h1.5a.5.5 0 00.5-.5v-5a.5.5 0 00-.5-.5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="3" y="10" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function QrPlaceholderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-brand-muted">
      <rect x="6" y="6" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="8" height="8" fill="currentColor" />
      <rect x="28" y="6" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="31" y="9" width="8" height="8" fill="currentColor" />
      <rect x="6" y="28" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="31" width="8" height="8" fill="currentColor" />
      <path d="M28 28h4v4h-4zM36 28h4v4h-4zM28 36h4v4h-4zM36 36h4v4h-4z" fill="currentColor" />
    </svg>
  )
}
