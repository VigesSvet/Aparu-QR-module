import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { locations } from '@/lib/services/api'
import type { LocationOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PageShell } from '@/components/PageShell'

export function AdminLocations() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<LocationOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', address: '', latitude: '', longitude: '' })
  const [saving, setSaving] = useState(false)

  function loadData() {
    locations.list().then(setList).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/login'); return }
    loadData()
  }, [user, navigate])

  async function handleCreate() {
    if (!formData.name || !formData.address) return
    setSaving(true)
    try {
      await locations.create({
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
      })
      setFormData({ name: '', address: '', latitude: '', longitude: '' })
      setShowForm(false)
      loadData()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await locations.delete(id)
    loadData()
  }

  return (
    <PageShell>
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate('/admin')} className="w-8 h-8 flex items-center justify-center text-text-muted">
          <ChevronLeftIcon />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1">QR-точки</h1>
        <button
          onClick={() => setShowForm(!showForm)}
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
              placeholder="ТЦ Мега"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Адрес"
              placeholder="ул. Ленина, 42"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
            <div className="flex gap-3">
              <Input
                label="Широта"
                placeholder="43.2046"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              />
              <Input
                label="Долгота"
                placeholder="76.8994"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              />
            </div>
            <Button onClick={handleCreate} disabled={saving || !formData.name}>
              {saving ? 'Сохранение...' : 'Создать точку'}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-text-muted text-center mt-8">Нет QR-точек</p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((loc) => (
              <div key={loc.id} className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-orange flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">📍</span>
                    </div>
                    <div>
                      <p className="font-medium text-text-primary text-sm">{loc.name}</p>
                      <p className="text-xs text-text-muted mt-0.5">{loc.address}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
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
