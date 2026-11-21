import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import Field from '../components/Field'
import { api, ApiError } from '../lib/api'
import { validateEmail } from '../lib/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateEmail(email)
    setError(v)
    if (v) return
    setLoading(true)
    try {
      await api('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bir şeyler ters gitti.')
    } finally {
      setLoading(false)
    }
  }

  if (sent)
    return (
      <AuthCard title="E-postanı kontrol et" subtitle={`${email} kayıtlıysa şifre sıfırlama linki gönderdik. Link 30 dakika geçerli.`}>
        <Link to="/login" className="primary as-link">Girişe dön</Link>
      </AuthCard>
    )

  return (
    <AuthCard title="Şifreni mi unuttun?" subtitle="Hesabının e-postasını gir, sana sıfırlama linki gönderelim.">
      <form onSubmit={onSubmit} noValidate>
        <Field label="E-posta" type="email" value={email} onChange={setEmail} error={error} autoComplete="email" autoFocus />
        <button className="primary" disabled={loading}>
          {loading ? <span className="spinner" aria-label="Gönderiliyor" /> : 'Link Gönder'}
        </button>
      </form>
      <p className="footer-text"><Link to="/login" className="link">Girişe dön</Link></p>
    </AuthCard>
  )
}
