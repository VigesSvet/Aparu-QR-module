import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate } from 'react-router-dom'
import { locations, tariffs as tariffsApi, orders, maps, getToken } from '@/lib/services/api'
import type {
  GeocodeResultItem,
  LocationOut,
  OrderOut,
  TariffOut,
  TariffPeriod,
} from '@/lib/services/api'
import { Button } from '@/components/Button'
import { CheckoutModal } from '@/components/CheckoutModal'
import { getActiveScanLocationId, getRepeatScanPath } from '@/lib/scanContext'

type LngLat = [number, number]

const DECORATIVE_CAR_COORDINATES: Array<[number, number]> = [
  [82.603283, 49.902706],
  [82.599506, 49.895408],
  [82.590408, 49.889879],
  [82.610493, 49.889547],
  [82.622509, 49.88634],
  [82.627487, 49.906908],
  [82.640362, 49.914425],
  [82.612038, 49.916414],
  [82.614613, 49.905139],
  [82.620964, 49.92813],
  [82.592297, 49.932439],
  [82.621822, 49.937964],
  [82.627144, 49.947464],
  [82.617702, 49.948679],
  [82.588863, 49.947906],
  [82.64637, 49.948569],
  [82.610664, 49.946581],
  [82.636414, 49.960497],
  [82.634354, 49.942714],
  [82.594013, 49.953539],
  [82.586975, 49.964914],
  [82.628174, 49.963368],
  [82.645855, 49.962374],
  [82.568951, 49.989532],
  [82.543545, 49.954423],
  [82.555733, 49.983793],
  [82.602596, 49.967675],
  [82.660618, 49.947796],
  [82.59058, 49.96646],
  [82.621994, 49.954975],
]

const APPROACH_ROUTE_SOURCE_ID = 'approach-route'
const TRIP_ROUTE_SOURCE_ID = 'trip-route'

type SimPhase =
  | 'idle'
  | 'searchingModal'
  | 'assignedPreview'
  | 'approachingPickup'
  | 'waitingAtPickup'
  | 'inTrip'
  | 'completed'

interface TariffDriverPreset {
  tariffMatch: string
  driverName: string
  carModel: string
  plate: string
  avatarText: string
  avatarBg: string
  carColor: string
}

interface ActiveCarSimulation {
  markerIndex: number
  coordinate: LngLat
  heading: number
}

const DRIVER_PRESETS: TariffDriverPreset[] = [
  { tariffMatch: 'эконом', driverName: 'Тимур Н.', carModel: 'Chevrolet Cobalt', plate: '707 ANA 18', avatarText: 'АН', avatarBg: '#FC6500', carColor: '#FC6500' },
  { tariffMatch: 'оптимал', driverName: 'Руслан К.', carModel: 'Hyundai Elantra', plate: '525 KZT 18', avatarText: 'РК', avatarBg: '#FF8C42', carColor: '#FF8C42' },
  { tariffMatch: 'комфорт', driverName: 'Диас С.', carModel: 'Kia K5', plate: '313 KFM 18', avatarText: 'ДС', avatarBg: '#1F7A8C', carColor: '#1F7A8C' },
  { tariffMatch: 'бизнес', driverName: 'Айдос С.', carModel: 'Toyota Camry 70', plate: '777 VIP 16', avatarText: 'АС', avatarBg: '#2A3037', carColor: '#2A3037' },
]

const SIM_TIMINGS = {
  searchMs: 2400,
  assignedPreviewMs: 1400,
  minApproachMs: 5500,
  maxApproachMs: 11000,
  minTripMs: 6500,
  maxTripMs: 13000,
}

interface Point {
  address: string
  lat: number
  lng: number
}

type ActiveField = 'A' | 'B'
type RouteInfo = { distance: number; time: number }

interface CompletedSummary {
  price: number
  waitSeconds: number
  tripSeconds: number | null
}
const TARIFF_ORDER = ['Эконом', 'Оптимал', 'Комфорт', 'Бизнес']

const STATUS_STEPS: { key: string; label: string }[] = [
  { key: 'searching', label: 'Поиск' },
  { key: 'assigned', label: 'Назначен' },
  { key: 'driving', label: 'Едет' },
  { key: 'arrived', label: 'Прибыл' },
]

const STATUS_MESSAGES: Record<string, string> = {
  searching: 'Ищем машину...',
  assigned: 'Заказ подтверждён',
  driving: 'Машина едет к вам',
  arrived: 'Машина ожидает у точки посадки',
}



const SIM_PHASE_MESSAGES: Record<SimPhase, string> = {
  idle: '',
  searchingModal: 'Ищем таксиста...',
  assignedPreview: 'Таксист назначен',
  approachingPickup: 'Таксист едет к вам',
  waitingAtPickup: 'Таксист прибыл',
  inTrip: 'Поездка началась',
  completed: 'Поездка завершена',
}

const SIM_PHASE_TO_ORDER_STATUS: Record<Exclude<SimPhase, 'idle' | 'completed'>, OrderOut['status']> = {
  searchingModal: 'searching',
  assignedPreview: 'assigned',
  approachingPickup: 'driving',
  waitingAtPickup: 'arrived',
  inTrip: 'driving',
}

function getAutoTariffPeriod(now = new Date()): TariffPeriod {
  const hour = now.getHours()
  return hour >= 22 || hour < 6 ? 'night' : 'day'
}

