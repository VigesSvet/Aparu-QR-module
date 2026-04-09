import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { orders } from '@/lib/services/api'
import type { OrderOut } from '@/lib/services/api'
import { PageShell } from '@/components/PageShell'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  searching: { label: 'Поиск', color: 'bg-yellow-100 text-yellow-700' },
  assigned: { label: 'Назначен', color: 'bg-blue-100 text-blue-700' },
  driving: { label: 'В пути', color: 'bg-indigo-100 text-indigo-700' },
  arrived: { label: 'Прибыл', color: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Завершён', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-600' },
}

export function AdminOrders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<OrderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/login'); return }
    orders.list().then(setList).finally(() => setLoading(false))
  }, [user, navigate])

  const filtered = filter === 'all' ? list : list.filter((o) => o.status === filter)

  return (
    <PageShell>
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate('/admin')} className="w-8 h-8 flex items-center justify-center text-text-muted">
          <ChevronLeftIcon />
        </button>
        <h1 className="text-lg font-bold text-text-primary">Заказы</h1>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-4 pb-8">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { key: 'all', label: 'Все' },
            { key: 'searching', label: 'Поиск' },
            { key: 'assigned', label: 'Назначен' },
            { key: 'driving', label: 'В пути' },
            { key: 'completed', label: 'Завершён' },
            { key: 'cancelled', label: 'Отменён' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                'text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors',
                filter === f.key
                  ? 'bg-brand-orange text-white border-brand-orange'
                  : 'bg-white text-text-muted border-gray-200',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-muted text-center mt-8">Нет заказов</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((order) => {
              const st = STATUS_LABELS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' }
              return (
                <div key={order.id} className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-muted">
                      #{order.id}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-text-primary">
                      {order.location_name ?? 'Точка'} → {order.destination_address || '—'}
                    </p>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Пассажир: {order.user_name ?? '—'}</span>
                      <span>Статус: {st.label}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>{order.tariff_name}</span>
                      <span className="font-medium text-text-primary">{order.price} ₸</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </PageShell>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
