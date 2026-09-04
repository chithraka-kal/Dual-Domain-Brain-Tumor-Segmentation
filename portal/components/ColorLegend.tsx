export default function ColorLegend() {
  const items = [
    { label: 'Whole Tumor (WT)', color: '#FF6B6B' },
    { label: 'Tumor Core (TC)', color: '#4ECDC4' },
    { label: 'Enhancing Tumor (ET)', color: '#FFE66D' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.25rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '0.5rem 0.75rem',
        background: 'rgba(9,93,126,.05)',
        borderRadius: '0.5rem',
        fontSize: '0.8125rem',
        color: 'var(--color-text-muted)',
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--color-primary-dark)', marginRight: '0.25rem' }}>
        Legend:
      </span>
      {items.map(({ label, color }) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: color,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          {label}
        </span>
      ))}
    </div>
  )
}
