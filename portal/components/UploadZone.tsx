'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, File, X, AlertCircle } from 'lucide-react'

const ALLOWED_EXTENSIONS = ['.nii', '.nii.gz']
const MAX_SIZE_MB = 500

function isValidFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const valid = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
  if (!valid) return `Invalid file type. Expected .nii or .nii.gz`
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `File too large (max ${MAX_SIZE_MB} MB)`
  return null
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface UploadZoneProps {
  id: string
  label: string
  required?: boolean
  value: File | null
  onChange: (file: File | null) => void
}

export default function UploadZone({ id, label, required, value, onChange }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const err = isValidFile(file)
    if (err) {
      setError(err)
      onChange(null)
    } else {
      setError(null)
      onChange(file)
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const clear = () => {
    setError(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label
        htmlFor={id}
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-primary-dark)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
      </label>

      {value ? (
        // Accepted file chip
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.625rem 0.875rem',
            background: 'var(--color-success)',
            borderRadius: '0.5rem',
            border: '1.5px solid rgba(20,150,127,.3)',
          }}
        >
          <File size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value.name}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {formatBytes(value.size)}
          </span>
          <button
            type="button"
            onClick={clear}
            style={{ color: 'var(--color-text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' }}
            aria-label="Remove file"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        // Drop zone
        <div
          id={id}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${error ? 'var(--color-danger)' : dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: '0.625rem',
            padding: '1.25rem 1rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(20,150,127,.05)' : error ? 'rgba(214,69,69,.04)' : 'var(--color-background)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Upload size={22} style={{ color: error ? 'var(--color-danger)' : 'var(--color-primary)' }} />
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Drag & drop or{' '}
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>browse files</span>
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Accepted: .nii, .nii.gz
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        id={`${id}-input`}
        type="file"
        accept=".nii,.gz"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      {error && (
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem', color: 'var(--color-danger)', margin: 0 }}>
          <AlertCircle size={13} />
          {error}
        </p>
      )}
    </div>
  )
}
