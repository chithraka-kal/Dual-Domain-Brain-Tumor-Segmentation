'use client'

import { AlertTriangle } from 'lucide-react'

interface DisclaimerBannerProps {
  variant?: 'full' | 'compact' | 'pill'
}

export default function DisclaimerBanner({ variant = 'full' }: DisclaimerBannerProps) {
  if (variant === 'pill') {
    return (
      <span
        className="badge"
        style={{
          background: 'var(--color-warning)',
          color: '#fff',
          fontSize: '0.7rem',
        }}
        title="This is a research demonstration tool only. Not for clinical use."
      >
        <AlertTriangle size={10} strokeWidth={2.5} />
        Research Demo Only
      </span>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        style={{
          background: 'rgba(224,164,88,.15)',
          borderLeft: '3px solid var(--color-warning)',
          borderRadius: '0.375rem',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          fontSize: '0.8125rem',
          color: 'var(--color-text)',
        }}
      >
        <AlertTriangle
          size={14}
          style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }}
        />
        <span>
          <strong>Research Demo Only</strong> — Not a medical device. Not approved for
          clinical diagnosis or treatment decisions.
        </span>
      </div>
    )
  }

  // full variant
  return (
    <div
      style={{
        background: 'var(--color-danger)',
        color: '#fff',
        borderRadius: '0.75rem',
        padding: '1rem 1.5rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
      }}
    >
      <AlertTriangle
        size={28}
        style={{ flexShrink: 0, marginTop: 2 }}
        strokeWidth={2}
      />
      <div>
        <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
          ⚠ Research Demonstration Tool — Not For Clinical Use
        </p>
        <p style={{ fontSize: '0.9rem', opacity: 0.92, lineHeight: 1.5 }}>
          This is a <strong>research demonstration tool only</strong>. It is not a medical
          device, has not received regulatory approval from any authority, and{' '}
          <strong>must never be used for clinical diagnosis or treatment decisions</strong>.
          Results shown are experimental and intended solely for academic evaluation.
        </p>
      </div>
    </div>
  )
}
