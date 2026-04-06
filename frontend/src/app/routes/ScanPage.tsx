import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'

interface Location {
  id: string
  name: string
  address: string
}

interface Tariff {
  id: string
  name: string
  price: number
  currency: string
  etaMin: number
  description: string
}

const MOCK_LOCATIONS: Record<string, Location> = {
  'demo-loc': {
    id: 'demo-loc',
    name: 'ТЦ Мега',
    address: 'ул. Ленина, 42, Алматы',
  },
  default: {
    id: 'unknown',
    name: 'Текущая точка',
    address: 'Определяется...',
  },
}

const MOCK_TARIFFS: Tariff[] = [
  {
    id: 'economy',
    name: 'Эконом',
    price: 800,
    currency: '₸',
    etaMin: 3,
    description: 'Доступный вариант',
  },
  {
    id: 'comfort',
    name: 'Комфорт',
    price: 1200,
    currency: '₸',
    etaMin: 5,
    description: 'Просторный салон',
  },
]

export function ScanPage() {
  const { locationId = 'default' } = useParams<{ locationId: string }>()
  const navigate = useNavigate()

  const location = MOCK_LOCATIONS[locationId] ?? MOCK_LOCATIONS.default
  const [selectedTariff, setSelectedTariff] = useState(MOCK_TARIFFS[0].id)

  return (
    <PageShell>
      {/* Header */}
      <header className="flex items-center px-4 pt-6 pb-4">
        <span className="text-xl font-bold text-brand-orange tracking-tight">APARU</span>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-4 pb-8">
        {/* Point A */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Точка отправления
          </p>
          <Card>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">А</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-text-primary text-base leading-snug">
                  {location.name}
                </span>
                <span className="text-sm text-text-muted mt-0.5 truncate">{location.address}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Tariff selection */}
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Тариф
          </p>
          <div className="flex flex-col gap-2">
            {MOCK_TARIFFS.map((tariff) => {
              const active = tariff.id === selectedTariff
              return (
                <button
                  key={tariff.id}
                  onClick={() => setSelectedTariff(tariff.id)}
                  className={[
                    'w-full flex items-center justify-between rounded-card border p-4 text-left transition-colors',
                    active
                      ? 'border-brand-orange bg-surface-warm'
                      : 'border-gray-100 bg-white',
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-base text-text-primary">{tariff.name}</span>
                    <span className="text-sm text-text-muted">{tariff.description}</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-4">
                    <span className="font-medium text-base text-text-primary">
                      {tariff.price} {tariff.currency}
                    </span>
                    <span className="text-sm text-text-muted">{tariff.etaMin} мин</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1" />

        <Button onClick={() => navigate('/verify')}>Заказать</Button>
      </main>
    </PageShell>
  )
}
