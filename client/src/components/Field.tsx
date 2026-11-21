import { useId, useState } from 'react'

type Props = {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | null
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  hint?: string
  optional?: boolean
  autoFocus?: boolean
}

export default function Field({ label, value, onChange, error, type = 'text', autoComplete, hint, optional, autoFocus }: Props) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="field">
      <label htmlFor={id} className={error ? 'label error' : 'label'}>
        {label}
        {optional ? <span className="optional"> (isteğe bağlı)</span> : <span className="required"> *</span>}
        {error && <span className="label-error"> — {error}</span>}
      </label>
      <div className="input-wrap">
        <input
          id={id}
          type={isPassword && !show ? 'password' : isPassword ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          autoFocus={autoFocus}
        />
        {isPassword && (
          <button
            type="button"
            className="eye"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
            title={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            {show ? (
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2 4.3 3.3 3l17.7 17.7-1.3 1.3-3.1-3.1A11 11 0 0 1 12 20C6.5 20 2.7 16.1 1 12c.8-2 2.2-3.9 4-5.3L2 4.3Zm7.5 7.5a2.5 2.5 0 0 0 2.7 2.7l-2.7-2.7ZM12 4c5.5 0 9.3 3.9 11 8-.6 1.5-1.5 2.9-2.6 4.1l-3.3-3.3A5 5 0 0 0 11.2 7l-2.5-2.5C9.8 4.2 10.9 4 12 4Z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 4C6.5 4 2.7 7.9 1 12c1.7 4.1 5.5 8 11 8s9.3-3.9 11-8c-1.7-4.1-5.5-8-11-8Zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
            )}
          </button>
        )}
      </div>
      {hint && !error && <div className="hint">{hint}</div>}
    </div>
  )
}
