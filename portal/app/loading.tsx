import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <Loader2
        size={36}
        style={{
          color: 'var(--color-primary, #14967f)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>
        Loading page…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
