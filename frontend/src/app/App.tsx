import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ScanPage } from './routes/ScanPage'
import { VerifyPage } from './routes/VerifyPage'
import { BookingPage } from './routes/BookingPage'
import { StatusPage } from './routes/StatusPage'
import { AdminDashboard } from './routes/admin/AdminDashboard'
import { AdminOrders } from './routes/admin/AdminOrders'
import { AdminLocations } from './routes/admin/AdminLocations'
import { AdminTariffs } from './routes/admin/AdminTariffs'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/scan/:locationId" element={<ScanPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/status/:orderId" element={<StatusPage />} />

          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/locations" element={<AdminLocations />} />
          <Route path="/admin/tariffs" element={<AdminTariffs />} />

          <Route path="*" element={<Navigate to="/booking" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
