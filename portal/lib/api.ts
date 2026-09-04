// lib/api.ts
// Wraps the FastAPI inference backend.
// When NEXT_PUBLIC_API_URL is unset or unreachable, returns realistic mock data.

export interface RegionDice {
  wt: number
  tc: number
  et: number
}

export interface InferenceResult {
  originalImage: string      // base64 data URL
  baselineImage: string      // base64 data URL (overlay)
  dualDomainImage: string    // base64 data URL (overlay)
  groundTruthImage: string | null // base64 data URL, null if not provided
  baselineDice: RegionDice | null
  dualDomainDice: RegionDice | null
  inferenceTimeSeconds: number
  device: string
  volumeShape: string
  displaySlice: number
  sessionId?: string
}

/** Placeholder base64 PNG (1×1 pixel gray square) used in mock responses */
const PLACEHOLDER_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function mockResult(hasGroundTruth: boolean): InferenceResult {
  return {
    originalImage: PLACEHOLDER_PNG,
    baselineImage: PLACEHOLDER_PNG,
    dualDomainImage: PLACEHOLDER_PNG,
    groundTruthImage: hasGroundTruth ? PLACEHOLDER_PNG : null,
    baselineDice: hasGroundTruth ? { wt: 0.797, tc: 0.522, et: 0.433 } : null,
    dualDomainDice: hasGroundTruth ? { wt: 0.832, tc: 0.700, et: 0.617 } : null,
    inferenceTimeSeconds: 18.4,
    device: 'CPU (mock)',
    volumeShape: '240×240×155',
    displaySlice: 88,
  }
}

export type SliceMode = 'auto' | 'manual'

export async function runInference(
  t2wFile: File,
  segFile: File | null,
  sliceMode: SliceMode,
  customSlice: number
): Promise<InferenceResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (!apiUrl || apiUrl === 'http://localhost:8000') {
    // Simulate latency in dev/mock mode
    await new Promise((r) => setTimeout(r, 2000))
    return mockResult(segFile !== null)
  }

  const form = new FormData()
  form.append('t2w_file', t2wFile)
  if (segFile) form.append('seg_file', segFile)
  form.append('slice_mode', sliceMode)
  form.append('custom_slice', String(customSlice))

  const res = await fetch(`${apiUrl}/api/inference`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Inference failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<InferenceResult>
}
