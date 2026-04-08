interface Props {
  size?: 'sm' | 'md'
}

export default function FoodBadge({ size = 'md' }: Props) {
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClasses} bg-orange-500/20 text-orange-400 font-medium rounded-full`}
    >
      <span>🍕</span>
      <span>Free Food</span>
    </span>
  )
}
