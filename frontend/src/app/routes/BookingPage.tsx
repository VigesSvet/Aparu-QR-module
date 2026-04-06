import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'

interface Tariff {
  id: string
  name: string
  price: number
  currency: string
}

const MOCK_FROM = { name: 'ТЦ Мега', address: 'ул. Ленина, 42, Алматы' }

const MOCK_TARIFFS: Tariff[] = [
  { id: 'economy', name: 'Эконом', price: 800, currency: '₸' },
  { id: 'comfort', name: 'Комфорт', price: 1200, currency: '₸' },
  { id: 'business', name: 'Бизнес', price: 2000, currency: '₸' },
]

export function BookingPage() {
  const navigate = useNavigate()
  const [destination, setDestination] = useState('')
  const [destinationError, setDestinationError] = useState('')
  const [selectedTariff, setSelectedTariff] = useState(MOCK_TARIFFS[0].id)

  const tariff = MOCK_TARIFFS.find((t) => t.id === selectedTariff) ?? MOCK_TARIFFS[0]

  function handleConfirm() {
    if (!destination.trim()) {
      setDestinationError('Укажите место назначения')
      return
    }
    setDestinationError('')
    navigate('/status/order-mock-001')
  }

  return (
    <PageShell>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center text-text-muted"
          aria-label="Назад"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-lg font-bold text-text-primary">Детали поездки</h1>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-4 pb-8">
        {/* Route */}
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">А</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-text-primary text-sm leading-snug truncate">
                  {MOCK_FROM.name}
                </p>
                <p className="text-xs text-text-muted truncate">{MOCK_FROM.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center -mt-2 -mb-2 ml-3">
                <div className="w-0.5 h-4 bg-gray-200" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-brand-dark flex items-center justify-center shrink-0">
                <span className="text-brand-dark text-xs font-bold">Б</span>
              </div>
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  placeholder="Куда едем?"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value)
                    if (destinationError) setDestinationError('')
                  }}
                  className={[
                    'w-full bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted',
                    'outline-none border-b pb-0.5',
                    destinationError ? 'border-red-500' : 'border-gray-200 focus:border-brand-orange',
                    'transition-colors',
                  ].join(' ')}
                />
              </div>
            </div>
          </div>
          {destinationError && (
            <p className="text-xs text-red-500 mt-2 ml-10">{destinationError}</p>
          )}
        </Card>

        {/* Tariff selection */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Тариф
          </p>
          <div className="flex gap-2">
            {MOCK_TARIFFS.map((t) => {
              const active = t.id === selectedTariff
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTariff(t.id)}
                  className={[
                    'flex-1 flex flex-col items-center py-3 px-2 rounded-card border text-center transition-colors',
                    active
                      ? 'border-brand-orange bg-surface-warm'
                      : 'border-gray-100 bg-white',
                  ].join(' ')}
                >
                  <span className="text-sm font-medium text-text-primary">{t.name}</span>
                  <span className="text-xs text-text-muted mt-0.5">
                    {t.price} {t.currency}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Summary */}
        <Card warm>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">Стоимость поездки</span>
            <span className="font-medium text-base text-text-primary">
              {tariff.price} {tariff.currency}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-text-muted">Тариф</span>
            <span className="text-sm font-medium text-text-primary">{tariff.name}</span>
          </div>
        </Card>

        <div className="flex-1" />

        <Button onClick={handleConfirm}>Подтвердить заказ</Button>
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
