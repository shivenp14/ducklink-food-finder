interface Props {
  value: number
}

export default function ProgressBar({ value }: Props) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className="w-80">
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-center text-xs text-gray-500 mt-1">{clamped}%</p>
    </div>
  )
}
