import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations, tariffs as tariffsApi } from '@/lib/services/api'
import type { LocationOut, TariffOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'

export function ScanPage() {
  const { locationId = '1' } = useParams<{ locationId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [location, setLocation] = useState<LocationOut | null>(null)
  const [tariffList, setTariffList] = useState<TariffOut[]>([])
  const [selectedTariff, setSelectedTariff] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = parseInt(locationId, 10)
    if (isNaN(id)) {
      setError('Некорректный QR-код')
      setLoading(false)
      return
    }

    Promise.all([locations.get(id), tariffsApi.list()])
      .then(([loc, tList]) => {
        setLocation(loc)
        setTariffList(tList)
        if (tList.length > 0) setSelectedTariff(tList[0].id)
      })
      .catch(() => setError('Не удалось загрузить данные'))
      .finally(() => setLoading(false))
  }, [locationId])

  function handleOrder() {
    if (!user) {
      // Save location & tariff to sessionStorage for after auth
      sessionStorage.setItem('aparu_scan_location', locationId)
      sessionStorage.setItem('aparu_scan_tariff', String(selectedTariff))
      navigate('/verify')
      return
    }
    // Already authenticated, go to booking
    sessionStorage.setItem('aparu_scan_location', locationId)
    sessionStorage.setItem('aparu_scan_tariff', String(selectedTariff))
    navigate('/booking')
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

  if (error || !location) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <p className="text-3xl mb-4">😕</p>
          <p className="text-sm text-text-muted text-center">{error || 'Точка не найдена'}</p>
          <Button className="mt-6" onClick={() => navigate('/login')}>На главную</Button>
        </div>
      </PageShell>
    )
  }

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
            {tariffList.map((tariff) => {
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
                      {tariff.base_price} {tariff.currency}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1" />

        <Button onClick={handleOrder} disabled={!selectedTariff}>Заказать</Button>
      </main>
    </PageShell>
  )
}
