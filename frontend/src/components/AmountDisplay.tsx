import { formatNaira } from '../lib/formatters'

interface Props {
  amount: number
  className?: string
  large?: boolean
  muted?: boolean
}

export default function AmountDisplay({ amount, className = '', large = false, muted = false }: Props) {
  return (
    <span
      className={`font-mono ${large ? 'text-2xl font-semibold' : 'text-sm'} ${
        muted ? 'text-gray-500' : 'text-gray-900'
      } ${className}`}
    >
      {formatNaira(amount)}
    </span>
  )
}
