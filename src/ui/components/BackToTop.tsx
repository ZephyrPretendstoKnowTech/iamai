import { useEffect, useState } from 'react'
import { COMPONENTS } from '../../copy/components.ts'

/** A floating "Back to top" on long pages (ux-review-05 §45); appears after a screen of scrolling. */
export function BackToTop() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!shown) return null
  return (
    <button type="button" className="btn btn-secondary btn-sm back-to-top no-print" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      {COMPONENTS.backToTop}
    </button>
  )
}
