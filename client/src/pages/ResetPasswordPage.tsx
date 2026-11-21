import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Field from '../components/Field'
import { api, ApiError } from '../lib/api'
import { validatePassword } from '../lib/validation'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!token)
    return (
      <AuthCard title="Geçersiz link" subtitle="Bu sıfırlama linki eksik veya bozuk.">
        <Link to="/forgot-password" className="primary as-link">Yeni link iste</Link>
      </AuthCard>
    )

  if (done)
    return (
      <AuthCard title="Şifren değişti" subtitle="Artık yeni şifrenle giriş yapabilirsin.">
        <Link to="/login" className="primary as-link">Giriş yap</Link>
      </AuthCard>
    )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const v = { password: validatePassword(password), confirm: confirm !== password ? 'Şifreler eşleşmiyor.' : null }
    setErrors(v)
    if (v.password || v.confirm) return
    setLoading(true)
    try {
      await api('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Bir şeyler ters gitti.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Yeni şifre belirle">
      <form onSubmit={onSubmit} noValidate>
        {formError && <div className="form-error" role="alert">{formError}</div>}
        <Field label="Yeni şifre" type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" hint="En az 8 karakter, en az bir harf ve bir rakam." autoFocus />
        <Field label="Yeni şifre (tekrar)" type="password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" />
        <button className="primary" disabled={loading}>
          {loading ? <span className="spinner" aria-label="Kaydediliyor" /> : 'Şifreyi Değiştir'}
        </button>
      </form>
    </AuthCard>
  )
}
