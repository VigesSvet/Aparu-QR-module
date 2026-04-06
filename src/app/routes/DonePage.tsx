import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'

interface CompletedRide {
  from: string
  to: string
  price: number
  currency: string
  durationMin: number
  driverName: string
  driverRating: number
}

const MOCK_RIDE: CompletedRide = {
  from: 'ТЦ Мега',
  to: 'Проспект Назарбаева, 10',
  price: 800,
  currency: '₸',
  durationMin: 12,
  driverName: 'Алибек С.',
  driverRating: 4.9,
}

export function DonePage() {
  const navigate = useNavigate()

  return (
    <PageShell>
      <main className="flex flex-col flex-1 px-4 pt-10 pb-8 items-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-surface-warm flex items-center justify-center text-4xl mb-6">
          ✅
        </div>

        <h1 className="text-2xl font-bold text-text-primary text-center leading-tight">
          Поездка завершена
        </h1>
        <p className="text-base text-text-muted text-center mt-2">
          Спасибо, что воспользовались APARU
        </p>

        {/* Ride summary */}
        <div className="w-full mt-8">
          <Card>
            <div className="flex flex-col gap-3">
              <SummaryRow label="Откуда" value={MOCK_RIDE.from} />
              <SummaryRow label="Куда" value={MOCK_RIDE.to} />
              <div className="border-t border-gray-100" />
              <SummaryRow label="Время в пути" value={`${MOCK_RIDE.durationMin} мин`} />
              <SummaryRow label="Водитель" value={`${MOCK_RIDE.driverName} ★ ${MOCK_RIDE.driverRating}`} />
              <div className="border-t border-gray-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">Итого</span>
                <span className="text-lg font-bold text-text-primary">
                  {MOCK_RIDE.price} {MOCK_RIDE.currency}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Rating */}
        <div className="w-full mt-4">
          <Card warm>
            <p className="text-sm text-text-muted text-center mb-3">Оцените поездку</p>
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className="text-3xl text-gray-200 hover:text-brand-orange transition-colors active:scale-110"
                  aria-label={`${star} звезда`}
                >
                  ★
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex-1" />

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full mt-8">
          <Button
            variant="main"
            onClick={() => {
              // In production: deep-link to store
              window.open('https://aparu.kz', '_blank', 'noopener,noreferrer')
            }}
          >
            Установить приложение APARU
          </Button>
          <Button
            variant="third"
            onClick={() => navigate('/scan/demo-loc')}
          >
            Заказать ещё раз
          </Button>
        </div>
      </main>
    </PageShell>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-text-muted shrink-0">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right">{value}</span>
    </div>
  )
}
