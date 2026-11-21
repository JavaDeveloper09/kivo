import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import HomePage from './pages/HomePage'
import InvitePage from './pages/InvitePage'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="splash">Yükleniyor…</div>
  // Giriş yapınca kaldığı sayfaya (ör. davet linki) geri dönebilsin diye adresi hatırla
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="splash">Yükleniyor…</div>
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  return user ? <Navigate to={from} replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Protected><HomePage /></Protected>} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/invite/:code" element={<Protected><InvitePage /></Protected>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
