interface Props {
  message: string
  stage: string
  onRetry: () => void
  onBack: () => void
}

const STAGE_ERRORS: Record<
  string,
  { title: string; icon: string; suggestion: string }
> = {
  browser: {
    title: 'Browser Launch Failed',
    icon: '🌐',
    suggestion: 'Check your internet connection and try again.',
  },
  scraping: {
    title: 'Scraping Failed',
    icon: '📋',
    suggestion:
      'Could not extract events from Ducklink. The page structure may have changed.',
  },
  ocr: {
    title: 'OCR Processing Failed',
    icon: '🔍',
    suggestion:
      'Could not read event images. The scan will continue with text-only detection.',
  },
  llm: {
    title: 'Food Detection Failed',
    icon: '🤖',
    suggestion: 'Check your NVIDIA API key in Settings, or try again later.',
  },
}

export default function ErrorMessage({
  message,
  stage,
  onRetry,
  onBack,
}: Props) {
  const config = STAGE_ERRORS[stage] || {
    title: 'Something Went Wrong',
    icon: '⚠️',
    suggestion: 'An unexpected error occurred.',
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-8">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-4xl">{config.icon}</span>
      </div>

      <h2 className="text-2xl font-semibold text-center text-red-400">
        {config.title}
      </h2>

      <p className="text-gray-400 text-center max-w-md">{config.suggestion}</p>

      <div className="bg-gray-900 rounded-lg p-3 max-w-md w-full">
        <p className="text-xs text-gray-500 font-mono break-all">{message}</p>
      </div>

      <div className="flex gap-4 mt-2">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
        >
          Back to Home
        </button>
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
