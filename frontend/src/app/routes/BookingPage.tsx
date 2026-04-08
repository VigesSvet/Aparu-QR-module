import { useState, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations, tariffs as tariffsApi, orders, maps } from '@/lib/services/api'
import type { LocationOut, TariffOut, GeocodeResultItem } from '@/lib/services/api'
import { Button } from '@/components/Button'

interface DestPoint {
  address: string
  lat: number
  lng: number
}

export function BookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const markerBRef = useRef<maplibregl.Marker | null>(null)

  // Data state
  const [dataLoading, setDataLoading] = useState(true)
  const [location, setLocation] = useState<LocationOut | null>(null)
  const [tariffList, setTariffList] = useState<TariffOut[]>([])
  const [selectedTariff, setSelectedTariff] = useState<number | null>(null)

  // Booking state
  const [dest, setDest] = useState<DestPoint | null>(null)
  const [destInput, setDestInput] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeResultItem[]>([])
  const [routeInfo, setRouteInfo] = useState<{ distance: number; time: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Load location + tariffs from sessionStorage
  useEffect(() => {
    if (!user) { navigate('/login'); return }

    const locId = parseInt(sessionStorage.getItem('aparu_scan_location') ?? '1', 10)

    Promise.all([locations.get(locId), tariffsApi.list()])
      .then(([loc, tList]) => {
        setLocation(loc)
        setTariffList(tList)
        setSelectedTariff(tList[0]?.id ?? null)
      })
      .catch(() => navigate('/login'))
      .finally(() => setDataLoading(false))
  }, [user, navigate])

  // Init map after location is loaded
  useEffect(() => {
    if (!location || !mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: '/api/v1/maps/style',
      center: [location.longitude, location.latitude],
      zoom: 14,
      attributionControl: false,
      transformRequest: (url) => {
        if (/^https?:\/\/testtaxi3\.aparu\.kz/.test(url)) {
          return { url: url.replace(/^https?:\/\/testtaxi3\.aparu\.kz/, '/map-proxy') }
        }
      },
    })

    // Marker A — orange, fixed
    new maplibregl.Marker({ color: '#FC6500' })
      .setLngLat([location.longitude, location.latitude])
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

    // Tap map → reverse geocode → set destination
    map.on('click', async (e) => {
      const { lng, lat } = e.lngLat
      try {
        const res = await maps.reverseGeocode(lat, lng)
        const addr = res.placeName + (res.areaName ? `, ${res.areaName}` : '')
        setDest({ address: addr, lat, lng })
        setDestInput(addr)
        setSuggestions([])
      } catch { /* ignore */ }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
      markerBRef.current = null
    }
  }, [location])

  // Update marker B and route when destination changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !dest || !location) return

    function applyToMap() {
      if (!map || !dest || !location) return

      // Place/move marker B
      if (markerBRef.current) {
        markerBRef.current.setLngLat([dest.lng, dest.lat])
      } else {
        markerBRef.current = new maplibregl.Marker({ color: '#2A3037' })
          .setLngLat([dest.lng, dest.lat])
          .addTo(map)
      }

      // Fit both points in view
      const bounds = new maplibregl.LngLatBounds(
        [location.longitude, location.latitude],
        [dest.lng, dest.lat],
      )
      map.fitBounds(bounds, { padding: { top: 70, bottom: 30, left: 50, right: 50 } })

      // Draw route
      maps
        .route([
          { latitude: location.latitude, longitude: location.longitude },
          { latitude: dest.lat, longitude: dest.lng },
        ])
        .then((route) => {
          setRouteInfo({ distance: route.distance, time: route.time })
          const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
          src?.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: route.coordinates },
            properties: {},
          })
        })
        .catch(() => {})
    }

    if (mapLoadedRef.current) {
      applyToMap()
    } else {
      map.once('load', applyToMap)
    }
  }, [dest, location])

  // Debounced geocode search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  function handleDestInput(value: string) {
    setDestInput(value)
    if (!value.trim()) { setSuggestions([]); return }
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      if (!location) return
      try {
        const res = await maps.geocode(value, location.latitude, location.longitude)
        setSuggestions(res.results.slice(0, 5))
      } catch { /* ignore */ }
    }, 400)
  }

  function selectSuggestion(item: GeocodeResultItem) {
    setDest({ address: item.address, lat: item.latitude, lng: item.longitude })
    setDestInput(item.address)
    setSuggestions([])
  }

  const tariff = tariffList.find((t) => t.id === selectedTariff)

  async function handleConfirm() {
    if (!dest || !location || !tariff) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const order = await orders.create({
        qr_location_id: location.id,
        tariff_id: tariff.id,
        destination_address: dest.address,
        destination_lat: dest.lat,
        destination_lng: dest.lng,
      })
      navigate(`/status/${order.id}`)
    } catch (e: any) {
      setSubmitError(e.message ?? 'Ошибка создания заказа')
    } finally {
      setSubmitting(false)
    }
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-[3px] border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Map area */}
      <div className="relative flex-1 min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Logo overlay */}
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm pointer-events-none">
          <span className="text-sm font-bold text-brand-orange tracking-tight">APARU</span>
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 z-10 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm flex items-center justify-center text-text-muted"
          aria-label="Назад"
        >
          <ChevronLeftIcon />
        </button>

        {/* "Tap to choose destination" hint */}
        {!dest && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-brand-dark/80 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full whitespace-nowrap pointer-events-none">
            Нажмите на карту, чтобы выбрать точку Б
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <div className="relative bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.10)] flex-shrink-0 z-20">
        {/* Drag handle */}
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Route inputs */}
        <div className="relative px-4 pt-3 pb-1">
          {/* Point A */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">А</span>
            </div>
            <div className="min-w-0 flex-1 py-1">
              <p className="text-sm font-medium text-text-primary leading-snug truncate">
                {location?.name}
              </p>
              <p className="text-xs text-text-muted truncate">{location?.address}</p>
            </div>
          </div>

          {/* Connector */}
          <div className="ml-[0.875rem] w-px h-3 bg-gray-200 my-0.5" />

          {/* Point B */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-brand-dark flex items-center justify-center shrink-0">
              <span className="text-brand-dark text-xs font-bold">Б</span>
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Куда едем?"
                value={destInput}
                onChange={(e) => handleDestInput(e.target.value)}
                className="w-full py-1.5 text-sm font-medium text-text-primary placeholder:text-text-muted bg-transparent outline-none border-b border-gray-200 focus:border-brand-orange transition-colors"
              />
            </div>
          </div>

          {/* Suggestions — float above inputs */}
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <p className="text-sm font-medium text-text-primary">{s.address}</p>
                  <p className="text-xs text-text-muted">{s.additionalInfo}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tariff chips */}
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
                <span className="text-xs text-text-muted mt-0.5">
                  {t.base_price} {t.currency}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Route summary + CTA */}
        <div className="px-4 pt-2 pb-6 border-t border-gray-100">
          {routeInfo ? (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-muted">
                {(routeInfo.distance / 1000).toFixed(1)} км ·{' '}
                {Math.ceil(routeInfo.time / 60000)} мин
              </span>
              {tariff && (
                <span className="font-semibold text-base text-text-primary">
                  {tariff.base_price} {tariff.currency}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-muted">
                {dest ? 'Считаем маршрут...' : 'Выберите точку назначения'}
              </span>
              {tariff && (
                <span className="font-semibold text-base text-text-primary">
                  {tariff.base_price} {tariff.currency}
                </span>
              )}
            </div>
          )}

          <Button onClick={handleConfirm} disabled={!dest || submitting}>
            {submitting ? 'Оформление...' : 'Заказать такси'}
          </Button>

          {submitError && (
            <p className="text-xs text-red-500 text-center mt-2">{submitError}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M11.25 13.5L6.75 9L11.25 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
