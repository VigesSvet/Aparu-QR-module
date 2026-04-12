import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ScanPage } from './routes/ScanPage'
import { VerifyPage } from './routes/VerifyPage'
import { BookingPage } from './routes/BookingPage'
import { StatusPage } from './routes/StatusPage'
import { AdminLoginPage } from './routes/admin/AdminLoginPage'
import { RequireAdmin } from './routes/admin/RequireAdmin'
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

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/orders" element={<RequireAdmin><AdminOrders /></RequireAdmin>} />
          <Route path="/admin/locations" element={<RequireAdmin><AdminLocations /></RequireAdmin>} />
          <Route path="/admin/tariffs" element={<RequireAdmin><AdminTariffs /></RequireAdmin>} />

          <Route path="*" element={<Navigate to="/booking" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
