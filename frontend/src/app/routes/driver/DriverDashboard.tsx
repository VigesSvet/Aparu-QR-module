import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { orders, drivers as driversApi } from '@/lib/services/api'
import type { OrderOut, DriverProfileOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { PageShell } from '@/components/PageShell'

export function DriverDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [orderList, setOrderList] = useState<OrderOut[]>([])
  const [profile, setProfile] = useState<DriverProfileOut | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [ol, me] = await Promise.all([orders.list(), driversApi.me()])
      setOrderList(ol)
      setProfile(me.driver_profile)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'driver') { navigate('/login'); return }
    loadData()
  }, [user, navigate, loadData])

  const availableOrders = orderList.filter((o) => o.status === 'searching')
  const myActive = orderList.find((o) =>
    o.driver_id === user?.id && !['completed', 'cancelled'].includes(o.status)
  )

  async function handleToggleOnline() {
    const res = await driversApi.toggleOnline()
    setProfile(res)
  }

  async function handleAssign(orderId: number) {
    await orders.assign(orderId)
    loadData()
  }

  async function handleStatusChange(orderId: number, newStatus: string) {
    await orders.updateStatus(orderId, newStatus)
    loadData()
  }

  const STATUS_NEXT: Record<string, { label: string; next: string }> = {
    assigned: { label: 'Начать поездку', next: 'driving' },
    driving: { label: 'Я прибыл', next: 'arrived' },
    arrived: { label: 'Завершить поездку', next: 'completed' },
  }

  return (
    <PageShell>
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Водитель</p>
          <h1 className="text-xl font-bold text-text-primary">{user?.name ?? 'APARU'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleOnline}
            className={[
              'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
              profile?.is_online
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-500 border-gray-200',
            ].join(' ')}
          >
            {profile?.is_online ? '🟢 Онлайн' : '⚪ Офлайн'}
          </button>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-sm text-text-muted hover:text-red-500 transition-colors"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-5 pb-8">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Car info */}
            {profile && (
              <div className="rounded-card border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-warm flex items-center justify-center text-lg">🚗</div>
                <div>
                  <p className="font-medium text-text-primary text-sm">
                    {profile.car_model}, {profile.car_color}
                  </p>
                  <p className="text-xs text-text-muted">{profile.plate_number} · ★ {profile.rating}</p>
                </div>
              </div>
            )}

            {/* Active order */}
            {myActive && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Текущий заказ</p>
                <div className="rounded-card border-2 border-brand-orange bg-surface-warm p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-brand-orange">
                      Заказ #{myActive.id}
                    </span>
                    <StatusBadge status={myActive.status} />
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    {myActive.location_name} → {myActive.destination_address || '—'}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Пассажир: {myActive.user_name} · {myActive.price} ₸
                  </p>
                  {STATUS_NEXT[myActive.status] && (
                    <div className="mt-3">
                      <Button onClick={() => handleStatusChange(myActive.id, STATUS_NEXT[myActive.status].next)}>
                        {STATUS_NEXT[myActive.status].label}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Available orders */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Доступные заказы
                </p>
                <button onClick={loadData} className="text-xs text-brand-orange font-medium">
                  🔄 Обновить
                </button>
              </div>
              {availableOrders.length === 0 ? (
                <div className="rounded-card border border-gray-100 bg-white p-6 text-center shadow-sm">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm text-text-muted">Нет новых заказов</p>
                </div>
              ) : (
                availableOrders.map((order) => (
                  <div key={order.id} className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {order.location_name} → {order.destination_address || '—'}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {order.tariff_name} · {order.price} ₸
                        </p>
                      </div>
                      <Button
                        fullWidth={false}
                        onClick={() => handleAssign(order.id)}
                        className="!h-9 !px-4 !text-sm"
                      >
                        Взять
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </PageShell>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    assigned: { label: 'Назначен', color: 'bg-blue-100 text-blue-700' },
    driving: { label: 'В пути', color: 'bg-indigo-100 text-indigo-700' },
    arrived: { label: 'Прибыл', color: 'bg-teal-100 text-teal-700' },
  }
  const st = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
      {st.label}
    </span>
  )
}
