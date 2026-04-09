import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { orders } from '@/lib/services/api'
import type { OrderOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'
import { getRepeatScanPath } from '@/lib/scanContext'

type OrderStatus = 'searching' | 'assigned' | 'driving' | 'arrived' | 'completed' | 'cancelled'

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
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
  completed: 'Поездка завершена',
  cancelled: 'Заказ отменён',
}

function statusIndex(s: string) {
  return STATUS_STEPS.findIndex((step) => step.key === s)
}

export function StatusPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  useAuth()

  const [order, setOrder] = useState<OrderOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrder = useCallback(async () => {
    if (!orderId) return
    try {
      const o = await orders.get(parseInt(orderId, 10))
      setOrder(o)
      if (o.status === 'completed') {
        navigate('/done')
      }
    } catch (e: any) {
      setError(e.message ?? 'Ошибка загрузки заказа')
    } finally {
      setLoading(false)
    }
  }, [orderId, navigate])

  useEffect(() => {
    loadOrder()
    const interval = setInterval(loadOrder, 5000)
    return () => clearInterval(interval)
  }, [loadOrder])

  async function handleCancel() {
    if (!order) return
    await orders.updateStatus(order.id, 'cancelled')
    navigate(getRepeatScanPath())
  }

  async function handleComplete() {
    if (!order) return
    await orders.updateStatus(order.id, 'completed')
    navigate('/done')
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      </PageShell>
    )
  }

  if (error || !order) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <p className="text-sm text-text-muted">{error || 'Заказ не найден'}</p>
        </div>
      </PageShell>
    )
  }

  const currentIdx = statusIndex(order.status)

  return (
    <PageShell>
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="text-xs text-text-muted font-medium">Заказ #{order.id}</p>
          <h1 className="text-lg font-bold text-text-primary leading-tight mt-0.5">
            {STATUS_MESSAGES[order.status] ?? order.status}
          </h1>
        </div>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-4 pb-8">
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
                    'text-xs font-medium',
                    active ? 'text-brand-orange' : done ? 'text-text-muted' : 'text-gray-300',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        <Card>
          <div className="flex flex-col gap-2.5">
            <RouteRow label="А" text={order.location_name ?? '—'} filled />
            <div className="w-0.5 h-3 bg-gray-200 ml-3" />
            <RouteRow label="Б" text={order.destination_address || '—'} filled={false} />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-text-muted">Стоимость</span>
            <span className="text-sm font-medium text-text-primary">{order.price} ₸</span>
          </div>
        </Card>

        {order.status === 'arrived' && (
          <Card warm>
            <p className="text-sm font-medium text-text-primary text-center">
              Машина на месте. Можно завершить эмуляцию поездки.
            </p>
          </Card>
        )}

        <div className="flex-1" />

        {order.status === 'arrived' ? (
          <Button onClick={handleComplete}>Завершить поездку</Button>
        ) : order.status === 'searching' ? (
          <Button variant="second-stroke" onClick={handleCancel}>
            Отменить заказ
          </Button>
        ) : null}
      </main>
    </PageShell>
  )
}

function RouteRow({ label, text, filled }: { label: string; text: string; filled: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
          filled ? 'bg-brand-orange text-white' : 'border-2 border-brand-dark text-brand-dark',
        ].join(' ')}
      >
        {label}
      </div>
      <span className="text-sm font-medium text-text-primary truncate">{text}</span>
    </div>
  )
}
