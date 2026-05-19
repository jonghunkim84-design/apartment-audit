'use client'
import { useEffect } from 'react'

const DIFY_TOKEN = '9ettBQc3zHphX7jV'

export function DifyChatbot() {
  useEffect(() => {
    if (document.getElementById(DIFY_TOKEN)) return

    ;(window as Record<string, unknown>).difyChatbotConfig = {
      token: DIFY_TOKEN,
      inputs: {},
      systemVariables: {},
      userVariables: {},
    }

    const script = document.createElement('script')
    script.src = 'https://udify.app/embed.min.js'
    script.id = DIFY_TOKEN
    script.defer = true
    document.body.appendChild(script)

    return () => {
      document.getElementById(DIFY_TOKEN)?.remove()
      document.getElementById('dify-chatbot-bubble-button')?.remove()
      document.getElementById('dify-chatbot-bubble-window')?.remove()
    }
  }, [])

  return (
    <style>{`
      #dify-chatbot-bubble-button { background-color: #1C64F2 !important; }
      #dify-chatbot-bubble-window { width: 24rem !important; height: 40rem !important; }
    `}</style>
  )
}
