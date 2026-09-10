// The IAMAI mark (task 030): the Threshold logo, in the shell and on the
// print cover.
//
// The geometry is not drawn here. src/brand/logo/mark.ts is written from
// src/brand/logo/iamai-threshold-master.svg by scripts/gen-brand.mjs, and
// src/brand/brand.test.ts re-derives it and fails on drift — so the interface
// renders the one master rather than a second copy of the mark that would part
// company with it the first time either was corrected (task 029).
//
// The lockup is composed at use: this mark beside the live text IAMAI, set in
// IBM Plex Sans at the wordmark weight. There is no exported lockup carrying
// text, because such a file renders in the wrong face wherever the font is not
// installed (docs/brand/brand-manifest.json logo.wordmark.compositionNote).
// There is no tagline.
import { MARK_GEOMETRY, MARK_VIEWBOX } from '../../brand/logo/mark.ts'

/**
 * The mark, taking its colour from `currentColor` so it follows the theme.
 * The brand's minimum is 16px and its header band is 20–28px
 * (docs/brand/brand-manifest.json logo.wordmark).
 */
export function BrandMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: MARK_GEOMETRY }}
    />
  )
}
