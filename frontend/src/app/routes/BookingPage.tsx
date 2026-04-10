import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations, tariffs as tariffsApi, orders, maps } from '@/lib/services/api'
import type {
  GeocodeResultItem,
  LocationOut,
  TariffOut,
  TariffPeriod,
} from '@/lib/services/api'
import { Button } from '@/components/Button'
import { getActiveScanLocationId } from '@/lib/scanContext'

interface Point {
  address: string
  lat: number
  lng: number
}

type ActiveField = 'A' | 'B'
type RouteInfo = { distance: number; time: number }
const TARIFF_ORDER = ['Эконом', 'Оптимал', 'Комфорт', 'Бизнес']

function getAutoTariffPeriod(now = new Date()): TariffPeriod {
  const hour = now.getHours()
  return hour >= 22 || hour < 6 ? 'night' : 'day'
}

function formatTariffPeriodLabel(period: TariffPeriod) {
  return period === 'night' ? 'Ночной' : 'Дневной'
}

function getTariffsForPeriod(tariffs: TariffOut[], period: TariffPeriod) {
  return tariffs
    .filter((tariff) => tariff.period === period)
    .sort((left, right) => {
      const leftIdx = TARIFF_ORDER.indexOf(left.name)
      const rightIdx = TARIFF_ORDER.indexOf(right.name)
      if (leftIdx === -1 || rightIdx === -1) return left.name.localeCompare(right.name, 'ru')
      return leftIdx - rightIdx
    })
}

function calculateTariffPrice(tariff: TariffOut, routeInfo: RouteInfo | null) {
  if (!routeInfo) return Math.round(tariff.base_price)

  const distanceKm = routeInfo.distance / 1000
  const durationMinutes = routeInfo.time / 1000 / 60
  const includedDistance = Math.max(tariff.included_distance_km, 0)
  const extraDistance = includedDistance > 0
    ? Math.max(distanceKm - includedDistance, 0)
    : distanceKm
  const extraDuration = Math.max(durationMinutes - tariff.time_threshold_minutes, 0)

  return Math.round(
    tariff.base_price
      + extraDistance * tariff.price_per_km
      + extraDuration * tariff.price_per_minute,
  )
}

