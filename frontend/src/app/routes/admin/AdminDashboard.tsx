import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { orders, locations, tariffs } from '@/lib/services/api'
import type { OrderOut, LocationOut, TariffOut } from '@/lib/services/api'
import { PageShell } from '@/components/PageShell'

export function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [orderList, setOrderList] = useState<OrderOut[]>([])
  const [locationList, setLocationList] = useState<LocationOut[]>([])
  const [tariffList, setTariffList] = useState<TariffOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/login')
      return
    }
    Promise.all([
      orders.list(),
      locations.list(),
      tariffs.list(),
    ])
      .then(([o, l, t]) => {
        setOrderList(o)
        setLocationList(l)
        setTariffList(t)
      })
      .finally(() => setLoading(false))
  }, [user, navigate])

  const stats = {
    total: orderList.length,
    active: orderList.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
    completed: orderList.filter((o) => o.status === 'completed').length,
    cancelled: orderList.filter((o) => o.status === 'cancelled').length,
  }

  return (
    <PageShell>
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Админ-панель</p>
          <h1 className="text-xl font-bold text-text-primary">APARU</h1>
        </div>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="text-sm text-text-muted hover:text-red-500 transition-colors"
        >
          Выйти
        </button>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-5 pb-8">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Всего заказов" value={stats.total} color="bg-blue-50 text-blue-600" />
              <StatCard label="Активных" value={stats.active} color="bg-orange-50 text-brand-orange" />
              <StatCard label="Завершено" value={stats.completed} color="bg-green-50 text-green-600" />
              <StatCard label="Отменено" value={stats.cancelled} color="bg-red-50 text-red-500" />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Управление</p>
              <Link to="/admin/orders" className="flex items-center justify-between rounded-card border border-gray-100 bg-white p-4 shadow-sm hover:border-brand-orange transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📋</span>
                  <div>
                    <span className="font-medium text-text-primary text-sm">Заказы</span>
                    <p className="text-xs text-text-muted">{orderList.length} всего</p>
                  </div>
                </div>
                <ChevronRightIcon />
              </Link>
              <Link to="/admin/locations" className="flex items-center justify-between rounded-card border border-gray-100 bg-white p-4 shadow-sm hover:border-brand-orange transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📍</span>
                  <div>
                    <span className="font-medium text-text-primary text-sm">QR-точки</span>
                    <p className="text-xs text-text-muted">{locationList.length} активных</p>
                  </div>
                </div>
                <ChevronRightIcon />
              </Link>
              <Link to="/admin/tariffs" className="flex items-center justify-between rounded-card border border-gray-100 bg-white p-4 shadow-sm hover:border-brand-orange transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">💰</span>
                  <div>
                    <span className="font-medium text-text-primary text-sm">Тарифы</span>
                    <p className="text-xs text-text-muted">{tariffList.length} активных</p>
                  </div>
                </div>
                <ChevronRightIcon />
              </Link>
            </div>
          </>
        )}
      </main>
    </PageShell>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-card p-4 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-muted">
      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
