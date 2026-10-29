# Feature coverage and rollout

## Published site

The public app is <https://cmgwynn.github.io/fantasy-front-office/>.
GitHub Pages publishes the root of the `main` branch in
`cmgwynn/fantasy-front-office`. Editing a separate local folder does not
update that site: changes must be committed and pushed to the publishing
repository, then its Pages build must complete.

Deploy the HTML, CSS, all JavaScript entry points, documentation, and tests
together so script dependencies are not omitted. Run `npm test` and the browser
regression suite before publishing. Verify the public app after deployment.
HTML assets and the regression iframe use a shared release query version.
Bump those versions together whenever publishing changed assets to avoid a new
HTML page reusing older cached scripts or styles.
Refreshing starts on GM Inbox; Player Compare and Team Grades are separate
navigation items, and draft features are inside Draft Room. Loading a provider
league is separate from loading the UI; a provider authorization failure does
not mean the release is missing. Explore demo previews roster-based features.

## Current release

### Current week selection

Startup fetches the NFL season/week status before deriving player projections
and schedules, regardless of provider selection. A fresh page without an
explicit week uses the current NFL display week (or valid `week` field).
Valid `?week=1` through `?week=18` links take precedence before calculations;
invalid week links are ignored. Manually selected weeks and explicit links
are preserved on data retries while the current NFL week still updates.
Failed or invalid status is reported in season-source freshness; the app does
not mark an unverified default as a successful season sync.
Demo/import snapshots can explicitly select their own week without changing
the real current NFL week.

Use **Explore demo** to load four fictional teams and sample players. Demo data
uses the local import pipeline, not authenticated Yahoo access. All projections
and records in the demo are illustrative. Connect another provider to leave it.
Demo waiver candidates are fictional too, and sample players do not inherit real
NFL byes or kickoff locks. The demo is a fixed Week 6 snapshot; changing the week
does not provide new projections. Other analytics may still display the loaded
real-player database alongside sample players.

GM Inbox now includes a weekly briefing, projection provenance, roster risks,
and waiver comparisons against an optimized lineup with a bench drop candidate.
Recommendations do not submit provider transactions.

The Inbox emphasizes its action queue ahead of secondary panels. It shows the
top six matching actions, with a Show all / Show fewer control; category filters
run before the display limit so lower-ranked categories remain reachable.
Cards keep the recommendation, impact, and review/compare shortcuts visible.
Reasons, confidence, and done/dismiss/feedback controls live under each card's
native disclosure. Portfolio signals, outcome performance, and closed actions
are collapsed by default, with counts where applicable. Desktop uses a two-column
queue; mobile uses one column. Changing roster/week/league resets expansion.

### Player comparison

Open **Player Compare** in desktop or mobile navigation, or use **Compare
players** on GM Inbox lineup and waiver recommendations. Search by name or NFL
team and optionally filter position. Searches keep existing selections so you
can find a counterpart without losing the first player; results show up to 100
matches plus previous selections.

The comparison shows weekly projections, season PPG, model trade values,
ownership, injuries, byes, kickoff status, and signed metric differences.
Season PPG may be estimated and model values are not market prices. Source and
freshness warnings accompany the comparison.

For two rostered players, it compares optimized lineups with one starting and
the other excluded, provided they share an eligible starter slot. For a
rostered player and an unrostered player, it models
a one-for-one add/drop against the current optimized roster, in either
selection order. Known kickoff locks, ineligible slots, missing projections,
and opponents' ownership prevent inappropriate actionable scenarios. Unknown
schedule data cannot verify locks; provider rules and eligibility still need
confirmation. No transaction is submitted. Demo comparisons use only fictional
players. This is not a trade-package fairness model or a verified team grade.

### Explained team grades

Open **Team Grades** in desktop or mobile navigation, then choose a roster in
the header. The grade compares optimized weekly points against the mean of all
loaded rosters in the active league. Strength index = points / league average
* 100. Thresholds, before rounding: A >= 110, B >= 100, C >= 90, D >= 80, F < 80.
Tied totals share a rank. The view shows starter-group contributions, assigned
players, group averages, and priorities based on empty slots, below-average
contributions, and injury/bye flags.

