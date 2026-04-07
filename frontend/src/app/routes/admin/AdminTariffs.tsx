import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { tariffs } from '@/lib/services/api'
import type { TariffOut } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PageShell } from '@/components/PageShell'

export function AdminTariffs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<TariffOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', base_price: '', description: '' })
  const [saving, setSaving] = useState(false)

  function loadData() {
    tariffs.list().then(setList).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/login'); return }
    loadData()
  }, [user, navigate])

  async function handleCreate() {
    if (!formData.name || !formData.base_price) return
    setSaving(true)
    try {
      await tariffs.create({
        name: formData.name,
        base_price: parseFloat(formData.base_price),
        description: formData.description,
      })
      setFormData({ name: '', base_price: '', description: '' })
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

  return (
    <PageShell>
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate('/admin')} className="w-8 h-8 flex items-center justify-center text-text-muted">
          <ChevronLeftIcon />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1">Тарифы</h1>
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
              placeholder="Эконом"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Цена (₸)"
              placeholder="800"
              type="number"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
            />
            <Input
              label="Описание"
              placeholder="Доступный вариант"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Button onClick={handleCreate} disabled={saving || !formData.name}>
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
            {list.map((t) => (
              <div key={t.id} className="rounded-card border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary text-sm">{t.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-text-primary text-sm">
                      {t.base_price} {t.currency}
                    </span>
                    <button
                      onClick={() => handleDelete(t.id)}
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

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
