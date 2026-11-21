import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Field from '../components/Field'
import { api, ApiError, type User } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

export default function LoginPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim() || !password) return setError('Kullanıcı adı/e-posta ve şifre gir.')
    setError(null)
    setLoading(true) // buton kilitlenir, çift tıklamada iki istek gitmez
    try {
      const { user } = await api<{ user: User }>('/auth/login', { identifier, password, remember })
      setUser(user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bir şeyler ters gitti.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Hoş geldin reis!">
      <form onSubmit={onSubmit} noValidate>
        {error && <div className="form-error" role="alert">{error}</div>}
        <Field label="Kullanıcı adı veya e-posta" value={identifier} onChange={setIdentifier} autoComplete="username" autoFocus />
        <Field label="Şifre" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <Link to="/forgot-password" className="link small">Şifreni mi unuttun?</Link>

        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Oturumu açık tut
        </label>

        <button className="primary" disabled={loading}>
          {loading ? <span className="spinner" aria-label="Giriş yapılıyor" /> : 'Giriş Yap'}
        </button>
      </form>
      <p className="footer-text">
        Hesabın yok mu? <Link to="/register" state={{ from }} className="link">Hesap aç</Link>
      </p>
    </AuthCard>
  )
}
