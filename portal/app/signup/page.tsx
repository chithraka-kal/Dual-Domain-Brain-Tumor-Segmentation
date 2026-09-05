'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brain, Mail, Lock, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

function validateEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const setField = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }))
    setErrors((p) => ({ ...p, [f]: '', general: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!validateEmail(form.email)) e.email = 'Please enter a valid email address.'
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSignup = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/login`
      : 'https://dual-domain-brain-tumor-segmentatio.vercel.app/login'

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    setLoading(false)
    if (error) {
      setErrors({ general: error.message })
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
        }}
      >
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '2.5rem', textAlign: 'center' }}>
          <CheckCircle size={48} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Check your email</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            We sent a confirmation link to <strong>{form.email}</strong>. Verify your email then sign in.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ justifyContent: 'center', width: '100%' }}>
            Go to sign in
          </Link>
        </div>
      </div>
    )
  }

  const inputRow = (
    id: string,
    label: string,
    type: string,
    field: keyof typeof form,
    placeholder: string,
    icon: React.ReactNode,
    extra?: React.ReactNode
  ) => (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-primary-dark)' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }}>
          {icon}
        </span>
        <input
          id={id}
          type={type}
          autoComplete={field === 'password' ? 'new-password' : field === 'confirm' ? 'new-password' : 'email'}
          className={`form-field${errors[field] ? ' error' : ''}`}
          style={{ paddingLeft: 36, ...(extra ? { paddingRight: 40 } : {}) }}
          value={form[field]}
          onChange={(e) => setField(field, e.target.value)}
          placeholder={placeholder}
        />
        {extra}
      </div>
      {errors[field] && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <AlertCircle size={12} /> {errors[field]}
        </p>
      )}
    </div>
  )

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: 'var(--color-background)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '0.875rem',
              background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <Brain size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            Create account
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Access the segmentation demo portal
          </p>
        </div>

        {errors.general && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 0.875rem',
              background: 'rgba(214,69,69,.08)',
              border: '1px solid rgba(214,69,69,.25)',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: 'var(--color-danger)',
            }}
          >
            <AlertCircle size={15} /> {errors.general}
          </div>
        )}

        <form onSubmit={handleSignup} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {inputRow('signup-email', 'Email', 'email', 'email', 'you@example.com', <Mail size={15} />)}
          {inputRow(
            'signup-password', 'Password', showPw ? 'text' : 'password', 'password', '8+ characters', <Lock size={15} />,
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {inputRow('signup-confirm', 'Confirm password', showPw ? 'text' : 'password', 'confirm', 'Repeat password', <Lock size={15} />)}

          <button
            id="signup-submit-btn"
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
          >
            {loading ? (
              <>
                <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sign in</Link>
        </p>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', lineHeight: 1.5 }}>
          By continuing you acknowledge this is a <strong>research demo, not a clinical tool</strong>.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
