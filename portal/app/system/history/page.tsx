'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import {
  Clock,
  FileText,
  Upload,
  ChevronRight,
  ArrowLeft,
  Save,
  Download,
  Trash2,
  Check,
  Monitor,
  CheckCircle2,
  Loader2,
  Edit3,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import ComparisonPanel from '@/components/ComparisonPanel'
import DiceScoreTable from '@/components/DiceScoreTable'
import DiceBarChart from '@/components/DiceBarChart'
import type { InferenceResult, RegionDice } from '@/lib/api'

interface Session {
  id: string
  created_at: string
  filename: string
  volume_shape: string | null
  display_slice: number | null
  original_image: string | null
  baseline_image: string | null
  dual_domain_image: string | null
  ground_truth_image: string | null
  baseline_dice: RegionDice | null
  dual_domain_dice: RegionDice | null
  wt_dsc_dual: number | null
  inference_time_seconds: number | null
  device: string | null
  notes: string | null
}

export default function HistoryPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  // Edit Note State
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  
  const [exporting, setExporting] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  const fetchSessions = async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('inference_sessions')
      .select('id, created_at, filename, volume_shape, display_slice, original_image, baseline_image, dual_domain_image, ground_truth_image, baseline_dice, dual_domain_dice, wt_dsc_dual, inference_time_seconds, device, notes')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!err && data) {
      setSessions(data as Session[])
    } else {
      setSessions([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleSelectSession = (s: Session) => {
    setSelectedSession(s)
    setSessionNotes(s.notes || '')
    setIsEditingNote(false)
    setNotesSaved(false)
  }

  const handleSaveNotes = async () => {
    if (!selectedSession) return
    const updatedNotes = sessionNotes.trim()

    try {
      await supabase
        .from('inference_sessions')
        .update({ notes: updatedNotes || null })
        .eq('id', selectedSession.id)

      // Update local state
      setSessions((prev) =>
        prev.map((item) =>
          item.id === selectedSession.id ? { ...item, notes: updatedNotes || null } : item
        )
      )
      setSelectedSession((prev) => (prev ? { ...prev, notes: updatedNotes || null } : null))
      setNotesSaved(true)
      setIsEditingNote(false)
    } catch (err) {
      console.warn('Failed to update notes in Supabase:', err)
    }

    setTimeout(() => setNotesSaved(false), 2500)
  }

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session from history?')) return
    try {
      await supabase.from('inference_sessions').delete().eq('id', id)
      setSessions((prev) => prev.filter((item) => item.id !== id))
      if (selectedSession?.id === id) {
        setSelectedSession(null)
      }
    } catch (err) {
      console.warn('Failed to delete session:', err)
    }
  }

  const handleExportPdf = async () => {
    if (!resultsRef.current || !selectedSession) return
    setExporting(true)
    try {
      const { exportResultsPdf } = await import('@/lib/exportPdf')
      await exportResultsPdf(resultsRef.current, {
        result: {
          originalImage: selectedSession.original_image || '',
          baselineImage: selectedSession.baseline_image || '',
          dualDomainImage: selectedSession.dual_domain_image || '',
          groundTruthImage: selectedSession.ground_truth_image || null,
          baselineDice: selectedSession.baseline_dice,
          dualDomainDice: selectedSession.dual_domain_dice,
          inferenceTimeSeconds: selectedSession.inference_time_seconds || 15.0,
          device: selectedSession.device || 'CPU',
          volumeShape: selectedSession.volume_shape || '240×240×155',
          displaySlice: selectedSession.display_slice || 77,
        },
        filename: selectedSession.filename,
        notes: sessionNotes,
        timestamp: new Date(selectedSession.created_at).toLocaleString(),
      })
    } finally {
      setExporting(false)
    }
  }

  // Helper to reconstruct InferenceResult object for ComparisonPanel
  const getInferenceResultObj = (s: Session): InferenceResult | null => {
    if (!s.original_image || !s.baseline_image || !s.dual_domain_image) return null
    return {
      originalImage: s.original_image,
      baselineImage: s.baseline_image,
      dualDomainImage: s.dual_domain_image,
      groundTruthImage: s.ground_truth_image,
      baselineDice: s.baseline_dice,
      dualDomainDice: s.dual_domain_dice,
      inferenceTimeSeconds: s.inference_time_seconds || 15.0,
      device: s.device || 'CPU',
      volumeShape: s.volume_shape || '240×240×155',
      displaySlice: s.display_slice || 77,
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            Session History
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
            Review past inference runs, view slice images, compare Dice metrics, and edit notes.
          </p>
        </div>
        <Link href="/system" className="btn btn-primary" style={{ padding: '0.5rem 1.1rem', fontSize: '0.875rem' }}>
          <Upload size={14} />
          New run
        </Link>
      </div>

      {/* ── LOADING STATE ────────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          Loading session history…
        </div>
      )}

      {/* ── EMPTY STATE ──────────────────────────────────────────────────────── */}
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
            Run your first comparison to see saved results and metrics here.
          </p>
          <Link href="/system" className="btn btn-primary">
            <Upload size={14} />
            Upload & run
          </Link>
        </div>
      )}

      {/* ── DETAILED SESSION VIEW ────────────────────────────────────────────── */}
      {!loading && selectedSession ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Back & Delete button row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setSelectedSession(null)}
              className="btn btn-outline"
              style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem', gap: '0.4rem' }}
            >
              <ArrowLeft size={14} />
              Back to History List
            </button>
            <button
              onClick={() => handleDeleteSession(selectedSession.id)}
              style={{
                color: 'var(--color-danger)',
                background: 'rgba(214,69,69,.08)',
                border: '1px solid rgba(214,69,69,.2)',
                borderRadius: '0.5rem',
                padding: '0.4rem 0.875rem',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
              }}
            >
              <Trash2 size={13} />
              Delete session
            </button>
          </div>

          {/* Detailed Card Container */}
          <div ref={resultsRef} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Title & Timestamp */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <FileText size={20} style={{ color: 'var(--color-primary)' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                    {selectedSession.filename}
                  </h2>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={12} />
                  Ran on {new Date(selectedSession.created_at).toLocaleString()}
                </p>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '1rem',
                  background: 'rgba(20,150,127,.1)',
                  color: 'var(--color-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={14} /> Completed
              </span>
            </div>

            {/* Saved Images Section */}
            {getInferenceResultObj(selectedSession) ? (
              <div className="card" style={{ padding: '1.25rem', background: '#fafbfc' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-primary-dark)', marginBottom: '0.875rem' }}>
                  Segmentation Overlays & Visual Comparison
                </h3>
                <ComparisonPanel result={getInferenceResultObj(selectedSession)!} />
              </div>
            ) : null}

            {/* Metadata Stats Bar */}
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                flexWrap: 'wrap',
                padding: '0.875rem 1.25rem',
                background: 'var(--color-background)',
                borderRadius: '0.625rem',
                border: '1px solid var(--color-border)',
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
              }}
            >
              {selectedSession.inference_time_seconds != null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                  Inference Time: <strong style={{ color: 'var(--color-text)' }}>{selectedSession.inference_time_seconds.toFixed(1)}s</strong>
                </span>
              )}
              {selectedSession.device && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Monitor size={14} style={{ color: 'var(--color-primary)' }} />
                  Device: <strong style={{ color: 'var(--color-text)' }}>{selectedSession.device}</strong>
                </span>
              )}
              {selectedSession.volume_shape && (
                <span>
                  Volume Shape: <strong style={{ color: 'var(--color-text)' }}>{selectedSession.volume_shape}</strong>
                </span>
              )}
              {selectedSession.display_slice != null && (
                <span>
                  Slice: <strong style={{ color: 'var(--color-text)' }}>z={selectedSession.display_slice}</strong>
                </span>
              )}
            </div>

            {/* Dice Scores Section */}
            {selectedSession.baseline_dice && selectedSession.dual_domain_dice ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <DiceScoreTable baseline={selectedSession.baseline_dice} dualDomain={selectedSession.dual_domain_dice} />
                <DiceBarChart baseline={selectedSession.baseline_dice} dualDomain={selectedSession.dual_domain_dice} />
              </div>
            ) : (
              <div style={{ padding: '1.25rem', background: 'var(--color-background)', borderRadius: '0.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                <em>No ground truth segmentation uploaded for this run to compute Dice scores.</em>
              </div>
            )}

            {/* Notes Section with Explicit Edit Note Toggle */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label
                  style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-primary-dark)', margin: 0 }}
                >
                  Notes for this session
                </label>

                {!isEditingNote && (
                  <button
                    onClick={() => setIsEditingNote(true)}
                    className="btn btn-outline"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', gap: '0.35rem' }}
                  >
                    <Edit3 size={13} />
                    Edit note
                  </button>
                )}
              </div>

              {isEditingNote ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <textarea
                    id="history-session-notes"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Add observations, patient notes, or remarks for this run…"
                    rows={4}
                    className="form-field"
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      id="save-history-notes-btn"
                      onClick={handleSaveNotes}
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', gap: '0.35rem' }}
                    >
                      <Save size={14} />
                      Save note
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingNote(false)
                        setSessionNotes(selectedSession.notes || '')
                      }}
                      className="btn btn-outline"
                      style={{ padding: '0.45rem 0.875rem', fontSize: '0.8125rem', gap: '0.35rem' }}
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    background: 'var(--color-background)',
                    borderRadius: '0.625rem',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    color: selectedSession.notes ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontStyle: selectedSession.notes ? 'normal' : 'italic',
                  }}
                >
                  {selectedSession.notes || 'No notes added for this session yet. Click "Edit note" to add observations.'}
                </div>
              )}

              {notesSaved && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check size={14} /> Note saved successfully
                </div>
              )}

              {/* PDF Export Button Row */}
              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  id="export-pdf-history-btn"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem', gap: '0.4rem' }}
                >
                  {exporting ? (
                    <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Exporting…</>
                  ) : (
                    <><Download size={14} /> Export PDF Report</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── SESSIONS LIST VIEW ─────────────────────────────────────────────── */
        !loading && sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s)}
                className="card"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: '1px solid var(--color-border)',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(20,150,127,.08)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}
              >
                {/* File Icon Box */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '0.75rem',
                    background: 'rgba(20,150,127,.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FileText size={20} style={{ color: 'var(--color-primary)' }} />
                </div>

                {/* Info Text */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: 'var(--color-text)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.filename || 'Unnamed session'}
                    </p>
                    {s.wt_dsc_dual != null && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(20,150,127,.1)',
                          color: 'var(--color-primary)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.375rem',
                          flexShrink: 0,
                        }}
                      >
                        WT DSC: {s.wt_dsc_dual.toFixed(3)}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.78125rem', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={12} />
                    {new Date(s.created_at).toLocaleString()}
                    {s.device && <span style={{ opacity: 0.75 }}>• {s.device}</span>}
                    {s.volume_shape && <span style={{ opacity: 0.75 }}>• {s.volume_shape}</span>}
                  </p>

                  {s.notes && (
                    <p style={{ fontSize: '0.78125rem', color: 'var(--color-primary-dark)', margin: '0.35rem 0 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{s.notes}"
                    </p>
                  )}
                </div>

                {/* Right Arrow / Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <span>View Details</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
