import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Dual-Domain Brain Tumor Segmentation — Research Demo',
  description:
    'A research demonstration comparing a baseline U-Net and a dual-domain U-Net (spatial + k-space) for brain tumor segmentation on BraTS MRI data. Not a clinical tool.',
  keywords: ['brain tumor', 'MRI segmentation', 'dual-domain', 'k-space', 'BraTS', 'U-Net', 'research demo'],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar user={user} />
        <main style={{ flex: 1 }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
