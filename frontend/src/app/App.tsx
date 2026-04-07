import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { LoginPage } from './routes/LoginPage'
import { ScanPage } from './routes/ScanPage'
import { VerifyPage } from './routes/VerifyPage'
import { BookingPage } from './routes/BookingPage'
import { StatusPage } from './routes/StatusPage'
import { DonePage } from './routes/DonePage'
import { AdminDashboard } from './routes/admin/AdminDashboard'
import { AdminOrders } from './routes/admin/AdminOrders'
import { AdminLocations } from './routes/admin/AdminLocations'
import { AdminTariffs } from './routes/admin/AdminTariffs'
import { DriverDashboard } from './routes/driver/DriverDashboard'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* User flow */}
          <Route path="/scan/:locationId" element={<ScanPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/status/:orderId" element={<StatusPage />} />
          <Route path="/done" element={<DonePage />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/locations" element={<AdminLocations />} />
          <Route path="/admin/tariffs" element={<AdminTariffs />} />

          {/* Driver */}
          <Route path="/driver" element={<DriverDashboard />} />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
