'use client'

import type { RegionDice } from '@/lib/api'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DiceScoreTableProps {
  baseline: RegionDice
  dualDomain: RegionDice
}

const REGIONS = [
  { key: 'wt' as const, label: 'Whole Tumor', abbr: 'WT', color: '#FF6B6B' },
  { key: 'tc' as const, label: 'Tumor Core', abbr: 'TC', color: '#4ECDC4' },
  { key: 'et' as const, label: 'Enhancing Tumor', abbr: 'ET', color: '#FFE66D' },
]

function DeltaCell({ delta }: { delta: number }) {
  const abs = Math.abs(delta)
  const sign = delta > 0.001 ? '+' : delta < -0.001 ? '−' : '±'
  const color = delta > 0.001 ? '#14967f' : delta < -0.001 ? '#d64545' : '#5a7d85'
  const Icon = delta > 0.001 ? TrendingUp : delta < -0.001 ? TrendingDown : Minus

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontWeight: 700,
        color,
        fontSize: '0.9rem',
      }}
    >
      <Icon size={14} />
      {sign}{abs.toFixed(4)}
    </span>
  )
}

export default function DiceScoreTable({ baseline, dualDomain }: DiceScoreTableProps) {
  return (
    <div>
      <h3
        style={{
          fontSize: '0.9375rem',
          fontWeight: 700,
          color: 'var(--color-primary-dark)',
          marginBottom: '0.75rem',
        }}
      >
        Dice Similarity Coefficient (DSC)
      </h3>

      <div
        style={{
          overflowX: 'auto',
          borderRadius: '0.625rem',
          border: '1px solid var(--color-border)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-background)' }}>
              <th style={thStyle}>Region</th>
              <th style={thStyle}>Baseline DSC</th>
              <th style={{ ...thStyle, color: 'var(--color-primary)' }}>Dual-Domain DSC</th>
              <th style={thStyle}>Δ Improvement</th>
            </tr>
          </thead>
          <tbody>
            {REGIONS.map((r, i) => {
              const b = baseline[r.key]
              const d = dualDomain[r.key]
              const delta = d - b
              return (
                <tr
                  key={r.key}
                  style={{
                    background: i % 2 === 0 ? '#fff' : 'var(--color-background)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = 'var(--color-surface-alt)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      i % 2 === 0 ? '#fff' : 'var(--color-background)')
                  }
                >
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background: r.color,
                          flexShrink: 0,
                        }}
                      />
                      <strong>{r.abbr}</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                        {r.label}
                      </span>
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{b.toFixed(4)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {d.toFixed(4)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <DeltaCell delta={delta} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.625rem 1rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: 'var(--color-text-muted)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '0.625rem 1rem',
  borderBottom: '1px solid var(--color-border)',
}
