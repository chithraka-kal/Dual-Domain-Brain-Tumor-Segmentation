'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Brain, LogOut, LogIn, History, Cpu, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import DisclaimerBanner from './DisclaimerBanner'

interface NavbarProps {
  user?: { email?: string } | null
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLink = (href: string, label: string, icon: React.ReactNode) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.375rem 0.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: active ? 700 : 500,
          color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
          background: active ? 'rgba(20,150,127,.1)' : 'transparent',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
        }}
      >
        {icon}
        {label}
      </Link>
    )
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(241,249,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 1.5rem',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
              borderRadius: '0.5rem',
              padding: '0.3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Brain size={20} color="#fff" />
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: '1rem',
              color: 'var(--color-primary-dark)',
              letterSpacing: '-0.01em',
            }}
          >
            Dual-Domain Seg
          </span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {navLink('/', 'Landing', <Home size={14} />)}
          {user && navLink('/system', 'System', <Cpu size={14} />)}
          {user && navLink('/system/history', 'History', <History size={14} />)}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {/* Persistent disclaimer pill on authenticated pages */}
          {user && <DisclaimerBanner variant="pill" />}

          {user ? (
            <>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </span>
              <button
                id="logout-btn"
                onClick={handleLogout}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
              >
                <LogOut size={14} />
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}>
              <LogIn size={14} />
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
