export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo.svg" alt="" width="64" height="64" />
          <span>Kivo</span>
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
