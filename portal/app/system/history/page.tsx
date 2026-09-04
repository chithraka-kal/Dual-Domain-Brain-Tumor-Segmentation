'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, FileText, Upload, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Session {
  id: string
  created_at: string
  filename: string
  wt_dsc_dual: number | null
  notes: string | null
}

export default function HistoryPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('inference_sessions')
        .select('id, created_at, filename, wt_dsc_dual, notes')
        .order('created_at', { ascending: false })
        .limit(50)

      if (err) {
        // Table may not exist yet in the mock setup — show empty state
        setSessions([])
      } else {
        setSessions(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            Session History
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
            Your past inference runs — click to review results.
          </p>
        </div>
        <Link href="/system" className="btn btn-primary" style={{ padding: '0.5rem 1.1rem', fontSize: '0.875rem' }}>
          <Upload size={14} />
          New run
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          Loading…
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div
          className="card"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            background: 'var(--color-background)',
            border: '2px dashed var(--color-border)',
          }}
        >
          <FileText size={48} style={{ color: 'var(--color-surface-alt)', margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No sessions yet</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            Run your first comparison to see results here.
          </p>
          <Link href="/system" className="btn btn-primary">
            <Upload size={14} />
            Upload & run
          </Link>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)')}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '0.625rem',
                  background: 'var(--color-surface-alt)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FileText size={18} style={{ color: 'var(--color-primary)' }} />
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'var(--color-text)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.filename || 'Unnamed session'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.125rem 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={11} />
                  {new Date(s.created_at).toLocaleString()}
                  {s.wt_dsc_dual != null && (
                    <span style={{ marginLeft: '0.75rem' }}>
                      WT DSC (dual): <strong style={{ color: 'var(--color-primary)' }}>{s.wt_dsc_dual.toFixed(3)}</strong>
                    </span>
                  )}
                </p>
                {s.notes && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.notes}
                  </p>
                )}
              </div>

              <ChevronRight size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
