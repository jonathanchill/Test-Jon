const regions = new Intl.DisplayNames(['en-GB'], { type: 'region' })

export function countryName(code: string | null | undefined): string {
  if (!code) return 'Unknown'
  try { return regions.of(code) ?? code } catch { return code }
}
export function num(n: number | null | undefined): string {
  return n == null ? 'n/a' : Math.round(n).toLocaleString('en-GB')
}
export function compact(n: number | null | undefined): string {
  return n == null ? 'n/a' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}
export function date(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'n/a'
}
export function errorText(e: unknown): string {
  const err = e as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
  return err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Something went wrong'
}
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Not started', running: 'Running', waiting_quota: 'Waiting for daily limit', complete: 'Search finished', paused: 'Paused',
}
