'use client'

import { useState, useRef } from 'react'
import {
  Play,
  Loader2,
  Download,
  Save,
  Clock,
  Monitor,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react'
import DisclaimerBanner from '@/components/DisclaimerBanner'
import UploadZone from '@/components/UploadZone'
import ComparisonPanel from '@/components/ComparisonPanel'
import DiceScoreTable from '@/components/DiceScoreTable'
import DiceBarChart from '@/components/DiceBarChart'
import { runInference, type InferenceResult, type SliceMode } from '@/lib/api'
import { createClient } from '@/lib/supabase'

type Phase = 'idle' | 'running' | 'done' | 'error'

export default function SystemPage() {
  // Upload state
  const [t2wFile, setT2wFile] = useState<File | null>(null)
  const [segFile, setSegFile] = useState<File | null>(null)
  const [sliceMode, setSliceMode] = useState<SliceMode>('auto')
  const [customSlice, setCustomSlice] = useState(77)

  // Run state
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<InferenceResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Notes
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)

  // PDF
  const [exporting, setExporting] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Elapsed timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
  }
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleRun = async () => {
    if (!t2wFile) return
    setPhase('running')
    setErrorMsg('')
    setResult(null)
    setActiveSessionId(null)
    startTimer()

    try {
      const res = await runInference(t2wFile, segFile, sliceMode, customSlice)
      stopTimer()
      setResult(res)
      setPhase('done')

      // Save session to Supabase
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('inference_sessions')
          .insert({
            filename: t2wFile.name,
            volume_shape: res.volumeShape,
            display_slice: res.displaySlice,
            original_image: res.originalImage,
            baseline_image: res.baselineImage,
            dual_domain_image: res.dualDomainImage,
            ground_truth_image: res.groundTruthImage,
            baseline_dice: res.baselineDice,
            dual_domain_dice: res.dualDomainDice,
            wt_dsc_dual: res.dualDomainDice?.wt ?? null,
            inference_time_seconds: res.inferenceTimeSeconds,
            device: res.device,
            notes: notes.trim() || null,
          })
          .select('id')
          .single()

        if (data?.id) {
          setActiveSessionId(data.id)
        }
      } catch (dbErr) {
        console.warn('Could not save session history to Supabase:', dbErr)
      }
    } catch (err) {
      stopTimer()
      setPhase('error')
      setErrorMsg(err instanceof Error ? err.message : 'Inference failed. Please try again.')
    }
  }

  const handleSaveNotes = async () => {
    setNotesSaved(true)
    if (activeSessionId && notes.trim()) {
      try {
        const supabase = createClient()
        await supabase
          .from('inference_sessions')
          .update({ notes: notes.trim() })
          .eq('id', activeSessionId)
      } catch (err) {
        console.warn('Failed to update notes in Supabase:', err)
      }
    }
    setTimeout(() => setNotesSaved(false), 2500)
  }

  const handleExportPdf = async () => {
    if (!resultsRef.current || !result) return
    setExporting(true)
    try {
      const { exportResultsPdf } = await import('@/lib/exportPdf')
      await exportResultsPdf(resultsRef.current, {
        result,
        filename: t2wFile?.name ?? 'unknown',
        notes,
        timestamp: new Date().toLocaleString(),
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page heading */}
      <div>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          Segmentation Comparison
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
          Upload a BraTS T2-weighted volume to compare the baseline and dual-domain U-Net models.
        </p>
      </div>

      <DisclaimerBanner variant="compact" />

      {/* Main grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* ── LEFT PANEL: Upload + controls ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Upload</h2>

            <UploadZone
              id="t2w-upload"
              label="T2-weighted MRI volume (.nii / .nii.gz)"
              required
              value={t2wFile}
              onChange={setT2wFile}
            />

            <UploadZone
              id="seg-upload"
              label="Ground truth segmentation (optional)"
              value={segFile}
              onChange={setSegFile}
            />

            {/* Slice mode */}
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary-dark)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sliders size={14} />
                Slice selection
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['auto', 'manual'] as SliceMode[]).map((m) => (
                  <button
                    key={m}
                    id={`slice-mode-${m}`}
                    type="button"
                    onClick={() => setSliceMode(m)}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1.5px solid',
                      borderColor: sliceMode === m ? 'var(--color-primary)' : 'var(--color-border)',
                      background: sliceMode === m ? 'rgba(20,150,127,.1)' : '#fff',
                      color: sliceMode === m ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {m === 'auto' ? 'Auto (best slice)' : 'Manual'}
                  </button>
                ))}
              </div>

              {sliceMode === 'manual' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label htmlFor="custom-slice-slider" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Slice index (z)</span>
                    <strong style={{ color: 'var(--color-primary-dark)' }}>{customSlice}</strong>
                  </label>
                  <input
                    id="custom-slice-slider"
                    type="range"
                    min={0}
                    max={154}
                    value={customSlice}
                    onChange={(e) => setCustomSlice(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '0.375rem', accentColor: 'var(--color-primary)' }}
                  />
                </div>
              )}
            </div>

            {/* Run button */}
            <button
              id="run-comparison-btn"
              onClick={handleRun}
              disabled={!t2wFile || phase === 'running'}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.75rem' }}
            >
              {phase === 'running' ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                  Running inference… {elapsed}s
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Comparison
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT PANEL: Results ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          {phase === 'idle' && (
            <div
              className="card"
              style={{
                padding: '3rem',
                textAlign: 'center',
                background: 'var(--color-background)',
                border: '2px dashed var(--color-border)',
              }}
            >
              <Monitor size={40} style={{ color: 'var(--color-surface-alt)', margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
                Upload a T2w volume and click <strong>Run Comparison</strong> to see results.
              </p>
            </div>
          )}

          {phase === 'running' && (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <Loader2
                size={40}
                style={{ color: 'var(--color-primary)', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }}
              />
              <h3 style={{ marginBottom: '0.375rem' }}>Running inference…</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Both models are processing your volume. This typically takes 15–20 s on CPU.
              </p>
              <p style={{ color: 'var(--color-primary)', fontWeight: 700, marginTop: '0.75rem', fontSize: '1.25rem' }}>
                {elapsed}s elapsed
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div
              className="card"
              style={{
                padding: '1.5rem',
                background: 'rgba(214,69,69,.06)',
                border: '1px solid rgba(214,69,69,.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <span style={{ color: 'var(--color-danger)', fontSize: '1.25rem' }}>⚠</span>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: '0.25rem' }}>Inference failed</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{errorMsg}</p>
              </div>
            </div>
          )}

          {phase === 'done' && result && (
            <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Image comparison */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                  Segmentation Comparison
                </h2>
                <ComparisonPanel result={result} />
              </div>

              {/* Metadata row */}
              <div
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                  padding: '0.75rem 1rem',
                  background: 'var(--color-background)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={13} /> {result.inferenceTimeSeconds.toFixed(1)}s
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Monitor size={13} /> {result.device}
                </span>
                <span>Volume: {result.volumeShape}</span>
                <span>Slice z={result.displaySlice}</span>
              </div>

              {/* Dice scores (only if GT provided) */}
              {result.baselineDice && result.dualDomainDice && (
                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <DiceScoreTable baseline={result.baselineDice} dualDomain={result.dualDomainDice} />
                  <DiceBarChart baseline={result.baselineDice} dualDomain={result.dualDomainDice} />
                </div>
              )}

              {/* Notes */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <label
                  htmlFor="session-notes"
                  style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary-dark)', display: 'block', marginBottom: '0.5rem' }}
                >
                  Notes for this session
                </label>
                <textarea
                  id="session-notes"
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
                  placeholder="Add annotations, observations, or comments about this run…"
                  rows={3}
                  className="form-field"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'center' }}>
                  <button
                    id="save-notes-btn"
                    onClick={handleSaveNotes}
                    className="btn btn-outline"
                    style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}
                  >
                    <Save size={13} />
                    Save note
                  </button>
                  {notesSaved && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>✓ Saved</span>
                  )}

                  <button
                    id="export-pdf-btn"
                    onClick={handleExportPdf}
                    disabled={exporting}
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem', marginLeft: 'auto' }}
                  >
                    {exporting ? (
                      <><Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Exporting…</>
                    ) : (
                      <><Download size={13} /> Export as PDF</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
