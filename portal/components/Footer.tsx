'use client'

import { ExternalLink, FlaskConical } from 'lucide-react'

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        background: '#fff',
        padding: '2rem 1.5rem',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: '1 1 300px' }}>
          <FlaskConical size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-primary-dark)' }}>Dual-Domain Brain Tumor Segmentation</strong>{' '}
            - BSc Computer Science Final Year Project by{' '}
            <a
              id="footer-author-link"
              href="https://chithraka.dev/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
            >
              Chithraka Kalanamith Wickramasingha
            </a>, NSBM Green University.{' '}
            <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
              Research demonstration only - not for clinical use.
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            id="footer-portfolio-link"
            href="https://chithraka.dev/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)')}
          >
            <ExternalLink size={15} />
            Portfolio
          </a>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <a
            id="footer-github-link"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)')}
          >
            <ExternalLink size={15} />
            GitHub
          </a>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  )
}
