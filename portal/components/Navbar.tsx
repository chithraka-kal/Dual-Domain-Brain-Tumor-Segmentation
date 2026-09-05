'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Brain, LogOut, LogIn, History, Cpu, Home, Menu, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import DisclaimerBanner from './DisclaimerBanner'

interface NavbarProps {
  user?: { email?: string } | null
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const navLink = (href: string, label: string, icon: React.ReactNode) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
    return (
      <Link
        href={href}
        onClick={() => setMobileMenuOpen(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.875rem',
          borderRadius: '0.5rem',
          fontSize: '0.9375rem',
          fontWeight: active ? 700 : 500,
          color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
          background: active ? 'rgba(20,150,127,.1)' : 'transparent',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
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
        background: 'rgba(241,249,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 1.25rem',
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
          onClick={() => setMobileMenuOpen(false)}
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

        {/* Desktop Nav links */}
        <nav className="desktop-nav">
          {navLink('/', 'Landing', <Home size={15} />)}
          {user && navLink('/system', 'System', <Cpu size={15} />)}
          {user && navLink('/system/history', 'History', <History size={15} />)}
        </nav>

        {/* Desktop Right side */}
        <div className="desktop-user-area" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
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

        {/* Mobile menu toggle button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {navLink('/', 'Landing', <Home size={16} />)}
            {user && navLink('/system', 'System', <Cpu size={16} />)}
            {user && navLink('/system/history', 'History', <History size={16} />)}
          </nav>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {user && <DisclaimerBanner variant="pill" />}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.email}
                </span>
                <button
                  id="mobile-logout-btn"
                  onClick={handleLogout}
                  className="btn btn-outline"
                  style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <LogIn size={16} />
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

