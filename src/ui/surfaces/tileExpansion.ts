// Which blocking Readiness tiles an opened step stands open (content review D5).
// Every tile marked ! opens with the step, unless their explanations together
// would run past the cap; then only the first does, so a step with four blocking
// tiles never opens as a page of scrolling. The heights are the tiles' own drawn
// explanations, measured by the Readiness section (StepSections.tsx).

/** The combined height, in CSS pixels, the opened explanations may take before only the first stays open. */
export const AUTO_OPEN_CAP_PX = 400

/** The keys of the blocking tiles to stand open, in their order: all of them within the cap, the first one past it. */
export function autoOpenTiles(blocking: readonly { key: string; height: number }[], cap: number = AUTO_OPEN_CAP_PX): string[] {
  const total = blocking.reduce((sum, t) => sum + t.height, 0)
  return (total > cap ? blocking.slice(0, 1) : blocking).map((t) => t.key)
}
