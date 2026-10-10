import { useEffect, useRef, useState } from 'react'
import { API, chat, useChat } from './chat.js'

// Chat panel for the professor in chat.open ({ id, name, course, greeting?, thinking? }). Conversations are kept per professor (with the backend
// session id), so walking away and coming back picks up where you left off.
export default function ChatWindow({ onClose }) {
  const prof = useChat((s) => s.open)
  const [threads, setThreads] = useState({})
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef()
  const list = useRef()

  const thread = prof && (threads[prof.id] ?? { session: null, messages: [{ from: 'prof', text: prof.greeting ?? `Hi! I'm Professor ${prof.name}. What can I help you with?` }] })

  useEffect(() => {
    if (prof) input.current?.focus()
  }, [prof])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [thread?.messages.length, busy])

  if (!prof) return null

  const update = (fn) => setThreads((all) => ({ ...all, [prof.id]: fn(all[prof.id] ?? thread) }))

  async function send(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    update((t) => ({ ...t, messages: [...t.messages, { from: 'me', text }] }))
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/professors/${prof.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: thread.session }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      chat.speakUntil = performance.now() / 1000 + Math.min(8, 1.5 + data.reply.length / 40)
      update((t) => ({ session: data.session_id, messages: [...t.messages, { from: 'prof', text: data.reply }] }))
    } catch (err) {
      const offline = err instanceof TypeError || /^HTTP (404|50\d)$/.test(err.message)
      update((t) => ({
        ...t,
        messages: [...t.messages, { from: 'system', text: offline ? `Prof. ${prof.name.split(' ').pop()} is offline right now (the backend server isn't reachable).` : err.message }],
      }))
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <div
      className="chat"
      onKeyDown={(e) => {
        e.stopPropagation() // typing shouldn't walk the player or toggle the map
        if (e.key === 'Escape') onClose(false)
      }}
    >
      <div className="chat-head">
        <div>
          <div className="kicker">{prof.course}</div>
          <div className="chat-name">Prof. {prof.name}</div>
        </div>
        <button className="chat-x" onClick={() => onClose(true)} aria-label="Close chat">
          ✕
        </button>
      </div>
      <div className="chat-list" ref={list}>
        {thread.messages.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="msg prof typing">{prof.thinking ?? 'thinking…'}</div>}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question…" maxLength={2000} />
        <button className="go" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
