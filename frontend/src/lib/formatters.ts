/**
 * Format a number as Nigerian Naira
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format a date string to readable format
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format datetime with time
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Truncate a contract ID for display
 */
export function truncateId(id: string, length = 16): string {
  if (id.length <= length) return id
  return id.slice(0, length) + '...'
}

/**
 * Calculate estimated monthly installment with profit margin
 */
export function calculateInstallment(
  principal: number,
  profitMarginPct: number,
  tenureMonths: number
): number {
  const totalProfit = principal * (profitMarginPct / 100)
  const salePrice = principal + totalProfit
  return salePrice / tenureMonths
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Relative time (e.g., "2 hours ago")
 */
export function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'just now'
}
