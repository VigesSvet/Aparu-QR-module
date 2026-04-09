import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { clearSelectedTariff, saveScanLocation } from '@/lib/scanContext'

export function ScanPage() {
  const { locationId = '1' } = useParams<{ locationId: string }>()
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoading) return

    const id = parseInt(locationId, 10)
    if (isNaN(id)) {
      setError('Некорректный QR-код')
      return
    }

    saveScanLocation(id)
    clearSelectedTariff()

    if (user) {
      navigate('/booking', { replace: true })
    } else {
      navigate('/verify', { replace: true })
    }
  }, [locationId, user, isLoading, navigate])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-8 gap-3">
        <p className="text-3xl">😕</p>
        <p className="text-sm text-text-muted text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-[3px] border-brand-orange border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
