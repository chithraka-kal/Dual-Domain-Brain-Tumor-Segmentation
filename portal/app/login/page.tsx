'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Brain, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface FormState {
  email: string
  password: string
  errors: { email?: string; password?: string; general?: string }
  loading: boolean
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/system'
  const supabase = createClient()

  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    errors: {},
    loading: false,
  })
  const [showPw, setShowPw] = useState(false)

  const setField = (field: 'email' | 'password', value: string) => {
    setForm((f) => ({ ...f, [field]: value, errors: { ...f.errors, [field]: undefined, general: undefined } }))
  }

  const validate = (): boolean => {
    const errors: FormState['errors'] = {}
    if (!validateEmail(form.email)) errors.email = 'Please enter a valid email address.'
    if (form.password.length < 6) errors.password = 'Password must be at least 6 characters.'
    setForm((f) => ({ ...f, errors }))
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setForm((f) => ({ ...f, loading: true, errors: {} }))

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (error) {
      setForm((f) => ({
        ...f,
        loading: false,
        errors: {
          general:
            error.message === 'Invalid login credentials'
              ? 'Incorrect email or password.'
              : error.message,
        },
      }))
      return
    }

    router.push(next)
    router.refresh()
  }

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
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '2rem',
        }}
      >
        {/* Header */}
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
            Sign in
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Access the segmentation demo portal
          </p>
        </div>

        {/* General error */}
        {form.errors.general && (
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
            <AlertCircle size={15} />
            {form.errors.general}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Email */}
          <div>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-primary-dark)' }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                className={`form-field${form.errors.email ? ' error' : ''}`}
                style={{ paddingLeft: 36 }}
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {form.errors.email && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={12} /> {form.errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-primary-dark)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className={`form-field${form.errors.password ? ' error' : ''}`}
                style={{ paddingLeft: 36, paddingRight: 40 }}
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {form.errors.password && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <AlertCircle size={12} /> {form.errors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={form.loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
          >
            {form.loading ? (
              <>
                <span
                  style={{
                    width: 15,
                    height: 15,
                    border: '2px solid rgba(255,255,255,.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Toggle to signup */}
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Create one
          </Link>
        </p>

        {/* Short disclaimer */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            marginTop: '1rem',
            borderTop: '1px solid var(--color-border)',
            paddingTop: '1rem',
            lineHeight: 1.5,
          }}
        >
          By continuing you acknowledge this is a <strong>research demo, not a clinical tool</strong>.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
