import { useEffect } from 'react'
import Modal from '../Modal'
import { canChooseOutput, type VoiceApi } from '../../lib/useVoice'

// Cihaz adı boş gelirse (izin verilmemişse) okunabilir bir ad göster
const label = (d: MediaDeviceInfo, i: number, kind: string) =>
  d.deviceId === 'default' ? `Varsayılan${d.label ? ` (${d.label.replace(/^Default - |^Varsayılan - /, '')})` : ''}` : d.label || `${kind} ${i + 1}`

export default function VoiceSettingsModal({ voice, onClose }: { voice: VoiceApi; onClose: () => void }) {
  const { inputs, outputs, inputId, outputId, refresh, chooseInput, chooseOutput } = voice.devices

  // Pencere açılınca listeyi tazele (yeni takılan kulaklık görünsün)
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Modal title="Ses ayarları" onClose={onClose}>
      <div className="settings-field">
        <label htmlFor="voice-input">Mikrofon</label>
        <select id="voice-input" value={inputId} onChange={(e) => chooseInput(e.target.value)}>
          {!inputs.some((d) => d.deviceId === 'default') && <option value="">Varsayılan</option>}
          {inputs.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>{label(d, i, 'Mikrofon')}</option>
          ))}
        </select>
      </div>

      <div className="settings-field">
        <label htmlFor="voice-output">Kulaklık / hoparlör</label>
        {canChooseOutput ? (
          <select id="voice-output" value={outputId} onChange={(e) => chooseOutput(e.target.value)}>
            {!outputs.some((d) => d.deviceId === 'default') && <option value="">Varsayılan</option>}
            {outputs.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{label(d, i, 'Çıkış')}</option>
            ))}
          </select>
        ) : (
          <p className="settings-note">
            Bu tarayıcı ses çıkışını seçmeye izin vermiyor. Chrome veya Edge kullanabilir ya da Windows ses ayarlarından
            (görev çubuğundaki hoparlör simgesi) kulaklığı seçebilirsin.
          </p>
        )}
      </div>

      <p className="settings-note">Seçimlerin bu tarayıcıda hatırlanır. Kulaklığı sonradan taktıysan listede görünmesi için bu pencereyi kapatıp yeniden aç.</p>
    </Modal>
  )
}
