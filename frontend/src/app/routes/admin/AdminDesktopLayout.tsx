import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { orders, locations, tariffs } from '@/lib/services/api'
import type { OrderOut, LocationOut, TariffOut, TariffPeriod } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import QRCode from 'qrcode'

type Tab = 'dashboard' | 'orders' | 'locations' | 'tariffs'

// ─────────────────────────────────────────────
// Root layout
// ─────────────────────────────────────────────

export function AdminDesktopLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const initialTab = (location.state as { tab?: Tab } | null)?.tab ?? 'dashboard'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div className="hidden md:flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Админ-панель</p>
          <p className="text-lg font-bold text-text-primary leading-tight">APARU</p>
        </div>

        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          <NavItem
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            icon={<IconDashboard />}
            label="Дашборд"
          />
          <NavItem
            active={activeTab === 'orders'}
            onClick={() => setActiveTab('orders')}
            icon={<IconOrders />}
            label="Заказы"
          />
          <NavItem
            active={activeTab === 'locations'}
            onClick={() => setActiveTab('locations')}
            icon={<IconLocations />}
            label="QR-точки"
          />
          <NavItem
            active={activeTab === 'tariffs'}
            onClick={() => setActiveTab('tariffs')}
            icon={<IconTariffs />}
            label="Тарифы"
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => { logout(); navigate('/admin/login') }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <IconLogout />
            Выйти
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeTab === 'dashboard' && <DashboardPanel setActiveTab={setActiveTab} />}
        {activeTab === 'orders' && <OrdersPanel />}
        {activeTab === 'locations' && <LocationsPanel />}
        {activeTab === 'tariffs' && <TariffsPanel />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// NavItem
// ─────────────────────────────────────────────

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left transition-colors',
        active
          ? 'bg-brand-orange/10 text-brand-orange'
          : 'text-text-muted hover:bg-gray-50 hover:text-text-primary',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────
// Dashboard panel
// ─────────────────────────────────────────────

function DashboardPanel({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [orderList, setOrderList] = useState<OrderOut[]>([])
  const [locationList, setLocationList] = useState<LocationOut[]>([])
  const [tariffList, setTariffList] = useState<TariffOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/admin/login'); return }
    Promise.all([orders.list(), locations.list(), tariffs.list()])
      .then(([o, l, t]) => { setOrderList(o); setLocationList(l); setTariffList(t) })
      .finally(() => setLoading(false))
  }, [user, navigate])

  const completed = orderList.filter((o) => o.status === 'completed')
  const cancelled = orderList.filter((o) => o.status === 'cancelled')
  const active    = orderList.filter((o) => !['completed', 'cancelled'].includes(o.status))

  const conversionRate = orderList.length > 0
    ? Math.round((completed.length / orderList.length) * 100)
    : 0

  const avgPrice = completed.length > 0
    ? Math.round(completed.reduce((sum, o) => sum + o.price, 0) / completed.length)
    : 0

  const locationCounts = orderList.reduce<Record<string, number>>((acc, o) => {
    const name = o.location_name ?? '—'
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {})
  const topLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="flex flex-col flex-1 p-8 overflow-y-auto gap-6">
      <h1 className="text-xl font-bold text-text-primary">Дашборд</h1>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Row 1: main stat cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Всего заказов" value={orderList.length} color="bg-blue-50 text-blue-600" />
            <StatCard label="Активных"      value={active.length}    color="bg-orange-50 text-brand-orange" />
            <StatCard label="Завершено"     value={completed.length} color="bg-green-50 text-green-600" />
            <StatCard label="Отменено"      value={cancelled.length} color="bg-red-50 text-red-500" />
          </div>

          {/* Row 2: chart + extra stats */}
          <div className="grid grid-cols-3 gap-4">
            {/* Activity chart */}
            <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-semibold text-text-primary mb-1">Активность заказов</p>
              <p className="text-xs text-text-muted mb-4">Последние 14 дней</p>
              <ActivityChart orderList={orderList} />
            </div>

            {/* Extra stats */}
            <div className="flex flex-col gap-3">
              <ExtraStatCard
                label="Конверсия"
                value={`${conversionRate}%`}
                sub="завершённые / все заказы"
                accent="text-green-600"
                bg="bg-green-50"
              />
              <ExtraStatCard
                label="Средний чек"
                value={avgPrice > 0 ? `${avgPrice} тг` : '—'}
                sub="по завершённым заказам"
                accent="text-blue-600"
                bg="bg-blue-50"
              />
              <ExtraStatCard
                label="Топ QR-точка"
                value={topLocation ? topLocation[0] : '—'}
                sub={topLocation ? `${topLocation[1]} заказов` : 'нет данных'}
                accent="text-brand-orange"
                bg="bg-orange-50"
              />
            </div>
          </div>

          {/* Row 3: quick access */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Быстрый доступ</p>
            <div className="grid grid-cols-3 gap-4">
              <QuickCard icon={<IconOrders />}    label="Заказы"    sub={`${orderList.length} всего`}       onClick={() => setActiveTab('orders')} />
              <QuickCard icon={<IconLocations />} label="QR-точки"  sub={`${locationList.length} активных`} onClick={() => setActiveTab('locations')} />
              <QuickCard icon={<IconTariffs />}   label="Тарифы"    sub={`${tariffList.length} активных`}   onClick={() => setActiveTab('tariffs')} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-5 ${color}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}

function ExtraStatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub: string; accent: string; bg: string
}) {
  return (
    <div className="flex-1 rounded-xl border border-gray-100 bg-white shadow-sm p-4 flex flex-col justify-between">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className={`text-2xl font-bold truncate mt-1 ${accent}`}>{value}</p>
      <p className="text-[11px] text-text-muted mt-1">{sub}</p>
    </div>
  )
}