function formatPrice(value: number, currency = 'тг') {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value))} ${currency}`
}

function formatRouteMeta(routeInfo: RouteInfo) {
  const minutes = Math.floor(routeInfo.time / 1000 / 60)
  const seconds = Math.round((routeInfo.time / 1000) % 60)
  return `${(routeInfo.distance / 1000).toFixed(1)} км · ${minutes} мин ${seconds} сек`
}

function getTaximeterLines(tariff: TariffOut) {
  const firstLine = tariff.included_distance_km > 0
    ? `Первые ${tariff.included_distance_km} км — ${formatPrice(tariff.base_price, tariff.currency)}`
    : `Посадка — ${formatPrice(tariff.base_price, tariff.currency)}`

  const secondLine = tariff.included_distance_km > 0
    ? `Затем — ${formatPrice(tariff.price_per_km, tariff.currency)} за км`
    : `Цена за км — ${formatPrice(tariff.price_per_km, tariff.currency)} за км`

  const thirdLine = `После ${tariff.time_threshold_minutes} мин пути — ${formatPrice(tariff.price_per_minute, tariff.currency)}/мин`

  return [firstLine, secondLine, thirdLine]
}

export function BookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const markerARef = useRef<maplibregl.Marker | null>(null)
  const markerBRef = useRef<maplibregl.Marker | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchSeqRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [dataLoading, setDataLoading] = useState(true)
  const [qrLocation, setQrLocation] = useState<LocationOut | null>(null)
  const [tariffList, setTariffList] = useState<TariffOut[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<TariffPeriod>(() => getAutoTariffPeriod())
  const [selectedTariff, setSelectedTariff] = useState<number | null>(null)
  const [pointA, setPointA] = useState<Point | null>(null)
  const [pointB, setPointB] = useState<Point | null>(null)
  const [activeField, setActiveField] = useState<ActiveField>('B')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchField, setSearchField] = useState<ActiveField>('B')
  const [searchInput, setSearchInput] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeResultItem[]>([])
  const [searchError, setSearchError] = useState(false)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [tariffInfoOpen, setTariffInfoOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/verify', { replace: true })
      return
    }

    const locId = getActiveScanLocationId()

    Promise.all([locations.get(locId), tariffsApi.list()])
      .then(async ([loc, tList]) => {
        setQrLocation(loc)
        setTariffList(tList)
        setDataLoading(false)

        try {
          const geo = await maps.reverseGeocode(loc.latitude, loc.longitude)
          const addr = [geo.placeName, geo.areaName].filter(Boolean).join(', ')
            || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
          setPointA({ address: addr, lat: loc.latitude, lng: loc.longitude })
        } catch {
          setPointA({
            address: `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`,
            lat: loc.latitude,
            lng: loc.longitude,
          })
        }
      })
      .catch(() => navigate('/verify', { replace: true }))
  }, [user, navigate])

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
        const point = { address: addr, lat, lng }

        setActiveField((current) => {
          if (current === 'A') setPointA(point)
          else setPointB(point)
          return current
        })

        setSearchOpen(false)
      } catch {
        // Ignore reverse-geocode failures on map click.
      }
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

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pointA) return
    const apply = () => markerARef.current?.setLngLat([pointA.lng, pointA.lat])
    if (mapLoadedRef.current) apply()
    else map.once('load', apply)
  }, [pointA])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !pointA || !pointB) {
      setRouteInfo(null)
      return
    }

    function apply() {
      if (!map || !pointA || !pointB) return

      if (markerBRef.current) {
        markerBRef.current.setLngLat([pointB.lng, pointB.lat])
      } else {
        markerBRef.current = new maplibregl.Marker({ color: '#2A3037' })
          .setLngLat([pointB.lng, pointB.lat])
          .addTo(map)
      }

      maps.route([
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

          if (route.bbox && route.bbox.length === 4) {
            const [minLng, minLat, maxLng, maxLat] = route.bbox
            const bounds = new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat])
            map.fitBounds(bounds, {
              padding: { top: 80, bottom: 40, left: 60, right: 60 },
              maxZoom: 16,
            })
          }
        })
        .catch(() => {
          setRouteInfo(null)
          const bounds = new maplibregl.LngLatBounds()
          bounds.extend([pointA.lng, pointA.lat])
          bounds.extend([pointB.lng, pointB.lat])
          map.fitBounds(bounds, {
            padding: { top: 80, bottom: 40, left: 60, right: 60 },
            maxZoom: 16,
          })
        })
    }

    if (mapLoadedRef.current) apply()
    else map.once('load', apply)
  }, [pointA, pointB])

  useEffect(() => {
    const periodTariffs = getTariffsForPeriod(tariffList, selectedPeriod)

    setSelectedTariff((current) => {
      if (!periodTariffs.length) return null

      const currentTariff = tariffList.find((item) => item.id === current)
      if (
        currentTariff
        && currentTariff.period === selectedPeriod
        && periodTariffs.some((item) => item.id === current)
      ) {
        return current
      }

      const sameNameTariff = currentTariff
        ? periodTariffs.find((item) => item.name === currentTariff.name)
        : null

      return sameNameTariff?.id ?? periodTariffs[0].id
    })
  }, [selectedPeriod, tariffList])

  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value)
    setSuggestions([])
    setSearchError(false)

    if (!value.trim()) return

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    searchTimerRef.current = setTimeout(async () => {
      const seq = ++searchSeqRef.current
      const ustKam = { lat: 49.9483, lng: 82.6135 }
      const bias = pointA ?? (qrLocation
        ? { lat: qrLocation.latitude, lng: qrLocation.longitude }
        : ustKam)

      try {
        const res = await maps.geocode(value, bias.lat, bias.lng)
        if (seq !== searchSeqRef.current) return
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
    setSearchError(false)
    setSearchOpen(true)
    window.setTimeout(() => searchInputRef.current?.focus(), 80)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSuggestions([])
    setSearchError(false)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchSeqRef.current += 1
  }

  function selectSuggestion(item: GeocodeResultItem) {
    const point = { address: item.address, lat: item.latitude, lng: item.longitude }
    if (searchField === 'A') setPointA(point)
    else setPointB(point)
    closeSearch()
  }

  const visibleTariffs = getTariffsForPeriod(tariffList, selectedPeriod)
  const tariff = visibleTariffs.find((item) => item.id === selectedTariff) ?? null
  const selectedTariffPrice = tariff ? calculateTariffPrice(tariff, routeInfo) : null

  function handlePeriodChange(period: TariffPeriod) {
    setSelectedPeriod(period)
  }

  async function handleConfirm() {
    if (!pointA || !pointB || !tariff) return

    setSubmitError('')
    setSubmitting(true)

    try {
      const order = await orders.create({
        qr_location_id: qrLocation!.id,
        tariff_id: tariff.id,
        tariff_period: selectedPeriod,
        destination_address: pointB.address,
        destination_lat: pointB.lat,
        destination_lng: pointB.lng,
        route_distance_meters: routeInfo?.distance,
        route_duration_seconds: routeInfo ? routeInfo.time / 1000 : undefined,
      })
      navigate(`/status/${order.id}`)
    } catch (error: any) {
      setSubmitError(error.message ?? 'Ошибка создания заказа')
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
      <div className="relative flex-1 min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />

        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm pointer-events-none">
          <span className="text-sm font-bold text-brand-orange tracking-tight">APARU</span>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 z-10 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm flex items-center justify-center text-text-muted"
          aria-label="Назад"
        >
          <ChevronLeftIcon />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-brand-dark/80 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full whitespace-nowrap pointer-events-none">
          {activeField === 'A'
            ? 'Нажмите на карту, чтобы изменить точку А'
            : (!pointB ? 'Нажмите на карту, чтобы выбрать точку Б' : 'Нажмите на карту, чтобы изменить точку Б')}
        </div>
      </div>

      <div className="bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.10)] flex-shrink-0 z-20">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-4 pt-2 pb-1">
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

        <div className="px-4 py-2 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              type="button"
              onClick={() => setTariffInfoOpen(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-text-primary"
            >
              <TariffInfoIcon />
              Тариф
            </button>
            <button
              type="button"
              onClick={() => setTariffInfoOpen(true)}
              className="w-7 h-7 rounded-full border border-gray-200 text-text-muted flex items-center justify-center"
              aria-label="Открыть условия тарифа"
            >
              ?
            </button>
            <div className="inline-flex rounded-full bg-gray-100 p-1">
              {(['day', 'night'] as TariffPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => handlePeriodChange(period)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    selectedPeriod === period
                      ? 'bg-white text-brand-orange shadow-sm'
                      : 'text-text-muted',
                  ].join(' ')}
                >
                  {period === 'day' ? 'День' : 'Ночь'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {visibleTariffs.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedTariff(item.id)}
                className={[
                  'flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl border transition-colors min-w-[92px]',
                  item.id === selectedTariff
                    ? 'border-brand-orange bg-surface-warm'
                    : 'border-gray-100 bg-white',
                ].join(' ')}
              >
                <span className="text-sm font-medium text-text-primary">{item.name}</span>
                <span className="text-xs text-text-muted mt-0.5">
                  {formatPrice(calculateTariffPrice(item, routeInfo), item.currency)}
                </span>
              </button>
            ))}
            {visibleTariffs.length === 0 && (
              <div className="py-2 text-sm text-text-muted">Нет тарифов для выбранного периода</div>
            )}
          </div>
        </div>

        <div className="px-4 pt-2 pb-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3 gap-4">
            {routeInfo ? (
              <span className="text-sm text-text-muted">{formatRouteMeta(routeInfo)}</span>
            ) : (
              <span className="text-sm text-text-muted">
                {pointB ? 'Считаем маршрут...' : 'Выберите точку назначения'}
              </span>
            )}

            {tariff && selectedTariffPrice !== null && (
              <span className="font-semibold text-base text-text-primary whitespace-nowrap">
                {formatPrice(selectedTariffPrice, tariff.currency)}
              </span>
            )}
          </div>

          <Button onClick={handleConfirm} disabled={!pointA || !pointB || submitting}>
            {submitting ? 'Оформление...' : 'Заказать такси'}
          </Button>
          {submitError && <p className="text-xs text-red-500 text-center mt-2">{submitError}</p>}
        </div>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 pt-safe border-b border-gray-100 bg-white"
            style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
          >
            <div
              className={[
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                searchField === 'A' ? 'bg-brand-orange' : 'bg-white border-2 border-brand-dark',
              ].join(' ')}
            >
              <span
                className={[
                  'text-xs font-bold',
                  searchField === 'A' ? 'text-white' : 'text-brand-dark',
                ].join(' ')}
              >
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
                onClick={() => {
                  setSearchInput('')
                  setSuggestions([])
                  searchInputRef.current?.focus()
                }}
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

          <div className="overflow-y-auto flex-1">
            {suggestions.length > 0 ? (
              suggestions.map((item, index) => (
                <button
                  key={`${item.latitude},${item.longitude},${index}`}
                  onClick={() => selectSuggestion(item)}
                  className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-start gap-3"
                >
                  <PinIcon />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{item.address}</p>
                    <p className="text-xs text-text-muted mt-0.5">{item.additionalInfo}</p>
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
      )}

      {tariffInfoOpen && tariff && (
        <TariffModal
          tariff={tariff}
          period={selectedPeriod}
          onClose={() => setTariffInfoOpen(false)}
        />
      )}
    </div>
  )
}

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

function PointRow({
  label,
  labelBg,
  labelText,
  address,
  placeholder,
  active,
  onActivate,
  onOpenSearch,
}: PointRowProps) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl px-1 py-1 cursor-pointer transition-colors',
        active ? 'bg-surface-warm' : 'hover:bg-gray-50',
      ].join(' ')}
      onClick={() => {
        if (active) onOpenSearch()
        else onActivate()
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

function TariffModal({
  tariff,
  period,
  onClose,
}: {
  tariff: TariffOut
  period: TariffPeriod
  onClose: () => void
}) {
  const taximeterLines = getTaximeterLines(tariff)

  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[28px] bg-white shadow-2xl px-6 pt-8 pb-6">
        <h2 className="text-center text-[18px] font-bold text-text-primary mb-6">Тариф</h2>

        <div className="space-y-6">
          <div>
            <p className="text-[15px] font-semibold text-text-primary mb-2">
              Тариф: {formatTariffPeriodLabel(period)}
            </p>
            <p className="text-[16px] font-semibold text-text-primary mb-2">Расчет по таксометру:</p>
            <div className="space-y-1.5">
              {taximeterLines.map((line) => (
                <p key={line} className="text-[15px] leading-6 text-text-primary">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[16px] font-semibold text-text-primary mb-2">Ожидание клиента:</p>
            <div className="space-y-1.5">
              <p className="text-[15px] leading-6 text-text-primary">
                Первые {tariff.free_waiting_minutes} мин ожидания — бесплатно
              </p>
              <p className="text-[15px] leading-6 text-text-primary">
                Далее: 1 мин — {formatPrice(tariff.waiting_price_per_minute, tariff.currency)}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-8 mx-auto flex h-14 min-w-[220px] items-center justify-center rounded-full bg-brand-orange px-8 text-lg font-medium text-white"
        >
          Закрыть
        </button>
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

function EditIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 transition-colors ${active ? 'text-brand-orange' : 'text-gray-300'}`}
    >
      <path
        d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14H2v-2.667L11.333 2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      <path
        d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.485-2.015-4.5-4.5-4.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 text-brand-orange">
      <path
        d="M10 2C7.239 2 5 4.239 5 7c0 4.5 5 11 5 11s5-6.5 5-11c0-2.761-2.239-5-5-5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function TariffInfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-brand-orange">
      <circle cx="9" cy="9" r="8" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M5.5 10.75 7.5 8.75l1.75 1.75L12.5 7.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.75 7.25h1.75V9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
