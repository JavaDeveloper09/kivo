import { useState } from 'react'
import Modal from '../Modal'
import Field from '../Field'
import { api, ApiError } from '../../lib/api'
import type { ServerDetail } from '../../lib/types'

type Props = { onClose: () => void; onDone: (server: ServerDetail) => void }

// Davet linkinin tamamı da yapıştırılabilir: ".../invite/AbC123xy" -> "AbC123xy"
const extractCode = (input: string) => input.trim().split('/').filter(Boolean).pop() ?? ''

export default function ServerModal({ onClose, onDone }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'create' && value.trim().length < 2) return setError('Sunucu adı en az 2 karakter olmalı.')
    if (mode === 'join' && !extractCode(value)) return setError('Davet linki veya kodu gir.')
    setLoading(true)
    try {
      const { server } =
        mode === 'create'
          ? await api<{ server: ServerDetail }>('/servers', { name: value })
          : await api<{ server: ServerDetail }>(`/invites/${encodeURIComponent(extractCode(value))}/join`, {})
      onDone(server)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bir şeyler ters gitti.')
    } finally {
      setLoading(false)
    }
  }

  const switchTo = (m: 'create' | 'join') => {
    setMode(m)
    setValue('')
    setError(null)
  }

  return (
    <Modal title={mode === 'create' ? 'Sunucu oluştur' : 'Sunucuya katıl'} onClose={onClose}>
      <div className="segmented">
        <button className={mode === 'create' ? 'active' : ''} onClick={() => switchTo('create')}>Oluştur</button>
        <button className={mode === 'join' ? 'active' : ''} onClick={() => switchTo('join')}>Davetle katıl</button>
      </div>
      <form onSubmit={submit} noValidate>
        {mode === 'create' ? (
          <Field label="Sunucu adı" value={value} onChange={setValue} error={error} autoFocus hint="Sonra değiştirebilirsin. Genel kanallar otomatik açılır." />
        ) : (
          <Field label="Davet linki veya kodu" value={value} onChange={setValue} error={error} autoFocus hint="Örnek: http://localhost:5173/invite/AbC123xy" />
        )}
        <button className="primary" disabled={loading}>
          {loading ? <span className="spinner" /> : mode === 'create' ? 'Oluştur' : 'Katıl'}
        </button>
      </form>
    </Modal>
  )
}
