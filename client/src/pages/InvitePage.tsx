import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { api, ApiError } from '../lib/api'

type Preview = { server: { id: string; name: string; memberCount: number }; alreadyMember: boolean }

export default function InvitePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    api<Preview>(`/invites/${encodeURIComponent(code)}`)
      .then(setPreview)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Davet yüklenemedi.'))
  }, [code])

  async function join() {
    setJoining(true)
    try {
      const { server } = await api<{ server: { id: string } }>(`/invites/${encodeURIComponent(code)}/join`, {})
      navigate('/', { state: { serverId: server.id } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Katılırken bir hata oluştu.')
      setJoining(false)
    }
  }

  if (error)
    return (
      <AuthCard title="Davet geçersiz" subtitle={error}>
        <Link to="/" className="primary as-link">Ana sayfaya dön</Link>
      </AuthCard>
    )

  if (!preview) return <div className="splash">Yükleniyor…</div>

  return (
    <AuthCard title={preview.server.name} subtitle={`${preview.server.memberCount} üye · Seni sunucuya davet ettiler`}>
      {preview.alreadyMember ? (
        <button className="primary" onClick={() => navigate('/', { state: { serverId: preview.server.id } })}>Sunucuya git</button>
      ) : (
        <button className="primary" onClick={join} disabled={joining}>
          {joining ? <span className="spinner" /> : 'Sunucuya katıl'}
        </button>
      )}
    </AuthCard>
  )
}
