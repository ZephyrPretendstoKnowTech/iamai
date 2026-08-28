import { useEffect, useState } from 'react'
import { Icon } from './Icon.tsx'

export type ToastMessage = { id: number; text: string }

/** A short confirmation that fades after a few seconds; one at a time. */
export function Toast({ message }: { message: ToastMessage | null }) {
  const [visible, setVisible] = useState<ToastMessage | null>(null)
  useEffect(() => {
    if (!message) return
    setVisible(message)
    const t = setTimeout(() => setVisible((v) => (v?.id === message.id ? null : v)), 2800)
    return () => clearTimeout(t)
  }, [message])
  if (!visible) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      <Icon name="check" size={16} /> {visible.text}
    </div>
  )
}

export function useToast(): [ToastMessage | null, (text: string) => void] {
  const [msg, setMsg] = useState<ToastMessage | null>(null)
  return [msg, (text) => setMsg({ id: Date.now(), text })]
}
