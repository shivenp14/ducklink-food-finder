interface Props {
  onClick: () => void
  disabled?: boolean
}

export default function ScanButton({ onClick, disabled = false }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative px-10 py-5 text-xl font-semibold rounded-2xl transition-all duration-200 cursor-pointer ${
        disabled
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-105 active:scale-95'
      }`}
    >
      <span className="relative flex items-center gap-3">
        🔍 Scan for Events
      </span>
    </button>
  )
}
