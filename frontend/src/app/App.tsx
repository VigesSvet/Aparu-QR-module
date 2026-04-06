import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ScanPage } from './routes/ScanPage'
import { VerifyPage } from './routes/VerifyPage'
import { BookingPage } from './routes/BookingPage'
import { StatusPage } from './routes/StatusPage'
import { DonePage } from './routes/DonePage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/scan/:locationId" element={<ScanPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/status/:orderId" element={<StatusPage />} />
        <Route path="/done" element={<DonePage />} />
        {/* Dev convenience redirect */}
        <Route path="*" element={<Navigate to="/scan/demo-loc" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