This is a transparent weekly projection grade, not an independently calibrated
season, dynasty, draft, or championship assessment. Kickoff locks are ignored
for strength comparisons; IR and taxi players are excluded. FLEX contributions
depend on the optimizer's allocation rather than standalone positional depth.
Missing or invalid roster projections block grading; explicit zeros remain
zero and may reflect missing provider coverage. Two rosters and a positive
league projection baseline are required. Provider source warnings still apply.

### Personalized mock-draft plan

The **Draft Room** now includes a plan showing your next three snake picks,
unfilled model roster targets, and up to three available candidates with
need/ADP explanations. It recalculates from recorded mock picks and the existing
simulated opponent board as you pick, undo, reset, or change applied settings.
Standard and superflex starter targets share the existing draft-score model;
superflex targets two QBs. Dynasty age adjustments remain part of that model.

This is not a live-provider draft integration or a player-availability forecast.
Custom league slots and keeper-ledger entries are not incorporated into the
plan; the UI states these limits. No pick is submitted to a provider. Candidate
scoring is heuristic, not a calibrated draft grade. Demo drafts now exclude
the real player pool.

### Mock draft review and grades

**Mock Draft Grades** in the Draft Room reviews each recorded user pick:
ADP/source, roster fit at that turn, ADP value grade, and a higher-scoring model
alternative when one existed on the simulated board. Alternatives exclude
earlier picks but may include players selected on later turns. They are scored
again with your roster needs at that pick, independently of ADP grades.

Round value = (overall pick - current ADP) / team count. Grades use unrounded
values: A >= +1 round; B >= +0.5; C >= -0.5; D >= -1; otherwise F. The summary
grades the mean round value of rated picks and explicitly shows coverage.
Missing ADP is Unrated and excluded, never scored as zero. An in-progress mock
is labeled provisional. Positive round value means a later selection than ADP,
not proof that the player was a good pick.

The review uses current data, not saved draft-time snapshots, and can change
after an ADP import or player update. ADP date and compatibility with the chosen
scoring/format are not verified; confirm your CSV source. This remains a
mock-draft price/fit review, not actual-season outcome grading, keeper-cost
grading, or live-provider draft analysis.

Run `npm test` for local checks. Open `tests/optimizer-regression.html` for the
browser regression suite. Live provider access is not covered by local checks.

### Season records, rivalries, and fact lookup

Open **Records & Rivalries**. Sleeper's **Load / refresh completed results**
fetches prior regular-season weeks using verified NFL season/week status,
excluding the current week and fantasy playoffs. The selected display week
does not determine which games are complete. Requests run in batches of at
most six; each week requires complete roster coverage and valid paired scores.
Byes with no matchup ID are excluded. Failed weeks are explicitly listed, and
partial coverage is shown. A failed season-status refresh retains prior data
with a warning. Results are in-memory and must be loaded again after refresh.

The view calculates highest team score, closest non-tied game, largest margin,
and per-pair wins/losses/ties, point totals, and average signed margins. Zero
and negative scores are supported. Equal record scores/margins display the
first game in week/team-ID order. The fact lookup offers four fixed questions
answered directly from loaded games with season/source context; it is not a
free-form AI historian.

Head-to-head results use a heat map: read across a team's row for its W-L-T
against each column opponent. Cells include text records, game counts, and win
equivalent = (wins + 0.5 * ties) / games. Green indicates leading, amber
indicates trailing, and neutral indicates 50%; the legend shows exact bands.
No-meeting cells are labeled separately from winless records, and self cells
are disabled visually. Sticky team headers and a keyboard-focusable scrolling
region support wide leagues and mobile screens. Detailed points and margins
remain in an expandable table. Small samples and incomplete loads are not
predictions of future matchups.

Yahoo JSON roster imports may include an optional `completedMatchups` array:

```json
{
  "week": 1,
  "completed": true,
  "homeId": "1",
  "awayId": "2",
  "homeScore": 105.5,
  "awayScore": 104
}
```

