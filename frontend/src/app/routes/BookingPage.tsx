import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations, tariffs as tariffsApi, orders } from '@/lib/services/api'
import type { LocationOut, TariffOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'

export function BookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [destination, setDestination] = useState('')
  const [destinationError, setDestinationError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [location, setLocation] = useState<LocationOut | null>(null)
  const [tariffList, setTariffList] = useState<TariffOut[]>([])
  const [selectedTariff, setSelectedTariff] = useState<number | null>(null)

  useEffect(() => {
    if (!user) { navigate('/login'); return }

    const locId = parseInt(sessionStorage.getItem('aparu_scan_location') ?? '1', 10)
    const tarId = parseInt(sessionStorage.getItem('aparu_scan_tariff') ?? '0', 10)

    Promise.all([locations.get(locId), tariffsApi.list()])
      .then(([loc, tList]) => {
        setLocation(loc)
        setTariffList(tList)
        setSelectedTariff(tarId || (tList[0]?.id ?? null))
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false))
  }, [user, navigate])

  const tariff = tariffList.find((t) => t.id === selectedTariff) ?? tariffList[0]

  async function handleConfirm() {
    if (!destination.trim()) {
      setDestinationError('Укажите место назначения')
      return
    }
    if (!location || !tariff) return

    setDestinationError('')
    setSubmitting(true)
    try {
      const order = await orders.create({
        qr_location_id: location.id,
        tariff_id: tariff.id,
        destination_address: destination,
      })
      navigate(`/status/${order.id}`)
    } catch (e: any) {
      setDestinationError(e.message ?? 'Ошибка создания заказа')
    } finally {
      setSubmitting(false)
    }
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
                  {location?.name}
                </p>
                <p className="text-xs text-text-muted truncate">{location?.address}</p>
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
            {tariffList.map((t) => {
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
                    {t.base_price} {t.currency}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Summary */}
        {tariff && (
          <Card warm>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Стоимость поездки</span>
              <span className="font-medium text-base text-text-primary">
                {tariff.base_price} {tariff.currency}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-text-muted">Тариф</span>
              <span className="text-sm font-medium text-text-primary">{tariff.name}</span>
            </div>
          </Card>
        )}

        <div className="flex-1" />

        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Оформление...' : 'Подтвердить заказ'}
        </Button>
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