function QuickCard({
  icon, label, sub, onClick,
}: {
  icon: React.ReactNode; label: string; sub: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-5 rounded-xl border border-gray-100 bg-white shadow-sm hover:border-brand-orange hover:shadow-md transition-all text-left"
    >
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="font-semibold text-text-primary text-sm">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{sub}</p>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────
// Activity chart (SVG, no library)
// ─────────────────────────────────────────────

function ActivityChart({ orderList }: { orderList: OrderOut[] }) {
  const DAYS = 14
  const today = new Date()

  const buckets = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (DAYS - 1 - i))
    const key = d.toISOString().split('T')[0]
    return { date: d, key, count: 0 }
  })

  for (const order of orderList) {
    const key = order.created_at.split('T')[0]
    const b = buckets.find((bk) => bk.key === key)
    if (b) b.count++
  }

  const counts = buckets.map((b) => b.count)
  const maxVal = Math.max(...counts, 1)

  const W = 500, H = 130
  const pL = 28, pR = 12, pT = 10, pB = 28
  const cW = W - pL - pR
  const cH = H - pT - pB

  const pts = counts.map((c, i) => ({
    x: pL + (i / (DAYS - 1)) * cW,
    y: pT + (1 - c / maxVal) * cH,
    count: c,
    label: buckets[i].date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
  }))

  // Catmull-Rom → cubic bezier
  function smoothPath(ps: typeof pts) {
    if (ps.length < 2) return `M ${ps[0].x} ${ps[0].y}`
    let d = `M ${ps[0].x} ${ps[0].y}`
    for (let i = 1; i < ps.length; i++) {
      const p0 = ps[Math.max(i - 2, 0)]
      const p1 = ps[i - 1]
      const p2 = ps[i]
      const p3 = ps[Math.min(i + 1, ps.length - 1)]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }
    return d
  }

  const linePath = smoothPath(pts)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${pT + cH} L ${pts[0].x} ${pT + cH} Z`

  const yLines = [0.25, 0.5, 0.75, 1].map((f) => ({
    y: pT + cH * (1 - f),
    label: String(Math.round(maxVal * f)),
  }))

  // Show x-labels every 2 days + last day
  const xLabels = pts.filter((_, i) => i % 2 === 0 || i === DAYS - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
      <defs>
        <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FC6500" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FC6500" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLines.map((gl) => (
        <g key={gl.y}>
          <line x1={pL} y1={gl.y} x2={W - pR} y2={gl.y} stroke="#F3F4F6" strokeWidth="1" />
          <text x={pL - 4} y={gl.y + 3} textAnchor="end" fontSize="8" fill="#D1D5DB">{gl.label}</text>
        </g>
      ))}

      {/* Area */}
      <path d={areaPath} fill="url(#activityGrad)" />

      {/* Line */}
      <path d={linePath} stroke="#FC6500" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points — show only non-zero or endpoints */}
      {pts.map((p, i) => (p.count > 0 || i === 0 || i === DAYS - 1) && (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke="#FC6500" strokeWidth="1.5" />
      ))}

      {/* X-axis labels */}
      {xLabels.map((p) => (
        <text key={p.label} x={p.x} y={H - 4} textAnchor="middle" fontSize="8" fill="#9CA3AF">
          {p.label}
        </text>
      ))}
    </svg>
  )
}

// ─────────────────────────────────────────────
// Orders panel
// ─────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  searching: { label: 'Поиск', color: 'bg-yellow-100 text-yellow-700' },
  assigned: { label: 'Назначен', color: 'bg-blue-100 text-blue-700' },
  driving: { label: 'В пути', color: 'bg-indigo-100 text-indigo-700' },
  arrived: { label: 'Прибыл', color: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Завершён', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-600' },
}

function OrdersPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<OrderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/admin/login'); return }
    orders.list().then(setList).finally(() => setLoading(false))
  }, [user, navigate])

  const filtered = filter === 'all' ? list : list.filter((o) => o.status === filter)

  return (
    <div className="flex flex-col flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Заказы</h1>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Все' },
            { key: 'searching', label: 'Поиск' },
            { key: 'assigned', label: 'Назначен' },
            { key: 'driving', label: 'В пути' },
            { key: 'completed', label: 'Завершён' },
            { key: 'cancelled', label: 'Отменён' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={[
                'text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors',
                filter === item.key
                  ? 'bg-brand-orange text-white border-brand-orange'
                  : 'bg-white text-text-muted border-gray-200 hover:border-gray-300',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted text-center mt-16">Нет заказов</p>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((order) => {
            const status = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={order.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-text-muted">#{order.id}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm font-medium text-text-primary">
                  {order.location_name ?? 'Точка'} → {order.destination_address || '—'}
                </p>
                <div className="flex justify-between text-xs text-text-muted mt-2">
                  <span>Пассажир: {order.user_name ?? '—'}</span>
                </div>
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>{order.tariff_name} · {order.tariff_period === 'night' ? 'Ночь' : 'День'}</span>
                  <span className="font-medium text-text-primary">{order.price} тг</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Locations panel (QR-точки)
// ─────────────────────────────────────────────

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

      <div className="absolute top-2 right-2 flex gap-1 z-10" onClick={(e) => e.stopPropagation()}>
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
          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-100 flex items-center justify-center text-text-muted hover:text-brand-orange hover:border-brand-orange transition-colors shadow-sm disabled:opacity-40"
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

      <div className="px-4 pt-11 pb-2 flex justify-center">
        <div className="w-full aspect-square max-w-[200px] flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ${loc.name}`} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
          ) : (
            <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-1">
        <p className="text-sm font-semibold text-text-primary truncate">{loc.name || '—'}</p>
        <p className="text-xs font-mono text-text-muted mt-0.5">
          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
        </p>
      </div>
    </div>
  )
}

