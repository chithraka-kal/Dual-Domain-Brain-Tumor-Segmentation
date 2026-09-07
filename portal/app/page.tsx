import Link from 'next/link'
import {
  ArrowRight,
  ExternalLink,
  Upload,
  GitCompareArrows,
  ClipboardCheck,
  Radio,
  Waves,
  Brain,
} from 'lucide-react'
import DisclaimerBanner from '@/components/DisclaimerBanner'

export const metadata = {
  title: 'Dual-Domain Brain Tumor Segmentation — Research Demo',
  description:
    'Can teaching an AI to hear an MRI\'s raw signal help it find brain tumors more precisely? Explore this research comparison tool.',
}

export default function LandingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(160deg, var(--color-primary-dark) 0%, #0d7a68 100%)',
          color: '#fff',
          padding: '5rem 1.5rem 6rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative blobs */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.04)',
            top: -120,
            right: -80,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.03)',
            bottom: -60,
            left: -60,
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 780, margin: '0 auto', position: 'relative' }}>
          <span
            className="badge"
            style={{
              background: 'rgba(255,255,255,.15)',
              color: '#fff',
              marginBottom: '1.5rem',
              display: 'inline-flex',
            }}
          >
            <Brain size={12} />
            BSc Final Year Research Project
          </span>

          <h1
            style={{
              fontSize: 'clamp(1.75rem, 5vw, 3rem)',
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.15,
              marginBottom: '1.25rem',
              letterSpacing: '-0.02em',
            }}
          >
            Can teaching an AI to <em style={{color: '#a8edda' }}>"hear"</em>{' '}
            an MRI's raw signal help it find brain tumors more precisely?
          </h1>

          <p
            style={{
              fontSize: '1.125rem',
              opacity: 0.88,
              marginBottom: '2.5rem',
              maxWidth: 560,
              margin: '0 auto 2.5rem',
              lineHeight: 1.6,
            }}
          >
            Upload a BraTS T2-weighted MRI volume and compare a standard U-Net against a
            dual-domain model that also processes the scanner's raw frequency data.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              id="hero-try-demo-btn"
              href="/system"
              className="btn btn-primary"
              style={{
                background: '#fff',
                color: 'var(--color-primary-dark)',
                fontSize: '1rem',
                padding: '0.75rem 2rem',
              }}
            >
              Try the Demo
              <ArrowRight size={16} />
            </Link>
            <a
              id="hero-github-btn"
              href="https://github.com/chithraka-kal/Dual-Domain-Brain-Tumor-Segmentation"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{
                borderColor: 'rgba(255,255,255,.5)',
                color: '#fff',
                fontSize: '1rem',
                padding: '0.75rem 2rem',
              }}
            >
              <ExternalLink size={16} />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── Disclaimer — IMMEDIATELY below hero ──────────────── */}
      <section style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <DisclaimerBanner variant="full" />
      </section>

      {/* ── What is dual-domain? ───────────────────────────────── */}
      <section
        id="explainer"
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '3rem 1.5rem',
          width: '100%',
        }}
      >
        <h2
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}
        >
          What is "dual-domain"?
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '2.5rem' }}>
          Plain-language explanation — no technical jargon
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {[
            {
              icon: <Radio size={24} />,
              step: '1',
              title: 'The MRI picture',
              text: 'A radiologist (and a standard AI model) looks at a grayscale scan image — a picture of your brain slice.',
            },
            {
              icon: <Waves size={24} />,
              step: '2',
              title: 'The hidden raw signal',
              text: 'Before that picture is created, the MRI scanner actually records raw wave-like signals from the magnetic field. This raw signal data is called k-space.',
            },
            {
              icon: <Brain size={24} />,
              step: '3',
              title: 'Teaching the AI both',
              text: 'This project tests whether showing the AI both the picture and that raw signal — at the same time — helps it spot tumor regions more accurately than looking at the picture alone.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="card"
              style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '0.75rem',
                  background: 'var(--color-surface-alt)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem',
                  }}
                >
                  Step {item.step}
                </p>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Key results ─────────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--color-surface-alt)',
          padding: '3rem 1.5rem',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem' }}>
            Key Results
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
            Evaluated on the BraTS 2023 Glioma dataset · 187 test cases
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {[
              { stat: '+18%', label: 'Tumor Core DSC improvement', color: 'var(--color-primary)' },
              { stat: '+43%', label: 'Enhancing Tumor DSC improvement', color: '#14967f' },
              { stat: '187', label: 'Test cases evaluated', color: 'var(--color-primary-dark)' },
            ].map((item) => (
              <div
                key={item.label}
                className="card"
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: '#fff',
                }}
              >
                <p style={{ fontSize: '2.5rem', fontWeight: 900, color: item.color, margin: 0 }}>
                  {item.stat}
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.375rem' }}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '3rem 1.5rem',
          width: '100%',
        }}
      >
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', marginBottom: '2rem' }}>
          How it works
        </h2>
        <div className="how-it-works-container">
          {[
            { icon: <Upload size={24} />, label: 'Upload', desc: 'Drop your BraTS T2w volume (.nii.gz)' },
            { icon: <GitCompareArrows size={24} />, label: 'Compare', desc: 'Both models run inference in parallel' },
            { icon: <ClipboardCheck size={24} />, label: 'Review', desc: 'See side-by-side results + Dice scores' },
          ].map((step, i) => (
            <div key={step.label} className="how-it-works-step">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1.5rem 1rem',
                  minWidth: 160,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    marginBottom: '0.25rem',
                  }}
                >
                  {step.icon}
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{step.label}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: 0 }}>
                  {step.desc}
                </p>
              </div>
              {i < 2 && (
                <ArrowRight size={20} className="how-it-works-arrow" style={{ color: 'var(--color-surface-alt)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))',
          padding: '3.5rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <h2 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>
          Ready to explore?
        </h2>
        <p style={{ color: 'rgba(255,255,255,.8)', marginBottom: '2rem', maxWidth: 500, margin: '0 auto 2rem' }}>
          Upload a BraTS MRI volume and see the dual-domain model's predictions versus the baseline.
        </p>
        <Link
          id="final-try-demo-btn"
          href="/system"
          className="btn"
          style={{
            background: '#fff',
            color: 'var(--color-primary-dark)',
            fontSize: '1rem',
            padding: '0.75rem 2.25rem',
          }}
        >
          Try the Demo
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  )
}
