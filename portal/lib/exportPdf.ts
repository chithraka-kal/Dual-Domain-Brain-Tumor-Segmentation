// lib/exportPdf.ts
// Client-side PDF export using html2canvas + jsPDF.
// Must be called from a Client Component (dynamic import recommended).

import type { InferenceResult } from './api'

interface ExportOptions {
  result: InferenceResult
  filename: string
  notes: string
  timestamp: string
}

export async function exportResultsPdf(
  resultsElement: HTMLElement,
  options: ExportOptions
): Promise<void> {
  // Dynamic imports — these are large libs, only load when needed
  const html2canvas = (await import('html2canvas')).default
  const jsPDF = (await import('jspdf')).default

  const { result, filename, notes, timestamp } = options

  const canvas = await html2canvas(resultsElement, {
    backgroundColor: '#ffffff',
    scale: 1.5,
    useCORS: true,
    allowTaint: true,
  })

  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 12

  // ── Header ───────────────────────────────────────────────
  pdf.setFillColor(9, 93, 126)          // --color-primary-dark
  pdf.rect(0, 0, pageW, 18, 'F')
  pdf.setFontSize(13)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text('Dual-Domain Brain Tumor Segmentation — Comparison Report', margin, 12)

  // ── Disclaimer (red banner) ──────────────────────────────
  pdf.setFillColor(214, 69, 69)         // --color-danger
  pdf.rect(0, 18, pageW, 9, 'F')
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text(
    '⚠  RESEARCH DEMONSTRATION ONLY — NOT A MEDICAL DEVICE — NOT FOR CLINICAL USE',
    pageW / 2,
    23.5,
    { align: 'center' }
  )

  // ── Metadata row ─────────────────────────────────────────
  const metaY = 31
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(30, 30, 30)
  pdf.text(`File: ${filename}`, margin, metaY)
  pdf.text(`Slice: z=${result.displaySlice}  |  Shape: ${result.volumeShape}`, margin + 70, metaY)
  pdf.text(`Inference: ${result.inferenceTimeSeconds.toFixed(1)}s on ${result.device}`, margin + 150, metaY)
  pdf.text(`Generated: ${timestamp}`, margin, metaY + 5)

  // ── Comparison image ─────────────────────────────────────
  const imgY = metaY + 10
  const availH = pageH - imgY - margin - (notes ? 20 : 5)
  const imgW = pageW - margin * 2
  const canvasRatio = canvas.width / canvas.height
  const imgH = Math.min(availH, imgW / canvasRatio)

  pdf.addImage(imgData, 'PNG', margin, imgY, imgW, imgH)

  // ── Dice scores ──────────────────────────────────────────
  if (result.baselineDice && result.dualDomainDice) {
    const tableY = imgY + imgH + 4
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(9, 93, 126)
    pdf.text('Dice Similarity Coefficient (DSC):', margin, tableY)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(30, 30, 30)

    const regions = ['Whole Tumor (WT)', 'Tumor Core (TC)', 'Enhancing Tumor (ET)']
    const bKeys: Array<keyof typeof result.baselineDice> = ['wt', 'tc', 'et']
    regions.forEach((label, i) => {
      const b = result.baselineDice![bKeys[i]]
      const d = result.dualDomainDice![bKeys[i]]
      const delta = d - b
      const row = `${label}:  Baseline ${b.toFixed(4)}  |  Dual-Domain ${d.toFixed(4)}  |  Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(4)}`
      pdf.text(row, margin + 4, tableY + 4 + i * 4.5)
    })
  }

  // ── Notes ─────────────────────────────────────────────────
  if (notes.trim()) {
    const notesY = pageH - margin - 14
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(9, 93, 126)
    pdf.text('Session Notes:', margin, notesY)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(30, 30, 30)
    const lines = pdf.splitTextToSize(notes, pageW - margin * 2)
    pdf.text(lines.slice(0, 3), margin, notesY + 4.5)
  }

  // ── Footer ────────────────────────────────────────────────
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'italic')
  pdf.setTextColor(100, 100, 100)
  pdf.text(
    'BSc Computer Science Final Year Project — NSBM Green University — Research demonstration only',
    pageW / 2,
    pageH - 4,
    { align: 'center' }
  )

  pdf.save(`braintumor-comparison-${Date.now()}.pdf`)
}