function LocationsPanel() {
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
    setSelected(selected.size === list.length ? new Set() : new Set(list.map((l) => l.id)))
  }

  const allSelected = list.length > 0 && selected.size === list.length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-8 h-16 bg-white border-b border-gray-100 shrink-0">
        <h1 className="text-xl font-bold text-text-primary">QR-точки</h1>

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
      </div>

      {/* Panel body */}
      <div className="flex-1 p-8 overflow-y-auto">
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
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tariffs panel
// ─────────────────────────────────────────────

type TariffFormState = {
  name: string
  period: TariffPeriod
  base_price: string
  included_distance_km: string
  price_per_km: string
  time_threshold_minutes: string
  price_per_minute: string
  free_waiting_minutes: string
  waiting_price_per_minute: string
  description: string
}

const TARIFF_ORDER = ['Эконом', 'Оптимал', 'Комфорт', 'Бизнес']

function createInitialFormData(): TariffFormState {
  return {
    name: '',
    period: 'day',
    base_price: '',
    included_distance_km: '2',
    price_per_km: '',
    time_threshold_minutes: '12',
    price_per_minute: '20',
    free_waiting_minutes: '3',
    waiting_price_per_minute: '30',
    description: '',
  }
}

function sortTariffs(list: TariffOut[]) {
  return [...list].sort((a, b) => {
    if (a.period !== b.period) return a.period.localeCompare(b.period)
    const ai = TARIFF_ORDER.indexOf(a.name)
    const bi = TARIFF_ORDER.indexOf(b.name)
    if (ai === -1 || bi === -1) return a.name.localeCompare(b.name, 'ru')
    return ai - bi
  })
}

function getTariffLines(tariff: TariffOut) {
  const distanceLine = tariff.included_distance_km > 0
    ? `Первые ${tariff.included_distance_km} км — ${tariff.base_price} ${tariff.currency}`
    : `Посадка — ${tariff.base_price} ${tariff.currency}`
  const perKmLine = tariff.included_distance_km > 0
    ? `Затем — ${tariff.price_per_km} ${tariff.currency} за км`
    : `Цена за км — ${tariff.price_per_km} ${tariff.currency} за км`
  return [
    distanceLine,
    perKmLine,
    `После ${tariff.time_threshold_minutes} мин — ${tariff.price_per_minute} ${tariff.currency}/мин`,
    `Ожидание после ${tariff.free_waiting_minutes} мин — ${tariff.waiting_price_per_minute} ${tariff.currency}/мин`,
  ]
}

function TariffsPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<TariffOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<TariffFormState>(createInitialFormData)
  const [saving, setSaving] = useState(false)

  function loadData() {
    tariffs.list().then((items) => setList(sortTariffs(items))).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/admin/login'); return }
    loadData()
  }, [user, navigate])

  async function handleCreate() {
    if (!formData.name || !formData.base_price || !formData.price_per_km) return
    setSaving(true)
    try {
      await tariffs.create({
        name: formData.name,
        period: formData.period,
        base_price: parseFloat(formData.base_price),
        included_distance_km: parseFloat(formData.included_distance_km || '0'),
        price_per_km: parseFloat(formData.price_per_km || '0'),
        time_threshold_minutes: parseFloat(formData.time_threshold_minutes || '0'),
        price_per_minute: parseFloat(formData.price_per_minute || '0'),
        free_waiting_minutes: parseFloat(formData.free_waiting_minutes || '0'),
        waiting_price_per_minute: parseFloat(formData.waiting_price_per_minute || '0'),
        currency: 'тг',
        description: formData.description,
      })
      setFormData(createInitialFormData())
      setShowForm(false)
      loadData()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await tariffs.delete(id)
    loadData()
  }

  function updateField<K extends keyof TariffFormState>(key: K, value: TariffFormState[K]) {
    setFormData((cur) => ({ ...cur, [key]: value }))
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-8 h-16 bg-white border-b border-gray-100 shrink-0">
        <h1 className="text-xl font-bold text-text-primary">Тарифы</h1>
        <div className="flex-1" />
        <button
          onClick={() => setShowForm((c) => !c)}
          className="text-sm font-medium text-brand-orange hover:text-orange-600 transition-colors"
        >
          {showForm ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 p-8 overflow-y-auto">
        {showForm && (
          <div className="rounded-xl border border-brand-orange bg-surface-warm p-6 mb-6 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Название"
                placeholder="Эконом"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Период</span>
              <select
                value={formData.period}
                onChange={(e) => updateField('period', e.target.value as TariffPeriod)}
                className="h-12 rounded-card border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-brand-orange"
              >
                <option value="day">День</option>
                <option value="night">Ночь</option>
              </select>
            </label>

            <Input
              label="Базовая цена (тг)"
              placeholder="800"
              type="number"
              value={formData.base_price}
              onChange={(e) => updateField('base_price', e.target.value)}
            />
            <Input
              label="Первые км"
              placeholder="2"
              type="number"
              value={formData.included_distance_km}
              onChange={(e) => updateField('included_distance_km', e.target.value)}
            />
            <Input
              label="Цена за км"
              placeholder="90"
              type="number"
              value={formData.price_per_km}
              onChange={(e) => updateField('price_per_km', e.target.value)}
            />
            <Input
              label="Порог минут"
              placeholder="12"
              type="number"
              value={formData.time_threshold_minutes}
              onChange={(e) => updateField('time_threshold_minutes', e.target.value)}
            />
            <Input
              label="Цена за минуту"
              placeholder="20"
              type="number"
              value={formData.price_per_minute}
              onChange={(e) => updateField('price_per_minute', e.target.value)}
            />
            <Input
              label="Бесплатное ожидание"
              placeholder="3"
              type="number"
              value={formData.free_waiting_minutes}
              onChange={(e) => updateField('free_waiting_minutes', e.target.value)}
            />
            <Input
              label="Ожидание / мин"
              placeholder="30"
              type="number"
              value={formData.waiting_price_per_minute}
              onChange={(e) => updateField('waiting_price_per_minute', e.target.value)}
            />
            <div className="col-span-2">
              <Input
                label="Описание"
                placeholder="Первые 2 км — 800 тг, затем 100 тг за км"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Button onClick={handleCreate} disabled={saving || !formData.name || !formData.base_price}>
                {saving ? 'Сохранение...' : 'Создать тариф'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-text-muted text-center mt-16">Нет тарифов</p>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((tariff) => (
              <div key={tariff.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-primary text-sm">{tariff.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-text-muted">
                        {tariff.period === 'night' ? 'Ночь' : 'День'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{tariff.description}</p>
                    <div className="mt-2 space-y-0.5">
                      {getTariffLines(tariff).map((line) => (
                        <p key={line} className="text-xs text-text-muted">{line}</p>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-medium text-text-primary text-sm">
                      {tariff.base_price} {tariff.currency}
                    </span>
                    <button
                      onClick={() => handleDelete(tariff.id)}
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
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="10.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="10.5" y="10.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function IconOrders() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="1.5" width="12" height="15" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 6.5h6M6 9h6M6 11.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconLocations() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5A5 5 0 0 1 14 6.5c0 3.5-5 10-5 10S4 10 4 6.5a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="9" cy="6.5" r="1.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function IconTariffs() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 5.5v1.25m0 4.5V12.5m2.25-5A2.25 2.25 0 1 0 6.75 9 2.25 2.25 0 0 1 9 11.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
