import { useState } from 'react'
import Modal from '../Modal'

export default function InviteModal({ serverName, inviteCode, onClose }: { serverName: string; inviteCode: string; onClose: () => void }) {
  const link = `${window.location.origin}/invite/${inviteCode}`
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Tarayıcı izin vermezse kullanıcı elle seçip kopyalayabilir
    }
  }

  return (
    <Modal title={`${serverName} sunucusuna davet et`} onClose={onClose}>
      <p>Bu linki arkadaşlarına gönder. Linke tıklayan herkes sunucuya katılabilir.</p>
      <div className="copy-row">
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Davet linki" />
        <button className="primary" onClick={copy}>{copied ? 'Kopyalandı!' : 'Kopyala'}</button>
      </div>
    </Modal>
  )
}
