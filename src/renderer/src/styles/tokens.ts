// Design system tokens — reference constants for consistent styling.
// These are NOT imported; use the Tailwind class names directly in components.
// This file exists purely as a documentation/consistency guide.

export const colors = {
  bgPrimary: 'bg-gray-950',
  bgSecondary: 'bg-gray-900',
  bgTertiary: 'bg-gray-800',
  bgCard: 'bg-gray-900',
  bgCardHover: 'bg-gray-800/60',
  accent: 'bg-orange-500',
  accentHover: 'bg-orange-600',
  accentText: 'text-orange-400',
  accentBorder: 'border-orange-500/40',
  accentBg: 'bg-orange-500/20',
  success: 'text-green-400',
  successBg: 'bg-green-500/20',
  error: 'text-red-400',
  errorBg: 'bg-red-500/20',
  warning: 'text-yellow-400',
  warningBg: 'bg-yellow-500/20',
  textPrimary: 'text-gray-100',
  textSecondary: 'text-gray-400',
  textMuted: 'text-gray-500',
  borderDefault: 'border-gray-800',
  borderSubtle: 'border-gray-700/50',
} as const

export const spacing = {
  screenPadding: 'p-6',
  cardPadding: 'p-4',
  sectionGap: 'gap-8',
  itemGap: 'gap-4',
  inlineGap: 'gap-2',
} as const

export const radius = {
  card: 'rounded-xl',
  badge: 'rounded-full',
  button: 'rounded-lg',
} as const
