import { useState, useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations, tariffs as tariffsApi, orders, maps } from '@/lib/services/api'
import type { LocationOut, TariffOut, GeocodeResultItem } from '@/lib/services/api'
import { Button } from '@/components/Button'

interface Point {
  address: string
  lat: number
  lng: number
}

type ActiveField = 'A' | 'B'


export function BookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const markerARef = useRef<maplibregl.Marker | null>(null)
  const markerBRef = useRef<maplibregl.Marker | null>(null)

  // Data state
  const [dataLoading, setDataLoading] = useState(true)
  const [qrLocation, setQrLocation] = useState<LocationOut | null>(null)
  const [tariffList, setTariffList] = useState<TariffOut[]>([])
  const [selectedTariff, setSelectedTariff] = useState<number | null>(null)

  // Points
  const [pointA, setPointA] = useState<Point | null>(null)
  const [pointB, setPointB] = useState<Point | null>(null)

  // Active field (for map click target)
  const [activeField, setActiveField] = useState<ActiveField>('B')

  // Search overlay state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchField, setSearchField] = useState<ActiveField>('B')
  const [searchInput, setSearchInput] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeResultItem[]>([])
  const [searchError, setSearchError] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Sequence counter — prevents stale responses from overwriting newer results
  const searchSeqRef = useRef(0)

  // Route info
  const [routeInfo, setRouteInfo] = useState<{ distance: number; time: number } | null>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Data loading ──────────────────────────────────────

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    const locId = parseInt(sessionStorage.getItem('aparu_scan_location') ?? '1', 10)
    Promise.all([locations.get(locId), tariffsApi.list()])
      .then(async ([loc, tList]) => {
        setQrLocation(loc)
        setTariffList(tList)
        setSelectedTariff(tList[0]?.id ?? null)
        // Must set dataLoading=false before the first await so React renders the
        // map container div *before* the map-init effect runs — otherwise
        // mapContainerRef.current is null and the map never initializes.
        setDataLoading(false)
        try {
          const geo = await maps.reverseGeocode(loc.latitude, loc.longitude)
          const addr = [geo.placeName, geo.areaName].filter(Boolean).join(', ')
            || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
          setPointA({ address: addr, lat: loc.latitude, lng: loc.longitude })
        } catch {
          setPointA({ address: `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`, lat: loc.latitude, lng: loc.longitude })
        }
      })
      .catch(() => navigate('/login'))
  }, [user, navigate])

  // ── Map init ──────────────────────────────────────────

  useEffect(() => {
    if (!qrLocation || !mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: '/api/v1/maps/style',
      center: [qrLocation.longitude, qrLocation.latitude],
      zoom: 14,
      attributionControl: false,
      transformRequest: (url) => {
        if (/^https?:\/\/testtaxi3\.aparu\.kz/.test(url)) {
          return { url: url.replace(/^https?:\/\/testtaxi3\.aparu\.kz/, '/map-proxy') }
        }
      },
    })

    markerARef.current = new maplibregl.Marker({ color: '#FC6500' })
      .setLngLat([qrLocation.longitude, qrLocation.latitude])
      .addTo(map)

    map.on('load', () => {
      mapLoadedRef.current = true
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FC6500', 'line-width': 4, 'line-opacity': 0.85 },
      })
    })

    map.on('click', async (e) => {
      const { lng, lat } = e.lngLat
      try {
        const res = await maps.reverseGeocode(lat, lng)
        const addr = [res.placeName, res.areaName].filter(Boolean).join(', ')
          || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        const pt: Point = { address: addr, lat, lng }
        setActiveField((current) => {
          if (current === 'A') setPointA(pt)
          else setPointB(pt)
          return current
        })
        // Close search overlay if open
        setSearchOpen(false)
      } catch { /* ignore */ }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
      markerARef.current = null
      markerBRef.current = null
    }
  }, [qrLocation])

  // ── Sync markers ──────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pointA) return
    const apply = () => markerARef.current?.setLngLat([pointA.lng, pointA.lat])
    if (mapLoadedRef.current) apply(); else map.once('load', apply)
  }, [pointA])

  // Marker B is placed/moved inside the route effect (below) where the map is
  // guaranteed to be loaded. A separate effect caused a race: mapLoadedRef could
  // be false the first time pointB was set, so map.once('load') never fired.

  // ── Route ─────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pointA || !pointB) return
    function apply() {
      if (!map || !pointA || !pointB) return

      // Place / move marker B here — map is guaranteed loaded at this point
      if (markerBRef.current) {
        markerBRef.current.setLngLat([pointB.lng, pointB.lat])
      } else {
        markerBRef.current = new maplibregl.Marker({ color: '#2A3037' })
          .setLngLat([pointB.lng, pointB.lat])
          .addTo(map)
      }

      maps
        .route([
          { latitude: pointA.lat, longitude: pointA.lng },
          { latitude: pointB.lat, longitude: pointB.lng },
        ])
        .then((route) => {
          setRouteInfo({ distance: route.distance, time: route.time })
          const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
          src?.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: route.coordinates },
            properties: {},
          })
          // Fit to the actual route bbox returned by the API — avoids antimeridian issues
          if (route.bbox && route.bbox.length === 4) {
            const [minLng, minLat, maxLng, maxLat] = route.bbox
            const bounds = new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat])
            map.fitBounds(bounds, { padding: { top: 80, bottom: 40, left: 60, right: 60 }, maxZoom: 16 })
          }
        })
        .catch(() => {
          // Fallback: fit to both markers using extend() to handle any coordinate order
          const bounds = new maplibregl.LngLatBounds()
          bounds.extend([pointA!.lng, pointA!.lat])
          bounds.extend([pointB!.lng, pointB!.lat])
          map.fitBounds(bounds, { padding: { top: 80, bottom: 40, left: 60, right: 60 }, maxZoom: 16 })
        })
    }
    if (mapLoadedRef.current) apply(); else map.once('load', apply)
  }, [pointA, pointB])

  // ── Search overlay logic ──────────────────────────────

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value)
    setSuggestions([])
    setSearchError(false)
    if (!value.trim()) return
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      // Grab a seq token before the await — if a newer call fires while this
      // one is in-flight, seq will have advanced and we discard stale results.
      const seq = ++searchSeqRef.current
      // Always bias toward Ust-Kamenogorsk; refine with pointA if available
      const UST_KAM = { lat: 49.9483, lng: 82.6135 }
      const bias = pointA ?? (qrLocation
        ? { lat: qrLocation.latitude, lng: qrLocation.longitude }
        : UST_KAM)
      try {
        const res = await maps.geocode(value, bias.lat, bias.lng)
        if (seq !== searchSeqRef.current) return // discard — a newer request is in flight
        setSuggestions(res.results.slice(0, 6))
      } catch {
        if (seq !== searchSeqRef.current) return
        setSearchError(true)
      }
    }, 350)
  }, [pointA, qrLocation])

  function openSearch(field: ActiveField) {
    const current = field === 'A' ? pointA : pointB
    setSearchField(field)
    setActiveField(field)
    setSearchInput(current?.address ?? '')
    setSuggestions([])
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 80)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSuggestions([])
    setSearchError(false)
    clearTimeout(searchTimerRef.current)
    searchSeqRef.current++ // invalidate any in-flight request
  }

  function selectSuggestion(item: GeocodeResultItem) {
    const pt: Point = { address: item.address, lat: item.latitude, lng: item.longitude }
    if (searchField === 'A') setPointA(pt)
    else setPointB(pt)
    closeSearch()
  }

  // ── Submit ────────────────────────────────────────────

  const tariff = tariffList.find((t) => t.id === selectedTariff)

  async function handleConfirm() {
    if (!pointA || !pointB || !tariff) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const order = await orders.create({
        qr_location_id: qrLocation!.id,
        tariff_id: tariff.id,
        destination_address: pointB.address,
        destination_lat: pointB.lat,
        destination_lng: pointB.lng,
      })
      navigate(`/status/${order.id}`)
    } catch (e: any) {
      setSubmitError(e.message ?? 'Ошибка создания заказа')
    } finally {
      setSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────────────

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-[3px] border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">

      {/* ── MAP ── */}
      <div className="relative flex-1 min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Logo */}
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm pointer-events-none">
          <span className="text-sm font-bold text-brand-orange tracking-tight">APARU</span>
        </div>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 z-10 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm flex items-center justify-center text-text-muted"
          aria-label="Назад"
        >
          <ChevronLeftIcon />
        </button>

        {/* Map hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-brand-dark/80 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full whitespace-nowrap pointer-events-none">
          {activeField === 'A'
            ? 'Нажмите на карту, чтобы изменить точку А'
            : (!pointB ? 'Нажмите на карту, чтобы выбрать точку Б' : 'Нажмите на карту, чтобы изменить точку Б')}
        </div>
      </div>

      {/* ── BOTTOM SHEET ── */}
      <div className="bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.10)] flex-shrink-0 z-20">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Route rows */}
        <div className="px-4 pt-2 pb-1">
          {/* Point A */}
          <PointRow
            label="А"
            labelBg="bg-brand-orange"
            labelText="text-white"
            address={pointA?.address}
            placeholder="Откуда едем?"
            active={activeField === 'A'}
            onActivate={() => setActiveField('A')}
            onOpenSearch={() => openSearch('A')}
          />
          <div className="ml-[0.875rem] w-px h-3 bg-gray-200 my-0.5" />
          {/* Point B */}
          <PointRow
            label="Б"
            labelBg="bg-white border-2 border-brand-dark"
            labelText="text-brand-dark"
            address={pointB?.address}
            placeholder="Куда едем?"
            active={activeField === 'B'}
            onActivate={() => setActiveField('B')}
            onOpenSearch={() => openSearch('B')}
          />
        </div>

        {/* Tariffs */}
        <div className="px-4 py-2 border-t border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {tariffList.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTariff(t.id)}
                className={[
                  'flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl border transition-colors',
                  t.id === selectedTariff
                    ? 'border-brand-orange bg-surface-warm'
                    : 'border-gray-100 bg-white',
                ].join(' ')}
              >
                <span className="text-sm font-medium text-text-primary">{t.name}</span>
                <span className="text-xs text-text-muted mt-0.5">{t.base_price} {t.currency}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary + CTA */}
        <div className="px-4 pt-2 pb-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            {routeInfo ? (
              <span className="text-sm text-text-muted">
                {(routeInfo.distance / 1000).toFixed(1)} км · {Math.ceil(routeInfo.time / 60000)} мин
              </span>
            ) : (
              <span className="text-sm text-text-muted">
                {pointB ? 'Считаем маршрут...' : 'Выберите точку назначения'}
              </span>
            )}
            {tariff && (
              <span className="font-semibold text-base text-text-primary">
                {tariff.base_price} {tariff.currency}
              </span>
            )}
          </div>
          <Button onClick={handleConfirm} disabled={!pointA || !pointB || submitting}>
            {submitting ? 'Оформление...' : 'Заказать такси'}
          </Button>
          {submitError && <p className="text-xs text-red-500 text-center mt-2">{submitError}</p>}
        </div>
      </div>

      {/* ── SEARCH OVERLAY ── */}
      {searchOpen && (
        <>
          {/* Full-screen overlay — input stays top, results fill middle, keyboard is below */}
          <div className="fixed inset-0 z-40 bg-white flex flex-col">

            {/* ── Fixed header: input row ── */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-safe border-b border-gray-100 bg-white"
              style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
              <div className={[
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                searchField === 'A' ? 'bg-brand-orange' : 'bg-white border-2 border-brand-dark',
              ].join(' ')}>
                <span className={[
                  'text-xs font-bold',
                  searchField === 'A' ? 'text-white' : 'text-brand-dark',
                ].join(' ')}>
                  {searchField}
                </span>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder={searchField === 'A' ? 'Откуда едем?' : 'Куда едем?'}
                className="flex-1 h-12 text-sm font-medium text-text-primary placeholder:text-text-muted bg-transparent outline-none"
              />
              {searchInput.length > 0 && (
                <button
                  onClick={() => { setSearchInput(''); setSuggestions([]); searchInputRef.current?.focus() }}
                  className="w-8 h-8 flex items-center justify-center"
                >
                  <ClearIcon />
                </button>
              )}
              <button
                onClick={closeSearch}
                className="text-sm text-brand-orange font-medium whitespace-nowrap pl-1"
              >
                Отмена
              </button>
            </div>

            {/* Suggestions list */}
            <div className="overflow-y-auto flex-1">
              {suggestions.length > 0 ? (
                suggestions.map((s, i) => (
                  <button
                    key={`${s.latitude},${s.longitude},${i}`}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-start gap-3"
                  >
                    <PinIcon />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{s.address}</p>
                      <p className="text-xs text-text-muted mt-0.5">{s.additionalInfo}</p>
                    </div>
                  </button>
                ))
              ) : searchError ? (
                <p className="text-sm text-red-500 text-center py-8">Ошибка поиска, попробуйте ещё раз</p>
              ) : searchInput.trim().length > 0 ? (
                <p className="text-sm text-text-muted text-center py-8">Ничего не найдено</p>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
                    Или выберите на карте
                  </p>
                  <button
                    onClick={closeSearch}
                    className="w-full flex items-center gap-3 py-2 text-sm font-medium text-text-primary"
                  >
                    <MapPinIcon />
                    Указать точку на карте
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── PointRow ──────────────────────────────────────────────

interface PointRowProps {
  label: string
  labelBg: string
  labelText: string
  address?: string
  placeholder: string
  active: boolean
  onActivate: () => void
  onOpenSearch: () => void
}

function PointRow({ label, labelBg, labelText, address, placeholder, active, onActivate, onOpenSearch }: PointRowProps) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl px-1 py-1 cursor-pointer transition-colors',
        active ? 'bg-surface-warm' : 'hover:bg-gray-50',
      ].join(' ')}
      onClick={() => {
        if (active) {
          onOpenSearch()
        } else {
          onActivate()
        }
      }}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${labelBg}`}>
        <span className={`text-xs font-bold ${labelText}`}>{label}</span>
      </div>
      <div className="flex-1 min-w-0 py-1">
        {address ? (
          <p className="text-sm font-medium text-text-primary truncate">{address}</p>
        ) : (
          <p className="text-sm text-text-muted">{placeholder}</p>
        )}
      </div>
      <EditIcon active={active} />
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M11.25 13.5L6.75 9L11.25 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EditIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      className={`shrink-0 transition-colors ${active ? 'text-brand-orange' : 'text-gray-300'}`}>
      <path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14H2v-2.667L11.333 2Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#E5E7EB" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 text-text-muted">
      <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.485-2.015-4.5-4.5-4.5Z"
        stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 text-brand-orange">
      <path d="M10 2C7.239 2 5 4.239 5 7c0 4.5 5 11 5 11s5-6.5 5-11c0-2.761-2.239-5-5-5Z"
        stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
