'use client'

import Image from 'next/image'
import ColorLegend from './ColorLegend'
import type { InferenceResult } from '@/lib/api'

interface ComparisonPanelProps {
  result: InferenceResult
}

interface PanelItem {
  label: string
  subtitle: string
  src: string
  accent?: string
}

export default function ComparisonPanel({ result }: ComparisonPanelProps) {
  const panels: PanelItem[] = [
    {
      label: 'T2w MRI',
      subtitle: `Axial slice z=${result.displaySlice}`,
      src: result.originalImage,
    },
    {
      label: 'Baseline U-Net',
      subtitle: 'Spatial only',
      src: result.baselineImage,
      accent: 'var(--color-text-muted)',
    },
    {
      label: 'Dual-Domain U-Net',
      subtitle: 'Proposed model',
      src: result.dualDomainImage,
      accent: 'var(--color-primary)',
    },
    ...(result.groundTruthImage
      ? [
          {
            label: 'Ground Truth',
            subtitle: 'Expert annotation',
            src: result.groundTruthImage,
            accent: 'var(--color-success)',
          } as PanelItem,
        ]
      : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${panels.length}, 1fr)`,
          gap: '0.75rem',
        }}
      >
        {panels.map((panel) => (
          <div
            key={panel.label}
            className="card"
            style={{
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-background)',
              }}
            >
              <p
                style={{
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: panel.accent ?? 'var(--color-primary-dark)',
                  margin: 0,
                }}
              >
                {panel.label}
              </p>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  margin: 0,
                }}
              >
                {panel.subtitle}
              </p>
            </div>

            {/* Image */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                background: '#1a1a2e',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={panel.src}
                alt={panel.label}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        ))}
      </div>

      <ColorLegend />
    </div>
  )
}
