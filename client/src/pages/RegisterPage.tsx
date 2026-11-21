import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Field from '../components/Field'
import { api, ApiError, type User } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { validateEmail, validatePassword, validateUsername } from '../lib/validation'

type Errors = Partial<Record<'email' | 'username' | 'displayName' | 'password' | 'confirm', string | null>>

export default function RegisterPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate(): Errors {
    return {
      email: validateEmail(email),
      username: validateUsername(username),
      displayName: displayName.length > 32 ? 'En fazla 32 karakter olabilir.' : null,
      password: validatePassword(password),
      confirm: confirm !== password ? 'Şifreler eşleşmiyor.' : null,
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const v = validate()
    setErrors(v)
    if (Object.values(v).some(Boolean)) return

    setLoading(true)
    try {
      const { user } = await api<{ user: User }>('/auth/register', {
        email,
        username,
        displayName: displayName.trim() || undefined,
        password,
      })
      setUser(user)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message })
      else setFormError(err instanceof ApiError ? err.message : 'Bir şeyler ters gitti.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Hesap oluştur">
      <form onSubmit={onSubmit} noValidate>
        {formError && <div className="form-error" role="alert">{formError}</div>}
        <Field label="E-posta" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" autoFocus />
        <Field
          label="Görünen ad"
          value={displayName}
          onChange={setDisplayName}
          error={errors.displayName}
          optional
          hint="Diğerleri seni böyle görür. Boş bırakırsan kullanıcı adın kullanılır."
        />
        <Field
          label="Kullanıcı adı"
          value={username}
          onChange={(v) => setUsername(v.toLowerCase())}
          error={errors.username}
          autoComplete="username"
          hint="Benzersiz olmalı. Küçük harf, rakam, _ ve . kullanabilirsin."
        />
        <Field
          label="Şifre"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
          hint="En az 8 karakter, en az bir harf ve bir rakam."
        />
        <Field label="Şifre (tekrar)" type="password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" />

        <button className="primary" disabled={loading}>
          {loading ? <span className="spinner" aria-label="Hesap oluşturuluyor" /> : 'Hesap Aç'}
        </button>
      </form>
      <p className="footer-text">
        Zaten hesabın var mı? <Link to="/login" state={{ from }} className="link">Giriş yap</Link>
      </p>
    </AuthCard>
  )
}
