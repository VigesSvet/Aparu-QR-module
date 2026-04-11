import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clearSelectedTariff, saveScanLocation } from '@/lib/scanContext'

export function ScanPage() {
  const { locationId = '1' } = useParams<{ locationId: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const id = parseInt(locationId, 10)
    if (isNaN(id)) {
      setError('Некорректный QR-код')
      return
    }

    saveScanLocation(id)
    clearSelectedTariff()
    navigate('/booking', { replace: true })
  }, [locationId, navigate])

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
