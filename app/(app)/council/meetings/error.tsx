'use client'

import { useEffect } from 'react'

export default function MeetingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Council/Meetings Error]', error)
  }, [error])

  return (
    <div className="max-w-xl mx-auto mt-16 bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
      <h2 className="text-lg font-bold text-red-600 mb-2">회의 페이지 오류</h2>
      <p className="text-sm text-slate-600 mb-4">{error.message || '알 수 없는 오류'}</p>
      {error.digest && (
        <p className="text-xs text-slate-400 mb-4">digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="bg-[#8BADD9] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
      >
        다시 시도
      </button>
    </div>
  )
}
