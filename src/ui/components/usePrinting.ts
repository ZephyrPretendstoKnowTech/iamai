import { useEffect, useState } from 'react'

/** True between beforeprint and afterprint, so lazily rendered content mounts for paper. */
export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const on = () => setPrinting(true)
    const off = () => setPrinting(false)
    window.addEventListener('beforeprint', on)
    window.addEventListener('afterprint', off)
    return () => {
      window.removeEventListener('beforeprint', on)
      window.removeEventListener('afterprint', off)
    }
  }, [])
  return printing
}