Each array item needs a week from 1 to 18, explicit completion, finite numeric
scores, and different team IDs matching the 1-based positions in the imported
`teams` array. Multiple opponents per team/week and duplicate games are
rejected. User-supplied completion and completeness are not independently
verified. Demo results are fictional illustrations, not reconciled historical
standings.

ESPN now offers the same load action, fetching `mMatchup` history with existing
session credentials. Each game needs an explicit regular-season classification,
a single scoring-week mapping ending before the provider's current scoring
period, numeric final scores, and a final HOME/AWAY/TIE result consistent with
those scores. Playoff/current/future games and byes are excluded; missing
metadata, multiweek totals, and unsupported tiebreaker overrides are reported.
The loader verifies league/season and roster IDs. A 401 or other refresh error
is explicit and retains prior results with a warning. Available schedule
completeness is not independently verified. Real access to private league
1174632430 remains blocked by ESPN authorization; normalization is fixture-tested.

All records are scoped to one league and season, keyed by team IDs. They are
not all-time records, cross-season manager identities, championships, or
streaks. Median/multi-opponent formats,
automatic multi-season traversal, and verified finishes remain future work.
Standings and projections are never substituted for game scores.

## Independent FFWrapped capability inventory

Source: <https://ffwrapped.com/> (public feature descriptions reviewed for this
rollout). This is a functional comparison, not a claim of full parity. Private
and Premium workflows have not been independently exercised.

| Publicly advertised capability | This project's coverage | Remaining work |
| --- | --- | --- |
| Power rankings, standings, scoring, expected wins | Partial: rankings and projections | Verify formulas and historical weekly trends with provider fixtures |
| Weekly reports, awards, storylines | Partial: newsletter and weekly report | Completed-week narratives and upcoming previews with verified inputs |
| League-specific roster and player values | Partial: scoring and roster models | Audit scoring completeness and positional assumptions |
| Playoff/championship odds and likely seeds | Partial: playoff projections and bracket | Validated schedule simulation, seed distributions, championship paths |
| Trade comparison and mutually beneficial packages | Partial: builder and finder | Verify package constraints and both-lineup improvements |
| All-time records, finishes, head-to-head, rivalries | Season-scoped record book and head-to-head rivalries from completed Sleeper/ESPN/imported results; season standings | Cross-season manager identity, all-time aggregation, finishes, broader provider rule support |
| League Historian questions | Fixed fact lookup over loaded scores with source/season context | Broader grounded questions and cross-season historical coverage |
| FAAB planner | Partial: local budget and claims | Provider balances, deadlines, claim reconciliation |
| Rate my team and player comparison | Dedicated player comparison, roster scenarios, explained league-relative weekly team grades with starter-group breakdowns | Validated historical production, calibrated season/dynasty grades, and provider-rule completeness |
| Weekly lineup analyzer | Partial: optimizer and kickoff locks | Provider rule verification and missing-input warnings |
| Dynasty analyzer | Partial: dynasty value/trade modes | Contract, pick, and long-term scenario validation |
| Draft grades and personalized draft plans | Mock-draft plan; pick-by-pick ADP value grades, coverage-aware summary, roster fit and model alternatives | Actual draft imports/outcomes, draft-time data snapshots, keeper-aware/custom-slot plans and live draft integration |
| Video recaps | Not implemented | Original shareable video generation and export |
| Sleeper, ESPN, Yahoo connections | Sleeper API; ESPN access-dependent; Yahoo file import | Secure backend/provider-supported authentication where available |

## Next releases

1. Workspace restoration and versioned backup/restore with validation.
2. Source-linked player news, timestamped recommendation explanations, and
   explicit missing-data states. News requires a licensed or permitted feed.
3. Visibility-aware score refresh and action deadlines. Background push
   requires a service worker and notification delivery infrastructure.
4. Multiweek roster planning and cross-provider outcome tracking.
5. Historical record book, rivalries, calibrated season/dynasty grades, actual-draft reviews, and
   validated simulation features from the inventory above.
6. Backend authentication, optional cross-device persistence, and video
   generation after architecture, provider permissions, and hosting approval.
