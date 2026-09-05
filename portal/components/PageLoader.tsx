'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function PageLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Store active timeout IDs so we can clear them when route completes
  const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAllTimers = () => {
    timerIdsRef.current.forEach((id) => clearTimeout(id))
    timerIdsRef.current = []
  }

  // Trigger loading state completion when route changes
  useEffect(() => {
    clearAllTimers()
    setProgress(100)

    const finishTimer = setTimeout(() => {
      setLoading(false)
      setProgress(0)
    }, 250)

    timerIdsRef.current.push(finishTimer)

    return () => clearAllTimers()
  }, [pathname, searchParams])

  // Safety fallback: Never allow loader to stay visible for more than 2.5 seconds
  useEffect(() => {
    if (!loading) return
    const safetyTimer = setTimeout(() => {
      clearAllTimers()
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 200)
    }, 2500)

    return () => clearTimeout(safetyTimer)
  }, [loading])

  // Global click listener on internal links to start progress bar instantly
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      // Ignore external, anchor hash links, or target="_blank"
      if (
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        target.target === '_blank' ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return
      }

      // Compare clean paths
      const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
      const targetPath = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/'

      if (targetPath !== currentPath) {
        clearAllTimers()
        setLoading(true)
        setProgress(30)

        const t1 = setTimeout(() => setProgress(65), 180)
        const t2 = setTimeout(() => setProgress(85), 450)

        timerIdsRef.current.push(t1, t2)
      }
    }

    document.addEventListener('click', handleAnchorClick)
    return () => document.removeEventListener('click', handleAnchorClick)
  }, [])

  if (!loading && progress === 0) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 99999,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      {/* Top Gradient Loading Bar */}
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #14967f, #4f46e5, #06b6d4)',
          boxShadow: '0 0 10px rgba(20, 150, 127, 0.7), 0 0 5px rgba(79, 70, 229, 0.5)',
          transition: progress === 100 ? 'width 0.15s ease-out, opacity 0.25s ease-out' : 'width 0.2s ease-in-out',
          opacity: progress === 100 ? 0 : 1,
        }}
      />

      {/* Top-Right Loading Spinner */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 16,
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '2px solid rgba(20, 150, 127, 0.2)',
          borderTopColor: 'var(--color-primary, #14967f)',
          animation: 'spin 0.6s linear infinite',
          zIndex: 99999,
          opacity: progress === 100 ? 0 : 1,
          transition: 'opacity 0.2s ease',
        }}
      />
    </div>
  )
}
