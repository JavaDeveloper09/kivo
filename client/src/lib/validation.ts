// Backend'deki kurallarla aynı. Kullanıcı formu göndermeden hatayı görsün diye
// frontend'de de kontrol ediyoruz; asıl güvenlik kontrolü yine backend'de.
export function validateUsername(v: string): string | null {
  const s = v.trim().toLowerCase()
  if (s.length < 3) return 'Kullanıcı adı en az 3 karakter olmalı.'
  if (s.length > 32) return 'Kullanıcı adı en fazla 32 karakter olabilir.'
  if (!/^[a-z0-9_.]+$/.test(s)) return 'Sadece küçük harf, rakam, _ ve . kullanılabilir.'
  return null
}

export function validateEmail(v: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Geçerli bir e-posta gir.'
}

export function validatePassword(v: string): string | null {
  if (v.length < 8) return 'Şifre en az 8 karakter olmalı.'
  if (v.length > 72) return 'Şifre en fazla 72 karakter olabilir.'
  if (!/[A-Za-z]/.test(v)) return 'Şifrede en az bir harf olmalı.'
  if (!/[0-9]/.test(v)) return 'Şifrede en az bir rakam olmalı.'
  return null
}
