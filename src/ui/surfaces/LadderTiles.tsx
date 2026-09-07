// The MFA readiness ladder's header and its five tiles (docs/design/mockups/
// connect-v2.html): "MFA Readiness" with "of N active people" on the right, then
// one boxed tile per rung, the title on top and the count large in the rung's
// colour, a rule before the three to prioritise. Each tile links to MFA
// Readiness filtered to that rung.
//
// Connect's Plan tile is the one surface that renders this. The MFA Readiness
// page itself counts the three groupings (derive/mfaReadiness.ts) and keeps the
// rung as the badge in a person's row; the Plan draws no ladder at all (task
// 011). The numbers are derive/facts.ts, so the surfaces cannot disagree.
import type { Rung } from '../../derive/ladder.ts'
import type { Facts } from '../../derive/facts.ts'
import { PRIORITISE_FROM, RUNGS } from '../../derive/ladder.ts'
import { readinessHref } from '../shell/routes.ts'
import { ladderWords, rungWords } from './readinessCells.ts'

export function LadderHead({ active }: { active: number }) {
  return (
    <div className="strip-head">
      <span>{ladderWords.header}</span>
      <span>{ladderWords.of(active)}</span>
    </div>
  )
}

export function LadderTiles({ counts }: { counts: Pick<Facts, 'active' | 'rungs'> }) {
  return (
    <>
      <LadderHead active={counts.active} />
      <div className="rung-tiles">
        {RUNGS.map((r: Rung) => (
          <a key={r} className={`rung-tile card${r === PRIORITISE_FROM ? ' pri' : ''}`} href={readinessHref(`rung-${r}`)}>
            <span className="rung-title">{rungWords(r).title}</span>
            <b className={`rung-n rung-${r}`}>{counts.rungs[r]}</b>
          </a>
        ))}
      </div>
    </>
  )
}
