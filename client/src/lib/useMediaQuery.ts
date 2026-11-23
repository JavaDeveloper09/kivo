import { useEffect, useState } from 'react'

/** Ekran genişliği bir CSS media query'ye uyuyor mu? Pencere boyutu değişince güncellenir. */
export function useMediaQuery(query: string) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(get)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

// app.css'teki "Dar ekran" bölümüyle aynı sınır
export const MOBILE_QUERY = '(max-width: 900px)'