function formatTariffPeriodLabel(period: TariffPeriod | OrderOut['tariff_period']) {
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

function getDecorativeCarSvg(color = '#FC6500') {
  return `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.5651 8.66667H19.2133L18.5878 6.93333C17.9373 5.14667 16.311 4 14.5096 4H9.55583C7.75444 4 6.1532 5.14667 5.47768 6.93333L4.82718 8.66667H2.47537C2.22517 8.66667 2 8.88 2 9.17333C2 9.2 2 9.25333 2.02502 9.28L2.25019 10.2933C2.30023 10.5067 2.50039 10.6667 2.70054 10.6667H3.52618C2.97575 11.1733 2.6505 11.8933 2.6505 12.6667V14.6667C2.6505 15.3067 2.87568 15.92 3.27598 16.4267V18.6667C3.27598 19.4133 3.82641 20 4.52695 20H5.77791C6.47845 20 7.02888 19.4133 7.02888 18.6667V17.3333H17.0366V18.6667C17.0366 19.4133 17.587 20 18.2876 20H19.5385C20.2391 20 20.7895 19.4133 20.7895 18.6667V16.4C21.1898 15.92 21.415 15.3067 21.415 14.64V12.64C21.415 11.8667 21.0897 11.1467 20.5393 10.64H21.3149C21.5401 10.64 21.7152 10.48 21.7652 10.2667L21.9904 9.25333C22.0405 8.98667 21.8903 8.72 21.6401 8.64C21.6401 8.66667 21.6151 8.66667 21.5651 8.66667ZM7.80447 7.92C8.07969 7.14667 8.78023 6.66667 9.55583 6.66667H14.5096C15.2852 6.66667 15.9858 7.17333 16.261 7.92L17.0366 10H7.02888L7.80447 7.92ZM5.77791 14.6667C5.12741 14.72 4.57699 14.1867 4.52695 13.4933C4.52695 13.44 4.52695 13.3867 4.52695 13.3333C4.47691 12.64 4.9773 12.0533 5.6278 12H5.77791C6.52849 12 7.65436 13.2 7.65436 14C7.65436 14.8 6.52849 14.6667 5.77791 14.6667ZM18.2876 14.6667C17.537 14.6667 16.4111 14.8 16.4111 14C16.4111 13.2 17.537 12 18.2876 12C18.9381 11.9467 19.4885 12.48 19.5385 13.1733V13.3333C19.5886 14.0267 19.0882 14.6133 18.4377 14.6667C18.3876 14.6667 18.3376 14.6667 18.2876 14.6667Z" fill="${color}"/>
    </svg>
  `.trim()
}

function createDecorativeCarElement(rotation: number, color = '#FC6500', size = 24) {
  const shell = document.createElement('div')
  shell.style.width = `${size}px`
  shell.style.height = `${size}px`
  shell.style.pointerEvents = 'none'

  const inner = document.createElement('div')
  inner.dataset.role = 'car-visual'
  inner.style.width = '100%'
  inner.style.height = '100%'
  // inner.style.transform = `rotate(${rotation}deg)` // User requested cars not to rotate
  inner.style.transformOrigin = 'center'
  inner.innerHTML = getDecorativeCarSvg(color)

  shell.appendChild(inner)
  return shell
}

function updateCarElementRotation(marker: maplibregl.Marker | null, rotation: number) {
  // const visual = marker?.getElement().querySelector('[data-role="car-visual"]') as HTMLDivElement | null
  // if (visual) visual.style.transform = `rotate(${rotation}deg)`
}

function resolveDriverPreset(tariffName?: string | null) {
  const normalized = (tariffName ?? '').toLowerCase()
  return DRIVER_PRESETS.find((preset) => normalized.includes(preset.tariffMatch)) ?? DRIVER_PRESETS[0]
}

function distanceBetweenPoints(a: LngLat, b: LngLat) {
  const lngScale = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180)
  const dx = (a[0] - b[0]) * lngScale
  const dy = a[1] - b[1]
  return Math.sqrt(dx * dx + dy * dy)
}

