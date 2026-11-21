// İsimden sabit bir renk üretir: aynı kişi hep aynı renkte görünür
const COLORS = ['#2e7d4f', '#1f6f8b', '#8b5a2b', '#6a4c93', '#b23a48', '#3d7c47', '#a66a00', '#2b5c8a']

function colorFor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

export default function Avatar({ name, size = 36, online }: { name: string; size?: number; online?: boolean }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.42 }}>
      {name.charAt(0).toLocaleUpperCase('tr')}
      {online !== undefined && <span className={online ? 'status online' : 'status offline'} />}
    </div>
  )
}
