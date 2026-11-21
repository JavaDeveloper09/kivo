import { useState } from 'react'
import Modal from '../Modal'
import Field from '../Field'
import { api, ApiError } from '../../lib/api'
import type { ChannelType } from '../../lib/types'

type Props = { serverId: string; initialType: ChannelType; onClose: () => void }

export default function ChannelModal({ serverId, initialType, onClose }: Props) {
  const [type, setType] = useState<ChannelType>(initialType)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Kanal adı boş olamaz.')
    setLoading(true)
    try {
      // Yeni kanal ekrana WebSocket'ten "channel:created" olarak gelir
      await api(`/servers/${serverId}/channels`, { name, type })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bir şeyler ters gitti.')
      setLoading(false)
    }
  }

  return (
    <Modal title="Kanal oluştur" onClose={onClose}>
      <div className="segmented">
        <button className={type === 'TEXT' ? 'active' : ''} onClick={() => setType('TEXT')}># Yazı</button>
        <button className={type === 'VOICE' ? 'active' : ''} onClick={() => setType('VOICE')}>Ses</button>
      </div>
      <form onSubmit={submit} noValidate>
        <Field
          label="Kanal adı"
          value={name}
          onChange={setName}
          error={error}
          autoFocus
          hint={type === 'TEXT' ? 'Boşluklar tireye çevrilir: "oyun sohbeti" → oyun-sohbeti' : 'Ses kanalları yakında aktif olacak.'}
        />
        <button className="primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Oluştur'}</button>
      </form>
    </Modal>
  )
}