function pickNearestDecorativeCar(target: LngLat) {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  DECORATIVE_CAR_COORDINATES.forEach((coord, index) => {
    const distance = distanceBetweenPoints(coord, target)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

function getHeading(from: LngLat, to: LngLat) {
  const radians = Math.atan2(to[1] - from[1], to[0] - from[0])
  return radians * 180 / Math.PI + 90
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection' as const, features: [] }
}

function lineFeatureFromCoordinates(coordinates: LngLat[]) {
  if (coordinates.length < 2) return emptyFeatureCollection()
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: {},
  }
}

const ACTIVE_ORDER_KEY = 'aparu_active_order_id'

const NOTIFICATION_MESSAGES: Record<string, { title: string; body: string }> = {
  assigned: { title: 'Водитель назначен', body: 'Заказ подтверждён, водитель принял заказ' },
  driving: { title: 'Водитель едет к вам', body: 'Машина уже в пути к точке посадки' },
  arrived: { title: 'Машина прибыла', body: 'Водитель ожидает вас у точки посадки' },
  cancelled: { title: 'Заказ отменён', body: 'Ваш заказ был отменён' },
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function showStatusNotification(status: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  const msg = NOTIFICATION_MESSAGES[status]
  if (!msg) return
  new Notification(msg.title, { body: msg.body, icon: '/favicon.ico' })
}

export function BookingPage() {
  const navigate = useNavigate()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const markerARef = useRef<maplibregl.Marker | null>(null)
  const markerBRef = useRef<maplibregl.Marker | null>(null)
  const decorativeMarkersRef = useRef<maplibregl.Marker[]>([])
  const activeCarMarkerRef = useRef<maplibregl.Marker | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchSeqRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelScrollRef = useRef<HTMLDivElement>(null)
  const isProgrammaticMoveRef = useRef(false)
  const hasActiveOrderRef = useRef(false)
  const pointARef = useRef<Point | null>(null)
  const pointBRef = useRef<Point | null>(null)
  const fieldTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOrderStatusRef = useRef<string | null>(null)
  const arrivedAtRef = useRef<number | null>(null)
  const routeInfoRef = useRef<RouteInfo | null>(null)
  const simulationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const simulationFrameRef = useRef<number | null>(null)
  const simulationRunIdRef = useRef(0)

  const [mapDragging, setMapDragging] = useState(false)
  // displayField drives the floating marker visuals and lags behind activeField during pan
  const [displayField, setDisplayField] = useState<ActiveField>('B')
  // true while the camera is flying between fields — hides floating marker, keeps both static
  const [isFieldTransitioning, setIsFieldTransitioning] = useState(false)

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
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [simPhase, setSimPhase] = useState<SimPhase>('idle')
  const [assignedDriver, setAssignedDriver] = useState<TariffDriverPreset | null>(null)
  const [activeCarSimulation, setActiveCarSimulation] = useState<ActiveCarSimulation | null>(null)
  const [waitingSeconds, setWaitingSeconds] = useState(0)
  const [approachRouteCoords, setApproachRouteCoords] = useState<LngLat[]>([])
  const [tripRouteCoords, setTripRouteCoords] = useState<LngLat[]>([])

  const [activeOrderId, setActiveOrderId] = useState<number | null>(() => {
    const stored = localStorage.getItem(ACTIVE_ORDER_KEY)
    return stored ? parseInt(stored, 10) : null
  })
  const [activeOrder, setActiveOrder] = useState<OrderOut | null>(null)
  const [panelPage, setPanelPage] = useState(0)
  const [tripAnimated, setTripAnimated] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [completedSummary, setCompletedSummary] = useState<CompletedSummary | null>(null)

  function clearSimulationTimers() {
    simulationTimersRef.current.forEach((timer) => clearTimeout(timer))
    simulationTimersRef.current = []
  }

  function stopSimulationAnimation() {
    if (simulationFrameRef.current !== null) {
      cancelAnimationFrame(simulationFrameRef.current)
      simulationFrameRef.current = null
    }
  }

  function invalidateSimulation() {
    simulationRunIdRef.current += 1
    clearSimulationTimers()
    stopSimulationAnimation()
  }

  function queueSimulationTimer(callback: () => void, delay: number) {
    const timer = setTimeout(callback, delay)
    simulationTimersRef.current.push(timer)
    return timer
  }

  function syncRouteSource(sourceId: string, coordinates: LngLat[]) {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
    source?.setData(lineFeatureFromCoordinates(coordinates))
  }

  function hideDecorativeCar(index: number | null, hidden: boolean) {
    if (index === null) return
    const marker = decorativeMarkersRef.current[index]
    if (marker) marker.getElement().style.opacity = hidden ? '0.12' : '1'
  }

  function removeActiveCarMarker() {
    activeCarMarkerRef.current?.remove()
    activeCarMarkerRef.current = null
    setActiveCarSimulation(null)
  }

  function ensureActiveCarMarker(coordinate: LngLat, heading: number, color: string) {
    const map = mapRef.current
    if (!map) return null

    if (!activeCarMarkerRef.current) {
      activeCarMarkerRef.current = new maplibregl.Marker({
        element: createDecorativeCarElement(heading, color, 32),
        anchor: 'center',
      })
        .setLngLat(coordinate)
        .addTo(map)
    } else {
      activeCarMarkerRef.current.setLngLat(coordinate)
    }

    updateCarElementRotation(activeCarMarkerRef.current, heading)
    return activeCarMarkerRef.current
  }

  function fitMapToRoute(coordinates: LngLat[]) {
    const map = mapRef.current
    if (!map || coordinates.length < 2) return

    const bounds = coordinates.reduce(
      (acc, coord) => acc.extend(coord as [number, number]),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    )

    isProgrammaticMoveRef.current = true
    map.fitBounds(bounds, {
      padding: { top: 80, left: 48, right: 48, bottom: 260 },
      duration: 900,
    })
  }

  function updateOrderLocally(status: OrderOut['status']) {
    setActiveOrder((current) => (current ? { ...current, status } : current))
  }

  async function syncOrderStatus(status: OrderOut['status']) {
    if (!activeOrder) return
    updateOrderLocally(status)
    try {
      const updated = await orders.updateStatus(activeOrder.id, status)
      setActiveOrder(updated)
    } catch {
      // ignore backend sync errors during demo simulation
    }
  }

  function resetSimulationState() {
    invalidateSimulation()
    hideDecorativeCar(activeCarSimulation?.markerIndex ?? null, false)
    setAssignedDriver(null)
    setSimPhase('idle')
    setWaitingSeconds(0)
    setApproachRouteCoords([])
    setTripRouteCoords([])
    syncRouteSource(APPROACH_ROUTE_SOURCE_ID, [])
    syncRouteSource(TRIP_ROUTE_SOURCE_ID, [])
    removeActiveCarMarker()
  }

  function animateMarkerAlongRoute(
    coordinates: LngLat[],
    durationMs: number,
    color: string,
    markerIndex: number,
    runId: number,
    onDone: () => void,
  ) {
    if (!coordinates.length) {
      onDone()
      return
    }

    const startedAt = performance.now()
    hideDecorativeCar(markerIndex, true)

    const step = (now: number) => {
      if (simulationRunIdRef.current !== runId) return

      const progress = clamp((now - startedAt) / durationMs, 0, 1)
      const scaledIndex = progress * (coordinates.length - 1)
      const index = Math.min(Math.floor(scaledIndex), coordinates.length - 2)
      const nextIndex = Math.min(index + 1, coordinates.length - 1)
      const localProgress = scaledIndex - index
      const from = coordinates[index]
      const to = coordinates[nextIndex]
      const lng = from[0] + (to[0] - from[0]) * localProgress
      const lat = from[1] + (to[1] - from[1]) * localProgress
      const heading = getHeading(from, to)
      const coordinate: LngLat = [lng, lat]

      ensureActiveCarMarker(coordinate, heading, color)
      setActiveCarSimulation({ markerIndex, coordinate, heading })

      if (progress >= 1) {
        simulationFrameRef.current = null
        onDone()
        return
      }

      simulationFrameRef.current = requestAnimationFrame(step)
    }

    stopSimulationAnimation()
    simulationFrameRef.current = requestAnimationFrame(step)
  }

  useEffect(() => {
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
      .catch(() => setDataLoading(false))
  }, [])

  // Animate trip content in when order becomes active
  useEffect(() => {
    if (activeOrderId) {
      setTripAnimated(false)
      const t = setTimeout(() => setTripAnimated(true), 20)
      return () => clearTimeout(t)
    } else {
      setTripAnimated(false)
    }
  }, [activeOrderId])

  // Poll active order status
  useEffect(() => {
    if (!activeOrderId) return

    // Unauthenticated users can't have active orders — clear stale localStorage entry
    if (!getToken()) {
      localStorage.removeItem(ACTIVE_ORDER_KEY)
      setActiveOrderId(null)
      return
    }

    async function poll() {
      try {
        const order = await orders.get(activeOrderId!)
        const prevStatus = prevOrderStatusRef.current
        if (prevStatus !== null && prevStatus !== order.status) {
          showStatusNotification(order.status)
        }
        prevOrderStatusRef.current = order.status

        if (order.status === 'arrived' && arrivedAtRef.current === null) {
          arrivedAtRef.current = Date.now()
        }

        setActiveOrder(order)
        if (order.status === 'completed') {
          const waitSeconds = arrivedAtRef.current
            ? (Date.now() - arrivedAtRef.current) / 1000
            : 0
          setCompletedSummary({
            price: order.price,
            waitSeconds,
            tripSeconds: routeInfoRef.current ? routeInfoRef.current.time / 1000 : null,
          })
          localStorage.removeItem(ACTIVE_ORDER_KEY)
          setActiveOrderId(null)
          setActiveOrder(null)
          arrivedAtRef.current = null
        } else if (order.status === 'cancelled') {
          showStatusNotification('cancelled')
          localStorage.removeItem(ACTIVE_ORDER_KEY)
          setActiveOrderId(null)
          setActiveOrder(null)
        }
      } catch {
        // ignore polling errors
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [activeOrderId])

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

    map.on('load', () => {
      mapLoadedRef.current = true
      decorativeMarkersRef.current = DECORATIVE_CAR_COORDINATES.map(([lng, lat], index) => (
        new maplibregl.Marker({
          element: createDecorativeCarElement((index * 29) % 360),
          anchor: 'center',
        })
          .setLngLat([lng, lat])
          .addTo(map)
      ))

      map.addSource('route', {
        type: 'geojson',
        data: emptyFeatureCollection(),
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FC6500', 'line-width': 4, 'line-opacity': 0.85 },
      })

      map.addSource(APPROACH_ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: emptyFeatureCollection(),
      })
      map.addLayer({
        id: APPROACH_ROUTE_SOURCE_ID,
        type: 'line',
        source: APPROACH_ROUTE_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#2A3037',
          'line-width': 4,
          'line-opacity': 0.55,
          'line-dasharray': [1.5, 1.2],
        },
      })

      map.addSource(TRIP_ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: emptyFeatureCollection(),
      })
      map.addLayer({
        id: TRIP_ROUTE_SOURCE_ID,
        type: 'line',
        source: TRIP_ROUTE_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FC6500', 'line-width': 5, 'line-opacity': 0.95 },
      })
    })

    map.on('movestart', () => {
      if (!isProgrammaticMoveRef.current) {
        setMapDragging(true)
      }
    })

    map.on('moveend', async () => {
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false
        setMapDragging(false)
        return
      }
      setMapDragging(false)

      if (hasActiveOrderRef.current) return

      const { lng, lat } = map.getCenter()
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
      } catch {
        // ignore
      }
    })

    mapRef.current = map

    return () => {
      invalidateSimulation()
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
      decorativeMarkersRef.current = []
      activeCarMarkerRef.current = null
      markerARef.current = null
      markerBRef.current = null
    }
  }, [qrLocation])

  // Sync state → refs so pan/marker effects can read current values without stale closures
  useEffect(() => { pointARef.current = pointA }, [pointA])
  useEffect(() => { pointBRef.current = pointB }, [pointB])
  useEffect(() => { hasActiveOrderRef.current = !!activeOrderId }, [activeOrderId])
  useEffect(() => { routeInfoRef.current = routeInfo }, [routeInfo])

  // Show/hide maplibre markers:
  // - Normally: only the INACTIVE point has a static marker
  // - During field transition: BOTH points have static markers (target visible during flight)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const hasActiveOrder = !!activeOrderId
    const showA = hasActiveOrder ? !!pointA : (isFieldTransitioning ? !!pointA : (activeField !== 'A' && !!pointA))
    const showB = hasActiveOrder ? !!pointB : (isFieldTransitioning ? !!pointB : (activeField !== 'B' && !!pointB))

    if (showA && pointA) {
      if (markerARef.current) {
        markerARef.current.setLngLat([pointA.lng, pointA.lat])
      } else {
        markerARef.current = new maplibregl.Marker({ color: '#FC6500' })
          .setLngLat([pointA.lng, pointA.lat])
          .addTo(map)
      }
    } else {
      markerARef.current?.remove()
      markerARef.current = null
    }

    if (showB && pointB) {
      if (markerBRef.current) {
        markerBRef.current.setLngLat([pointB.lng, pointB.lat])
      } else {
        markerBRef.current = new maplibregl.Marker({ color: '#2A3037' })
          .setLngLat([pointB.lng, pointB.lat])
          .addTo(map)
      }
    } else {
      markerBRef.current?.remove()
      markerBRef.current = null
    }
  }, [activeField, pointA, pointB, isFieldTransitioning, activeOrderId])

  // When switching active field:
  //   1. isFieldTransitioning=true → floating marker hides, both static markers visible
  //   2. camera flies to target point
  //   3. after flight: isFieldTransitioning=false + displayField switches → static target
  //      marker is replaced by floating center marker
  useEffect(() => {
    if (fieldTransitionTimerRef.current) clearTimeout(fieldTransitionTimerRef.current)

    const map = mapRef.current
    if (!map) return

    const target = activeField === 'A' ? pointARef.current : pointBRef.current
    if (target) {
      setIsFieldTransitioning(true)
      isProgrammaticMoveRef.current = true
      map.easeTo({ center: [target.lng, target.lat], duration: 350 })
      fieldTransitionTimerRef.current = setTimeout(() => {
        setIsFieldTransitioning(false)
        setDisplayField(activeField)
      }, 350)
    } else {
      setIsFieldTransitioning(false)
      setDisplayField(activeField)
    }
  }, [activeField]) // intentionally exclude pointA/pointB — only fire on field switch

  useEffect(() => {
    const map = mapRef.current

    if (!map || !pointA || !pointB || activeOrderId) {
      setRouteInfo(null)
      const src = map?.getSource('route') as maplibregl.GeoJSONSource | undefined
      src?.setData(emptyFeatureCollection())
      return
    }

    function apply() {
      if (!map || !pointA || !pointB) return

      maps.route([
        { latitude: pointA.lat, longitude: pointA.lng },
        { latitude: pointB.lat, longitude: pointB.lng },
      ])
        .then((route) => {
          setRouteInfo({ distance: route.distance, time: route.time })
          const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
          src?.setData(lineFeatureFromCoordinates(route.coordinates as LngLat[]))
        })
        .catch(() => {
          setRouteInfo(null)
          const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined
          src?.setData(emptyFeatureCollection())
        })
    }

    if (mapLoadedRef.current) apply()
    else map.once('load', apply)
  }, [pointA, pointB, activeOrderId])

  useEffect(() => {
    syncRouteSource(APPROACH_ROUTE_SOURCE_ID, approachRouteCoords)
  }, [approachRouteCoords])

  useEffect(() => {
    syncRouteSource(TRIP_ROUTE_SOURCE_ID, tripRouteCoords)
  }, [tripRouteCoords])

  useEffect(() => {
    if (!activeOrder || simPhase !== 'idle') return

    const preset = resolveDriverPreset(activeOrder.tariff_name)
    setAssignedDriver(preset)

    if (activeOrder.status === 'searching') {
      setSimPhase('searchingModal')
    } else if (activeOrder.status === 'assigned') {
      setSimPhase('assignedPreview')
    } else if (activeOrder.status === 'driving') {
      setSimPhase('approachingPickup')
    } else if (activeOrder.status === 'arrived') {
      setSimPhase('waitingAtPickup')
    }
  }, [activeOrder, simPhase])

  useEffect(() => {
    clearSimulationTimers()

    if (!activeOrder) return

    if (simPhase === 'searchingModal') {
      const runId = simulationRunIdRef.current
      queueSimulationTimer(async () => {
        if (simulationRunIdRef.current !== runId) return
        setAssignedDriver(resolveDriverPreset(activeOrder.tariff_name))
        await syncOrderStatus(SIM_PHASE_TO_ORDER_STATUS.assignedPreview)
        setSimPhase('assignedPreview')
      }, SIM_TIMINGS.searchMs)
    }

    if (simPhase === 'assignedPreview') {
      queueSimulationTimer(async () => {
        const runId = ++simulationRunIdRef.current
        if (!pointA) return

        const driver = assignedDriver ?? resolveDriverPreset(activeOrder.tariff_name)
        setAssignedDriver(driver)

        const pickupPoint: LngLat = [pointA.lng, pointA.lat]
        const markerIndex = pickNearestDecorativeCar(pickupPoint)
        const start = DECORATIVE_CAR_COORDINATES[markerIndex]

        let coordinates: LngLat[] = [start, pickupPoint]
        let distance = 0

        try {
          const route = await maps.route([
            { latitude: start[1], longitude: start[0] },
            { latitude: pickupPoint[1], longitude: pickupPoint[0] },
          ])
          coordinates = route.coordinates as LngLat[]
          distance = route.distance
        } catch {
          // fallback to straight line for demo
        }

        if (simulationRunIdRef.current !== runId) return

        setApproachRouteCoords(coordinates)
        setTripRouteCoords([])
        fitMapToRoute(coordinates)
        setSimPhase('approachingPickup')
        await syncOrderStatus(SIM_PHASE_TO_ORDER_STATUS.approachingPickup)

        const duration = clamp((distance || coordinates.length * 25) * 8, SIM_TIMINGS.minApproachMs, SIM_TIMINGS.maxApproachMs)
        animateMarkerAlongRoute(coordinates, duration, driver.carColor, markerIndex, runId, async () => {
          if (simulationRunIdRef.current !== runId) return
          setWaitingSeconds(0)
          setApproachRouteCoords([])
          await syncOrderStatus(SIM_PHASE_TO_ORDER_STATUS.waitingAtPickup)
          setSimPhase('waitingAtPickup')
        })
      }, SIM_TIMINGS.assignedPreviewMs)
    }

    return () => {
      clearSimulationTimers()
    }
  }, [simPhase, activeOrder, pointA, assignedDriver])

  useEffect(() => {
    if (simPhase !== 'waitingAtPickup') return
    const timer = setInterval(() => setWaitingSeconds((current) => current + 1), 1000)
    return () => clearInterval(timer)
  }, [simPhase])

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

  function handlePanelScroll() {
    const el = panelScrollRef.current
    if (!el) return
    setPanelPage(Math.round(el.scrollLeft / el.offsetWidth))
  }

  const visibleTariffs = getTariffsForPeriod(tariffList, selectedPeriod)
  const tariff = visibleTariffs.find((item) => item.id === selectedTariff) ?? null
  const selectedTariffPrice = tariff ? calculateTariffPrice(tariff, routeInfo) : null

  function handlePeriodChange(period: TariffPeriod) {
    setSelectedPeriod(period)
  }

  function handleConfirm() {
    if (!pointA || !pointB || !tariff) return
    setSubmitError('')
    setCheckoutOpen(true)
  }

  async function handleCreateOrder() {
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
      localStorage.setItem(ACTIVE_ORDER_KEY, String(order.id))
      prevOrderStatusRef.current = order.status
      requestNotificationPermission()
      invalidateSimulation()
      setActiveOrderId(order.id)
      setActiveOrder(order)
      setAssignedDriver(resolveDriverPreset(tariff.name))
      setWaitingSeconds(0)
      setApproachRouteCoords([])
      setTripRouteCoords([])
      setSimPhase('searchingModal')
      setCheckoutOpen(false)
      // Reset panel to slide 0 (trip slide)
      setPanelPage(0)
      if (panelScrollRef.current) panelScrollRef.current.scrollLeft = 0
    } catch (error: any) {
      setSubmitError(error.message ?? 'Ошибка создания заказа')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelOrder() {
    if (!activeOrder) return
    resetSimulationState()
    try {
      await orders.updateStatus(activeOrder.id, 'cancelled')
    } catch {
      // ignore
    }
    localStorage.removeItem(ACTIVE_ORDER_KEY)
    setActiveOrderId(null)
    setActiveOrder(null)
  }

  async function handleCompleteOrder() {
    if (!activeOrder) return
    const waitSeconds = arrivedAtRef.current
      ? (Date.now() - arrivedAtRef.current) / 1000
      : 0
    resetSimulationState()
    try {
      await orders.updateStatus(activeOrder.id, 'completed')
    } catch {
      // ignore
    }
    setCompletedSummary({
      price: activeOrder.price,
      waitSeconds,
      tripSeconds: routeInfo ? routeInfo.time / 1000 : null,
    })
    localStorage.removeItem(ACTIVE_ORDER_KEY)
    setActiveOrderId(null)
    setActiveOrder(null)
    arrivedAtRef.current = null
  }

  async function handleArrivedAtPickup() {
    if (!activeOrder || !pointA || simPhase !== 'waitingAtPickup') return

    const destinationLng = pointB?.lng ?? activeOrder.destination_lng
    const destinationLat = pointB?.lat ?? activeOrder.destination_lat
    if (destinationLng == null || destinationLat == null) return

    const runId = ++simulationRunIdRef.current
    clearSimulationTimers()
    stopSimulationAnimation()

    const driver = assignedDriver ?? resolveDriverPreset(activeOrder.tariff_name)
    setAssignedDriver(driver)

    const tripStart: LngLat = activeCarSimulation?.coordinate ?? [pointA.lng, pointA.lat]
    const destination: LngLat = [destinationLng, destinationLat]

    let coordinates: LngLat[] = [tripStart, destination]
    let distance = 0

    try {
      const route = await maps.route([
        { latitude: tripStart[1], longitude: tripStart[0] },
        { latitude: destination[1], longitude: destination[0] },
      ])
      coordinates = route.coordinates as LngLat[]
      distance = route.distance
    } catch {
      // fallback to straight line for demo
    }

    if (simulationRunIdRef.current !== runId) return

    setApproachRouteCoords([])
    setTripRouteCoords(coordinates)
    fitMapToRoute(coordinates)
    setSimPhase('inTrip')
    await syncOrderStatus(SIM_PHASE_TO_ORDER_STATUS.inTrip)

    const duration = clamp((distance || coordinates.length * 30) * 9, SIM_TIMINGS.minTripMs, SIM_TIMINGS.maxTripMs)
    animateMarkerAlongRoute(
      coordinates,
      duration,
      driver.carColor,
      activeCarSimulation?.markerIndex ?? pickNearestDecorativeCar(tripStart),
      runId,
      () => {
        handleCompleteOrder()
      },
    )
  }

  const hasActiveTrip = !!activeOrder
  const searchSimulationOpen = simPhase === 'searchingModal'

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-[3px] border-brand-orange border-t-transparent rounded-full animate-spin" />
        {searchSimulationOpen && (
          <div className="absolute inset-0 z-30 bg-black/18 backdrop-blur-[1px] flex items-start justify-center px-4 pt-24">
            <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[22px] font-bold text-text-primary">Поиск</p>
                  <p className="text-sm text-text-muted mt-1">Ищем таксиста рядом с вами</p>
                </div>
                <div className="w-12 h-12 rounded-full border-[3px] border-brand-orange/20 border-t-brand-orange animate-spin" />
              </div>

              <div className="mt-5 rounded-2xl bg-surface-warm px-4 py-3">
                <p className="text-sm font-semibold text-text-primary">{SIM_PHASE_MESSAGES.searchingModal}</p>
                <p className="text-xs text-text-muted mt-1">
                  Подбираем ближайшую машину и назначаем водителя
                </p>
              </div>
            </div>
          </div>
        )}

        {searchSimulationOpen && (
          <div className="absolute inset-0 z-30 bg-black/18 backdrop-blur-[1px] flex items-start justify-center px-4 pt-24">
            <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[22px] font-bold text-text-primary">Поиск</p>
                  <p className="text-sm text-text-muted mt-1">Ищем таксиста рядом с вами</p>
                </div>
                <div className="w-12 h-12 rounded-full border-[3px] border-brand-orange/20 border-t-brand-orange animate-spin" />
              </div>
              <div className="mt-5 rounded-2xl bg-surface-warm px-4 py-3">
                <p className="text-sm font-semibold text-text-primary">{SIM_PHASE_MESSAGES.searchingModal}</p>
                <p className="text-xs text-text-muted mt-1">Подбираем ближайшую машину и назначаем водителя</p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <div className="relative flex-1 min-h-0">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Floating center marker — hidden during field transition */}
        {!hasActiveTrip && !isFieldTransitioning && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Shadow dot at map center */}
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translateX(-50%) translateY(-50%) scale(${mapDragging ? 0.5 : 1})`,
                transition: 'transform 0.2s ease-out',
                width: 14,
                height: 6,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.22)',
              }}
            />
            {/* Pin — tip aligned to map center */}
            <div
              className="absolute left-1/2 top-1/2 flex flex-col items-center"
              style={{
                transform: mapDragging
                  ? 'translateX(-50%) translateY(calc(-100% - 10px))'
                  : 'translateX(-50%) translateY(-100%)',
                transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div
                className={[
                  'w-10 h-10 rounded-full flex items-center justify-center shadow-lg',
                  displayField === 'A' ? 'bg-brand-orange' : 'bg-[#2A3037]',
                ].join(' ')}
              >
                <span className="text-white text-sm font-bold">{displayField}</span>
              </div>
              {/* Triangle tail */}
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: displayField === 'A' ? '10px solid #FC6500' : '10px solid #2A3037',
                }}
              />
            </div>
          </div>
        )}

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

        {!hasActiveTrip && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-brand-dark/80 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full whitespace-nowrap pointer-events-none">
            {displayField === 'A'
              ? 'Переместите карту, чтобы изменить точку А'
              : (!pointB ? 'Переместите карту, чтобы выбрать точку Б' : 'Переместите карту, чтобы изменить точку Б')}
          </div>
        )}
      </div>

      {/* Bottom panel — 2-slide horizontal scroll */}
      <div className="bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.10)] flex-shrink-0 z-20">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div
          ref={panelScrollRef}
          className="flex overflow-x-auto"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
          onScroll={handlePanelScroll}
        >
          {/* ── Slide 0: booking form OR active trip OR completed summary ── */}
          <div className="flex-shrink-0 w-full" style={{ scrollSnapAlign: 'start' }}>
            {completedSummary ? (
              /* Completed summary — shown in-place after trip ends */
              <div className="transition-all duration-300 ease-out" style={{ opacity: 1 }}>
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-4 mb-2">
                  Главное
                </p>
                <div className="px-4 pb-4">
                  <CompletedSlide
                    summary={completedSummary}
                    onRepeat={() => {
                      setCompletedSummary(null)
                      navigate(getRepeatScanPath())
                    }}
                  />
                </div>
              </div>
            ) : hasActiveTrip && activeOrder ? (
              /* Trip view — slides in via opacity+translate transition */
              <div
                className="transition-all duration-300 ease-out"
                style={{
                  opacity: tripAnimated ? 1 : 0,
                  transform: tripAnimated ? 'translateX(0)' : 'translateX(24px)',
                }}
              >
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-4 mb-2">
                  Главное
                </p>
                <div className="px-4 pb-4">
                  <TripSlide
                    order={activeOrder}
                    pickupAddress={pointA?.address ?? activeOrder.location_name ?? '—'}
                    destinationAddress={pointB?.address ?? activeOrder.destination_address}
                    ratingValue={ratingValue}
                    onRate={setRatingValue}
                    onCancel={handleCancelOrder}
                    simPhase={simPhase}
                    driver={assignedDriver}
                    waitingSeconds={waitingSeconds}
                    onArrivedAtPickup={handleArrivedAtPickup}
                  />
                </div>
              </div>
            ) : (
              /* Booking form */
              <div>
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-4 mb-2">
                  Главное
                </p>
                <div className="px-4 pt-0 pb-1">
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
            )}
          </div>

          {/* ── Slide 1: weather & surcharge (inactive appearance during active trip) ── */}
          <div className="flex-shrink-0 w-full" style={{ scrollSnapAlign: 'start' }}>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-4 mb-2">
              Важное
            </p>
            <div className="px-4 pb-4 flex flex-col gap-3">
              <WeatherSlide inactive={hasActiveTrip} />
              <BonusGameBanner />
            </div>
          </div>
        </div>

        {/* Page dots — always 2 slides */}
        <div className="flex justify-center gap-1.5 py-2">
          <div
            className={[
              'rounded-full transition-all duration-200',
              panelPage === 0 ? 'w-4 h-1.5 bg-brand-orange' : 'w-1.5 h-1.5 bg-gray-300',
            ].join(' ')}
          />
          <div
            className={[
              'rounded-full transition-all duration-200',
              panelPage === 1 ? 'w-4 h-1.5 bg-brand-orange' : 'w-1.5 h-1.5 bg-gray-300',
            ].join(' ')}
          />
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

      {checkoutOpen && (
        <CheckoutModal
          onClose={() => { setCheckoutOpen(false); setSubmitError('') }}
          onConfirm={handleCreateOrder}
          submitting={submitting}
          submitError={submitError}
        />
      )}
    </div>
  )
}

// ─── Widget slides ────────────────────────────────────────────────────────────

function TripSlide({
  order,
  simPhase,
  driver,
  pickupAddress,
  destinationAddress,
  waitingSeconds,
  ratingValue,
  onRate,
  onCancel,
  onArrivedAtPickup,
}: {
  order: OrderOut
  simPhase: SimPhase
  driver: TariffDriverPreset | null
  pickupAddress: string
  destinationAddress: string
  waitingSeconds: number
  ratingValue: number
  onRate: (v: number) => void
  onCancel: () => void
  onArrivedAtPickup: () => void
}) {
  const progressStatus = simPhase === 'idle'
    ? order.status
    : simPhase === 'searchingModal'
      ? 'searching'
      : simPhase === 'assignedPreview'
        ? 'assigned'
        : simPhase === 'approachingPickup' || simPhase === 'inTrip'
          ? 'driving'
          : 'arrived'
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === progressStatus)
  const waitingLabel = `${Math.floor(waitingSeconds / 60).toString().padStart(2, '0')}:${(waitingSeconds % 60).toString().padStart(2, '0')}`
  const canCancel = simPhase === 'searchingModal' || simPhase === 'assignedPreview' || simPhase === 'approachingPickup' || simPhase === 'waitingAtPickup'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[11px] text-text-muted font-medium">Заказ #{order.id}</p>
        <p className="text-[15px] font-bold text-text-primary leading-tight mt-0.5">
          {SIM_PHASE_MESSAGES[simPhase] || STATUS_MESSAGES[order.status] || order.status}
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5">
          {STATUS_STEPS.map((step, idx) => {
            const done = idx <= currentIdx
            const active = idx === currentIdx
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={[
                    'w-full h-1.5 rounded-full transition-colors',
                    done ? 'bg-brand-orange' : 'bg-gray-200',
                  ].join(' ')}
                />
                <span
                  className={[
                    'text-[10px] font-medium',
                    active ? 'text-brand-orange' : done ? 'text-text-muted' : 'text-gray-300',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {driver && (
        <div className="mx-4 mb-3 rounded-xl border border-gray-100 bg-white px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: driver.avatarBg }}>
                <span className="text-sm font-bold text-white">{driver.avatarText}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{driver.driverName}</p>
                <p className="text-xs text-text-muted truncate">{driver.carModel}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-text-primary">{driver.plate}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{order.tariff_name ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-4 mb-3 rounded-xl bg-surface-base px-3 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-brand-orange flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-white">А</span>
            </div>
            <span className="text-xs font-medium text-text-primary truncate">{pickupAddress}</span>
          </div>
          <div className="w-px h-2.5 bg-gray-200 ml-2.5" />
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full border-2 border-brand-dark flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-brand-dark">Б</span>
            </div>
            <span className="text-xs font-medium text-text-primary truncate">{destinationAddress || '—'}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            {order.tariff_name ?? '—'} · {formatTariffPeriodLabel(order.tariff_period)}
          </span>
          <span className="text-[11px] font-semibold text-text-primary">{order.price} тг</span>
        </div>
      </div>

      {simPhase === 'waitingAtPickup' && (
        <div className="mx-4 -mt-1 mb-3 rounded-xl border border-gray-100 bg-white px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Ожидание клиента</span>
          <span className="text-sm font-semibold text-brand-orange">{waitingLabel}</span>
        </div>
      )}

      {/* Action button */}
      {simPhase === 'waitingAtPickup' ? (
        <div className="px-4 mb-3">
          <button
            onClick={onArrivedAtPickup}
            className="w-full h-10 rounded-full bg-brand-orange text-white text-sm font-medium"
          >
            Я на месте
          </button>
        </div>
      ) : canCancel ? (
        <div className="px-4 mb-3">
          <button
            onClick={onCancel}
            className="w-full h-10 rounded-full border-2 border-gray-200 text-text-muted text-sm font-medium"
          >
            Отменить заказ
          </button>
        </div>
      ) : null}

      {/* Rating */}
      <div className="mx-4 mb-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-text-muted mb-2">Оцените сервис</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onRate(star)}
              className="text-xl leading-none"
              aria-label={`${star} звезда`}
            >
              <span className={star <= ratingValue ? 'text-brand-orange' : 'text-gray-300'}>★</span>
            </button>
          ))}
        </div>
      </div>

      {/* App download */}
      <div className="mx-4 mb-3 rounded-xl bg-surface-warm px-3 py-2.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-text-primary">Скачайте приложение</p>
          <p className="text-[11px] text-text-muted mt-0.5">Удобнее и быстрее заказывать такси</p>
        </div>
        <div className="shrink-0 w-8 h-8 rounded-xl bg-brand-orange flex items-center justify-center">
          <span className="text-white text-xs font-bold">A</span>
        </div>
      </div>
    </div>
  )
}

function CompletedSlide({
  summary,
  onRepeat,
}: {
  summary: CompletedSummary
  onRepeat: () => void
}) {
  function formatSeconds(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60)
    const s = Math.round(totalSeconds % 60)
    if (m === 0) return `${s} сек`
    return `${m} мин ${s} сек`
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      {/* Success header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-warm flex items-center justify-center text-xl shrink-0">
          ✅
        </div>
        <div>
          <p className="text-[15px] font-bold text-text-primary leading-tight">Поездка завершена</p>
          <p className="text-xs text-text-muted mt-0.5">Спасибо, что воспользовались APARU</p>
        </div>
      </div>

      {/* Trip stats */}
      <div className="mx-4 mb-3 rounded-xl bg-surface-base px-3 py-3 flex flex-col gap-0">
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-text-muted">Ожидание водителя</span>
          <span className="text-xs font-semibold text-text-primary">{formatSeconds(summary.waitSeconds)}</span>
        </div>
        {summary.tripSeconds !== null && (
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <span className="text-xs text-text-muted">Время в пути</span>
            <span className="text-xs font-semibold text-text-primary">{formatSeconds(summary.tripSeconds)}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <span className="text-xs text-text-muted">Итоговая стоимость</span>
          <span className="text-sm font-bold text-brand-orange">{formatPrice(summary.price)}</span>
        </div>
      </div>

      {/* Repeat order button */}
      <div className="px-4 mb-3">
        <button
          onClick={onRepeat}
          className="w-full h-10 rounded-full bg-brand-orange text-white text-sm font-medium"
        >
          Повторить заказ
        </button>
      </div>

      {/* App download */}
      <div className="mx-4 mb-3 rounded-xl bg-surface-warm px-3 py-2.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-text-primary">Скачайте приложение</p>
          <p className="text-[11px] text-text-muted mt-0.5">Удобнее и быстрее заказывать такси</p>
        </div>
        <div className="shrink-0 w-8 h-8 rounded-xl bg-brand-orange flex items-center justify-center">
          <span className="text-white text-xs font-bold">A</span>
        </div>
      </div>
    </div>
  )
}

function BonusGameBanner() {
  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #FC6500 0%, #FF9533 60%, #FFB84D 100%)' }}
    >
      {/* Decorative % in background */}
      <span
        className="absolute -top-3 left-3 text-[80px] font-black leading-none select-none pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.12)' }}
      >
        %
      </span>

      {/* Car SVG — side view, rotated diagonally */}
      <div className="absolute right-0 bottom-0 -rotate-12 translate-x-3 translate-y-2 pointer-events-none">
        <svg width="110" height="64" viewBox="0 0 110 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Body */}
          <rect x="6" y="30" width="98" height="20" rx="7" fill="white" fillOpacity="0.92" />
          {/* Cabin roof */}
          <path d="M24 30 C26 20 33 13 42 12 L68 12 C77 12 84 19 86 30Z" fill="white" fillOpacity="0.92" />
          {/* Windshield + rear window */}
          <path d="M28 28 C30 21 35 16 42 15 L52 15 L52 28Z" fill="#FC6500" fillOpacity="0.55" />
          <path d="M58 15 L68 15 C75 16 80 21 82 28 L58 28Z" fill="#FC6500" fillOpacity="0.55" />
          {/* Door split */}
          <line x1="55" y1="30" x2="55" y2="50" stroke="white" strokeOpacity="0.35" strokeWidth="1" />
          {/* Rear wheel arch */}
          <path d="M6 44 Q6 50 14 50" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" fill="none" />
          {/* Front bumper line */}
          <path d="M104 38 Q107 42 104 50" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" fill="none" />
          {/* Left wheel */}
          <circle cx="26" cy="50" r="11" fill="#E05600" />
          <circle cx="26" cy="50" r="7" fill="#C04800" />
          <circle cx="26" cy="50" r="3.5" fill="white" fillOpacity="0.7" />
          {/* Right wheel */}
          <circle cx="84" cy="50" r="11" fill="#E05600" />
          <circle cx="84" cy="50" r="7" fill="#C04800" />
          <circle cx="84" cy="50" r="3.5" fill="white" fillOpacity="0.7" />
          {/* Headlight */}
          <rect x="100" y="34" width="5" height="7" rx="2" fill="white" fillOpacity="0.8" />
          {/* Tail light */}
          <rect x="5" y="34" width="4" height="7" rx="2" fill="white" fillOpacity="0.5" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 py-4 pr-28">
        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Бонусная программа</p>
        <p className="text-[15px] font-bold text-white leading-snug">
          Играй, чтобы<br />получить бонусы
        </p>
        <button
          type="button"
          className="mt-3 bg-white text-brand-orange text-xs font-bold px-4 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform"
        >
          Играть →
        </button>
      </div>
    </div>
  )
}

function WeatherSlide({ inactive }: { inactive: boolean }) {
  return (
    <div
      className={[
        'rounded-2xl border border-gray-100 bg-white px-4 py-3 flex items-center justify-between gap-4 transition-opacity duration-300',
        inactive ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
    >
      {/* Left: weather */}
      <div className="flex items-center gap-2">
        <WeatherIcon />
        <div>
          <p className="text-xl font-bold text-text-primary leading-none">—°C</p>
          <p className="text-[11px] text-text-muted mt-0.5">Погода</p>
        </div>
      </div>

      <div className="w-px h-10 bg-gray-100" />

      {/* Right: surcharge */}
      <div className="text-right">
        <p className="text-xl font-bold text-text-primary leading-none">+—%</p>
        <p className="text-[11px] text-text-muted mt-0.5">Наценка</p>
      </div>
    </div>
  )
}

// ─── Booking-form inner components ────────────────────────────────────────────

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

// ─── Icons ────────────────────────────────────────────────────────────────────

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

function WeatherIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-text-muted">
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="1.8" />
      <line x1="16" y1="2" x2="16" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="27" x2="16" y2="30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="2" y1="16" x2="5" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="27" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="6.34" y1="6.34" x2="8.46" y2="8.46" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="23.54" y1="23.54" x2="25.66" y2="25.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="25.66" y1="6.34" x2="23.54" y2="8.46" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8.46" y1="23.54" x2="6.34" y2="25.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


