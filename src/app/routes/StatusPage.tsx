import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'

type OrderStatus = 'searching' | 'assigned' | 'driving' | 'arrived'

interface Driver {
  name: string
  rating: number
  car: string
  plate: string
}

interface Order {
  id: string
  status: OrderStatus
  driver?: Driver
  from: string
  to: string
  price: number
  etaMin?: number
}

const MOCK_ORDER: Order = {
  id: 'order-mock-001',
  status: 'assigned',
  driver: {
    name: 'Алибек С.',
    rating: 4.9,
    car: 'Toyota Camry, белый',
    plate: 'A 123 BC',
  },
  from: 'ТЦ Мега',
  to: 'Проспект Назарбаева, 10',
  price: 800,
  etaMin: 4,
}

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'searching', label: 'Поиск' },
  { key: 'assigned', label: 'Назначен' },
  { key: 'driving', label: 'Едет' },
  { key: 'arrived', label: 'Прибыл' },
]

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  searching: 'Ищем ближайшего водителя...',
  assigned: 'Водитель назначен и выезжает',
  driving: 'Водитель едет к вам',
  arrived: 'Водитель ожидает вас у входа',
}

function statusIndex(s: OrderStatus) {
  return STATUS_STEPS.findIndex((step) => step.key === s)
}

export function StatusPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  // In real app: fetch order by orderId. Using mock with dev cycle control.
  const [order] = useState<Order>({ ...MOCK_ORDER, id: orderId ?? MOCK_ORDER.id })

  const currentIdx = statusIndex(order.status)

  return (
    <PageShell>
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6 pb-4">
        <div>
          <p className="text-xs text-text-muted font-medium">Заказ #{order.id.slice(-6).toUpperCase()}</p>
          <h1 className="text-lg font-bold text-text-primary leading-tight mt-0.5">
            {STATUS_MESSAGES[order.status]}
          </h1>
        </div>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-4 pb-8">
        {/* Progress pills */}
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

        {/* Driver card — shown once assigned */}
        {order.driver && order.status !== 'searching' && (
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center shrink-0 text-2xl">
                🧑‍✈️
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-base text-text-primary">{order.driver.name}</span>
                <span className="text-sm text-text-muted">{order.driver.car}</span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm font-medium text-text-primary">
                  ★ {order.driver.rating}
                </span>
                <span className="text-sm font-bold text-brand-dark mt-0.5 tracking-wider">
                  {order.driver.plate}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* ETA block */}
        {order.status !== 'arrived' && order.etaMin && (
          <Card warm>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">
                {order.status === 'searching' ? 'Ожидаемое время подачи' : 'Прибудет через'}
              </span>
              <span className="text-base font-medium text-text-primary">
                {order.status === 'searching' ? '...' : `~${order.etaMin} мин`}
              </span>
            </div>
          </Card>
        )}

        {/* Route summary */}
        <Card>
          <div className="flex flex-col gap-2.5">
            <RouteRow label="А" text={order.from} filled />
            <div className="w-0.5 h-3 bg-gray-200 ml-3" />
            <RouteRow label="Б" text={order.to} filled={false} />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-text-muted">Стоимость</span>
            <span className="text-sm font-medium text-text-primary">{order.price} ₸</span>
          </div>
        </Card>

        {/* Arrived CTA */}
        {order.status === 'arrived' && (
          <Card warm>
            <p className="text-sm font-medium text-text-primary text-center">
              Водитель ожидает вас. Садитесь поудобнее!
            </p>
          </Card>
        )}

        <div className="flex-1" />

        {/* Actions */}
        {order.status === 'arrived' ? (
          <Button onClick={() => navigate('/done')}>Завершить поездку</Button>
        ) : order.status === 'searching' ? (
          <Button variant="second-stroke" onClick={() => navigate(-1)}>
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
