import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Trip tracking has moved into the BookingPage widget ("Самое важное").
// Any direct link to /status/:orderId redirects to booking.
export function StatusPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/booking', { replace: true })
  }, [navigate])

  return null
}
