// The MFA readiness ladder's header and its five tiles (docs/design/mockups/
// plan-top-v2.html, connect-v2.html): "MFA Readiness" with "of N active people"
// on the right, then one boxed tile per rung, the title on top and the count
// large in the rung's colour, a rule before the three to prioritise. Each tile
// links to Today filtered to that rung. The Plan strip and Connect's Plan tile
// render this; Today renders the header and its own rows. The numbers are
// derive/facts.ts, so the three surfaces cannot disagree.
import type { Rung } from '../../derive/ladder.ts'
import type { Facts } from '../../derive/facts.ts'
import { PRIORITISE_FROM, RUNGS } from '../../derive/ladder.ts'
import { todayHref } from '../shell/routes.ts'
import { ladderWords, rungWords } from './todayCells.ts'

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
          <a key={r} className={`rung-tile card${r === PRIORITISE_FROM ? ' pri' : ''}`} href={todayHref(`rung-${r}`)}>
            <span className="rung-title">{rungWords(r).title}</span>
            <b className={`rung-n rung-${r}`}>{counts.rungs[r]}</b>
          </a>
        ))}
      </div>
    </>
  )
}
