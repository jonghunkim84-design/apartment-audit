'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'model'
  content: string
  streaming?: boolean
}

interface Props {
  complexCode: string
  complexName: string
}

export function PortalChatbot({ complexCode, complexName }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `안녕하세요! **${complexName}** 관리비·감사 정보 안내 챗봇입니다.\n관리비 지출, 잡수입, 장기수선충당금, 감사 결과 등에 대해 질문해 주세요.`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = { id: assistantId, role: 'model', content: '', streaming: true }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    // Gemini API history 형식 (welcome 메시지 제외)
    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/portal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complexCode, message: text, history }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              accumulated += parsed.text
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                )
              )
            }
          } catch {
            // JSON 파싱 오류 무시
          }
        }
      }

      // 스트리밍 완료
      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, streaming: false } : m))
      )
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: '죄송합니다. 답변을 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', streaming: false }
            : m
        )
      )
      console.error('[PortalChatbot]', err)
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, complexCode])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // 마크다운 굵게만 간단 처리
  function renderContent(text: string) {
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1C64F2] text-white shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center"
        aria-label="챗봇 열기"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* 채팅 창 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[22rem] h-[32rem] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* 헤더 */}
          <div className="bg-[#1C64F2] px-4 py-3 flex items-center gap-2 shrink-0">
            <Bot className="h-5 w-5 text-white" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{complexName} 안내 챗봇</p>
              <p className="text-blue-200 text-xs">관리비·감사 정보 질문에 답변드립니다</p>
            </div>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* 아바타 */}
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${msg.role === 'user' ? 'bg-slate-400' : 'bg-[#1C64F2]'}`}>
                  {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>

                {/* 말풍선 */}
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-[#1C64F2] text-white rounded-tr-sm'
                      : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-sm'
                  }`}
                >
                  {msg.content ? renderContent(msg.content) : null}
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-0.5 animate-pulse rounded-sm" />
                  )}
                </div>
              </div>
            ))}

            {/* 로딩 인디케이터 (최초 응답 전) */}
            {loading && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-[#1C64F2] flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-slate-100">
                  <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 추천 질문 (메시지가 welcome 1개일 때만) */}
          {messages.length === 1 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-white flex flex-wrap gap-1.5 shrink-0">
              {['이번 달 관리비 지출은?', '이상 감지 내역 알려줘', '장기수선 이행률은?'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="text-xs px-2.5 py-1 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* 입력창 */}
          <div className="border-t border-slate-100 px-3 py-2 bg-white flex items-end gap-2 shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="질문을 입력하세요… (Enter로 전송)"
              className="flex-1 resize-none text-sm text-slate-800 placeholder-slate-400 focus:outline-none max-h-24 leading-relaxed py-1.5"
              style={{ minHeight: '2rem' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-full bg-[#1C64F2] disabled:bg-slate-200 text-white flex items-center justify-center transition-colors hover:bg-blue-700"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
