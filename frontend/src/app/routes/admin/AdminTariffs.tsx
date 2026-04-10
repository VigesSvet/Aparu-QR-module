import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { tariffs } from '@/lib/services/api'
import type { TariffOut, TariffPeriod } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PageShell } from '@/components/PageShell'

type TariffFormState = {
  name: string
  period: TariffPeriod
  base_price: string
  included_distance_km: string
  price_per_km: string
  time_threshold_minutes: string
  price_per_minute: string
  free_waiting_minutes: string
  waiting_price_per_minute: string
  description: string
}

const TARIFF_ORDER = ['Эконом', 'Оптимал', 'Комфорт', 'Бизнес']

function createInitialFormData(): TariffFormState {
  return {
    name: '',
    period: 'day',
    base_price: '',
    included_distance_km: '2',
    price_per_km: '',
    time_threshold_minutes: '12',
    price_per_minute: '20',
    free_waiting_minutes: '3',
    waiting_price_per_minute: '30',
    description: '',
  }
}

function formatTariffPeriodLabel(period: TariffPeriod) {
  return period === 'night' ? 'Ночь' : 'День'
}

function sortTariffs(list: TariffOut[]) {
  return [...list].sort((left, right) => {
    if (left.period !== right.period) return left.period.localeCompare(right.period)
    const leftIdx = TARIFF_ORDER.indexOf(left.name)
    const rightIdx = TARIFF_ORDER.indexOf(right.name)
    if (leftIdx === -1 || rightIdx === -1) return left.name.localeCompare(right.name, 'ru')
    return leftIdx - rightIdx
  })
}

export function AdminTariffs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<TariffOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<TariffFormState>(createInitialFormData)
  const [saving, setSaving] = useState(false)

  function loadData() {
    tariffs.list().then((items) => setList(sortTariffs(items))).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/login')
      return
    }
    loadData()
  }, [user, navigate])

  async function handleCreate() {
    if (!formData.name || !formData.base_price || !formData.price_per_km) return

    setSaving(true)
    try {
      await tariffs.create({
        name: formData.name,
        period: formData.period,
        base_price: parseFloat(formData.base_price),
        included_distance_km: parseFloat(formData.included_distance_km || '0'),
        price_per_km: parseFloat(formData.price_per_km || '0'),
        time_threshold_minutes: parseFloat(formData.time_threshold_minutes || '0'),
        price_per_minute: parseFloat(formData.price_per_minute || '0'),
        free_waiting_minutes: parseFloat(formData.free_waiting_minutes || '0'),
        waiting_price_per_minute: parseFloat(formData.waiting_price_per_minute || '0'),
        currency: 'тг',
        description: formData.description,
      })
      setFormData(createInitialFormData())
      setShowForm(false)
      loadData()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await tariffs.delete(id)
    loadData()
  }

  function updateField<Key extends keyof TariffFormState>(key: Key, value: TariffFormState[Key]) {
    setFormData((current) => ({ ...current, [key]: value }))
  }

  return (
    <PageShell>
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate('/admin')} className="w-8 h-8 flex items-center justify-center text-text-muted">
          <ChevronLeftIcon />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1">Тарифы</h1>
        <button
          onClick={() => setShowForm((current) => !current)}
          className="text-sm font-medium text-brand-orange"
        >
          {showForm ? 'Отмена' : '+ Добавить'}
        </button>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-4 pb-8">
        {showForm && (
          <div className="rounded-card border border-brand-orange bg-surface-warm p-4 flex flex-col gap-3">
            <Input
              label="Название"
              placeholder="Эконом"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
            />

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Период</span>
              <select
                value={formData.period}
                onChange={(e) => updateField('period', e.target.value as TariffPeriod)}
                className="h-12 rounded-card border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-brand-orange"
              >
                <option value="day">День</option>
                <option value="night">Ночь</option>
              </select>
            </label>

            <Input
              label="Базовая цена (тг)"
              placeholder="800"
              type="number"
              value={formData.base_price}
              onChange={(e) => updateField('base_price', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Первые км"
                placeholder="2"
                type="number"
                value={formData.included_distance_km}
                onChange={(e) => updateField('included_distance_km', e.target.value)}
              />
              <Input
                label="Цена за км"
                placeholder="90"
                type="number"
                value={formData.price_per_km}
                onChange={(e) => updateField('price_per_km', e.target.value)}
              />
              <Input
                label="Порог минут"
                placeholder="12"
                type="number"
                value={formData.time_threshold_minutes}
                onChange={(e) => updateField('time_threshold_minutes', e.target.value)}
              />
              <Input
                label="Цена за минуту"
                placeholder="20"
                type="number"
                value={formData.price_per_minute}
                onChange={(e) => updateField('price_per_minute', e.target.value)}
              />
              <Input
                label="Бесплатное ожидание"
                placeholder="3"
                type="number"
                value={formData.free_waiting_minutes}
                onChange={(e) => updateField('free_waiting_minutes', e.target.value)}
              />
              <Input
                label="Ожидание / мин"
                placeholder="30"
                type="number"
                value={formData.waiting_price_per_minute}
                onChange={(e) => updateField('waiting_price_per_minute', e.target.value)}
              />
            </div>

            <Input
              label="Описание"
              placeholder="Первые 2 км — 800 тг, затем 100 тг за км"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
            />

            <Button onClick={handleCreate} disabled={saving || !formData.name || !formData.base_price}>
              {saving ? 'Сохранение...' : 'Создать тариф'}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-text-muted text-center mt-8">Нет тарифов</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((tariff) => (
              <div key={tariff.id} className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-primary text-sm">{tariff.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-text-muted">
                        {formatTariffPeriodLabel(tariff.period)}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{tariff.description}</p>
                    <div className="mt-2 space-y-1">
                      {getTariffLines(tariff).map((line) => (
                        <p key={line} className="text-xs text-text-muted">{line}</p>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-text-primary text-sm">
                      {tariff.base_price} {tariff.currency}
                    </span>
                    <button
                      onClick={() => handleDelete(tariff.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </PageShell>
  )
}

function getTariffLines(tariff: TariffOut) {
  const distanceLine = tariff.included_distance_km > 0
    ? `Первые ${tariff.included_distance_km} км — ${tariff.base_price} ${tariff.currency}`
    : `Посадка — ${tariff.base_price} ${tariff.currency}`

  const perKmLine = tariff.included_distance_km > 0
    ? `Затем — ${tariff.price_per_km} ${tariff.currency} за км`
    : `Цена за км — ${tariff.price_per_km} ${tariff.currency} за км`

  return [
    distanceLine,
    perKmLine,
    `После ${tariff.time_threshold_minutes} мин — ${tariff.price_per_minute} ${tariff.currency}/мин`,
    `Ожидание после ${tariff.free_waiting_minutes} мин — ${tariff.waiting_price_per_minute} ${tariff.currency}/мин`,
  ]
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
