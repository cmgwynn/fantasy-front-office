# Feature coverage and rollout

## Published site

The public app is <https://fantasy-front-office.pages.dev/>.
Cloudflare Pages publishes the root of the `main` branch in
`cmgwynn/fantasy-front-office`. Changes must be committed and pushed to that
repository, then the Pages deployment must complete.

Deploy the HTML, CSS, all JavaScript entry points, documentation, and tests
together so script dependencies are not omitted. Run `npm test` and the browser
regression suite before publishing. Verify the public app after deployment.
HTML assets and the regression iframe use a shared release query version.
Bump those versions together whenever publishing changed assets to avoid a new
HTML page reusing older cached scripts or styles.
Fresh visits start on GM Inbox unless a previous league or manually saved workspace resumes.
GM Inbox and Draft Room are direct destinations. Multi-tool groups organize
My Team, League, Players, and Extras. Labels describe the job each view performs; in-view notes explain
where outputs are estimates, local plans, or dependent on provider data.
Loading a provider league is separate from loading the UI; a provider
authorization failure does not mean the release is missing. Connect or import
a league to use roster-based features.

## Current release

### Compact sidebar

The desktop sidebar uses four native accordion groups: **My Team**, **League**,
**Players**, and **Extras**. GM Inbox and Draft Room are direct buttons, never
single-item disclosure groups. Only the active tool's group is expanded;
selecting a direct destination closes the groups.
Selecting a tool through a shortcut also opens its group and synchronizes the
mobile picker and `aria-current`. Collapsing the current group leaves the
selected tool's name visible in its summary. Native summaries support keyboard
Enter/Space, with visible focus indicators and reduced-motion support.
The sidebar uses system fonts, rounded inset selection, restrained shared accents,
original line icons, aligned direct-destination icons, and 48px group targets.
The selected destination uses the app's accent with an inset marker, not a
second competing accent color. At widths up to 960px, a sticky native
44px picker with the same four option groups and direct Inbox/Draft options replaces the sidebar list.
Short phone landscape layouts keep that picker beside the content and compact
the provider controls to preserve the limited vertical space. Player Analytics
uses a responsive scatter plot with labels for the top 10 players in the current
sort; the sortable table below retains the full plotted-player values.
Desktop/mobile destination order is identical. User-initiated tool changes
reset the content's scroll position when switching sections, bring an offscreen
tool's start back into view without animated scrolling, and preserve the
provider/roster context and each tool's controls. Clicking an already active
tool does not reset its reading position. Keyboard activation focuses a named
tool panel; a skip link reaches the main landmark. The mobile picker stays
available while scrolling and retains focus for consecutive selections.
Automatic saved-state restoration does not use this user-navigation scroll path.
Core tools focus on lineup, pickup, trade, matchup, and upcoming coverage decisions.
Team grades, power rankings, and records/rivalries are in the bottom Extras group.
Weekly picks, historical standings, and secondary tables are collapsed.
The illustrative playoff bracket is optional beneath the schedule simulation.

### Decision-first Inbox and integrated recap

**Schedule & Coverage** includes a fantasy league schedule above bye planning.
Choose any NFL week (1–18) and the entire league or selected team. Sleeper
loads published pairings on demand, not an expensive whole-season crawl.
ESPN uses its scoring-week-to-matchup-period mapping and labels multiweek
matchups rather than assuming a period equals a week. Explicit provider
unpaired entries are distinguished from missing or unresolved pairings.
Future playoff opponents may not be assigned yet. This view shows pairings,
not inferred final scores or simulated opponents.
Results are cached for one minute per league/season/week. Reload the page to
update data; there is no separate refresh action.
Failures are visible and clear the displayed rows. Saved/imported snapshots
use only supplied current pairings or completed-game records, never network
requests or invented future schedules.

GM Inbox initially shows at most three prioritized actions, with one primary
review button each. Explanations, comparisons, feedback, and data assumptions
are available on demand. Category filters run before the limit and Show all
keeps remaining actions accessible. Injury/bye alerts target current starters;
bench health remains visible in My Roster. Waivers must improve the optimized
lineup by at least 0.5 projected points. Trade-history and depth-only filler
are no longer generated as weekly actions.

Four upcoming week cards reuse the roster planner's slot coverage logic:
bye names, structural slot gaps, and unknown schedules remain distinct.
The coverage shortcut opens **Schedule & Coverage** for a full player/opponent
matrix and hypothetical add/drop testing. Current unavailable players are held
out; coverage is not a points forecast or a promise of future availability.

The standalone newsletter destination is replaced by a collapsed **League
recap** inside GM Inbox. It shows at most three highlights: latest loaded
completed-week top score, closest decided result (or ties), and the selected
roster's score versus other loaded scored teams. Zero and negative scores
remain valid. Missing results produce an unavailable message, not invented
news, projected upset claims, or duplicated action advice. Opening or updating
the recap loads completed results through the existing provider-aware records
loader. Snapshot/demo/partial coverage is labeled; full scores, standings, and
source details stay collapsed. Copy/download use the same short recap and
source note. Saved legacy issues remain available and are explicitly marked
as unverified archives; they are not relabeled as final results.

### Automatic league remembering

Normal refreshes automatically retain the last loaded league, selected roster
(by provider roster ID, not array order), selected week, and current section.
Successful league loads/imports store a separate reload snapshot in IndexedDB;
roster and view selections are stored synchronously in local storage.
Sleeper/ESPN reloads attempt to fetch current league data before restoring the
selected roster and view. Access/network failures retain an explicitly labeled
snapshot with the provider error shown. Yahoo imports and fictional demo data
remain snapshots and need re-importing for new data. No provider credentials
are saved. The last league reload copy takes precedence over a manual resume
copy. Explicit user/league connection links and `?resume=0` bypass both;
a matching provider link retains the saved league and roster, and an explicit
week overrides the saved week without discarding the workspace. A different
provider link starts that provider's connection flow.

The provider and its account text field are also saved synchronously on input,
independently of a successful connection or IndexedDB snapshot. Sleeper
usernames and ESPN league-ID lists are kept separately in this browser's local
storage and restored on reload/provider changes. An intentionally emptied field
stays empty. These values are not passwords or sign-in sessions and are not
exported in workspace backups. Storage/validation failures are shown explicitly.
Clearing browser storage removes these values. `?resume=0` also disables
account-field reads and writes for tests.

The Workspace & Backups tab and its manual save, download, and restore controls
have been removed. Automatic league/roster/week/view retention and local draft,
FAAB, Inbox, newsletter, and watchlist saves remain. Existing stored snapshots
are retained for compatibility, including a manual snapshot made before the
tab was removed. Old saved selections targeting the removed tab open GM Inbox.
Errors and non-live data are still identified in the snapshot banner.
Reconnect or re-import to update a snapshot. Storage remains device-local,
not cross-device account sync; browser eviction or clearing can remove it.

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

### Provider league refresh

Reloading the page resumes the saved connected league, checks player statuses
without relying solely on the 24-hour player cache, and loads provider rosters,
matchups and projections. ESPN refetches its league response. Selected roster,
week and tool are retained when still available. Failed reloads retain the
explicitly labeled saved snapshot and report the provider error. All manual
refresh/retry controls have been removed, including Inbox, portfolio, schedule
and live-score controls. Yahoo imports remain snapshots: re-import to update.

GM Inbox now includes a weekly briefing, projection provenance, roster risks,
and waiver comparisons against an optimized lineup with a bench drop candidate.
Recommendations do not submit provider transactions.

The Inbox emphasizes its action queue ahead of secondary panels. It shows the
top three matching actions, with a Show all / Show fewer control; category filters
run before the display limit so lower-ranked categories remain reachable.
Cards keep the recommendation, impact, and primary review shortcut visible.
Reasons, comparisons, confidence, and done/dismiss/feedback controls live under each card's
native disclosure. Portfolio signals, outcome performance, and closed actions
are collapsed by default, with counts where applicable. Wide desktops use a three-column
queue; mobile uses one column. Changing roster/week/league resets expansion.

### Player comparison

Open **Compare Players** in desktop or mobile navigation, or use **Compare
players** under an Inbox card's Details & options. Search by name or NFL
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
Choose **Use League Settings**, then **Start / Reset Draft**, to apply exact
supported offensive/K/DEF starter slots, including flexible slots and leagues
without kickers/defenses. Unknown/IDP slots are refused instead of mapped to a
standard template. In keeper mode, valid saved keepers leave the player pool
and the selected roster's keepers count toward roster needs. A keeper whose
ownership changed is explicitly marked unverified and not applied. Keeper
costs remain a ledger only: no draft-round forfeiture, contract or auction
budget engine is implied. Scoring still uses reception-based presets rather
than every custom league bonus. No pick is submitted to a provider. Candidate
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

Open **Records & Rivalries** to automatically load current completed results.
There is no in-tab refresh button. Reopening the section fetches again;
overlapping requests for the same league/season share one load. Loading state
is visible and exposed with `aria-busy`. Switching leagues loads the active
league without an older in-flight request replacing its display. Refreshing
the page retains the selected league/roster and reloads connected-provider data.
Saved manual workspaces and imports show their snapshot results instead of
silently claiming a live refresh.

Sleeper's automatic loader fetches prior regular-season weeks using verified NFL season/week status,
excluding the current week and fantasy playoffs. The selected display week
does not determine which games are complete. Requests run in batches of at
most six; each week requires complete roster coverage and valid paired scores.
Byes with no matchup ID are excluded. Failed weeks are explicitly listed, and
partial coverage is shown. A failed season-status refresh retains prior data
with a warning. Connected-provider results reload automatically after refresh;
snapshot backups can retain the previously loaded results.

The view calculates highest team score, closest non-tied game, largest margin,
and per-pair wins/losses/ties, point totals, and average signed margins. Zero
and negative scores are supported. Equal record scores/margins display the
first game in week/team-ID order. The fact lookup offers five fixed questions
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

The expandable **Verified scoring, expected wins & weekly awards** section
calculates all-play records from each week's loaded scores. Expected win
equivalents sum `(opponents outscored + 0.5 * tied opponents) / other scored
teams` for each week. Actual equivalents are wins + half of ties; scheduling
luck is actual minus expected. Legitimate zeros/negative scores are retained.
Byes and unloaded teams are not scored; incomplete coverage is not promoted
to a complete-season estimate. This section does not replace provider standings
or the older model-based Power Rankings tab.

Weekly completed-score awards include all tied top scorers, the scoring median,
the highest-scoring loss and lowest-scoring win (ties for awards included).
The scheduling-luck fact question explains the same formula and limitations.
These are deterministic score summaries, not generative narratives or skill
ratings, and no fantasy outcome is inferred from projections.

ESPN uses the same automatic loading flow, fetching `mMatchup` history with existing
session credentials. Each game needs an explicit regular-season classification,
a single scoring-week mapping ending before the provider's current scoring
period, numeric final scores, and a final HOME/AWAY/TIE result consistent with
those scores. Playoff/current/future games and byes are excluded; missing
metadata, multiweek totals, and unsupported tiebreaker overrides are reported.
The loader verifies league/season and roster IDs. A 401 or other refresh error
is explicit and retains prior results with a warning. Available schedule
completeness is not independently verified. Real access to private league
1174632430 remains blocked by ESPN authorization; normalization is fixture-tested.

The main heat map remains scoped to one league and season, keyed by team IDs.
The expandable **Career history & cross-season rivalries** panel automatically
follows Sleeper's `previous_league_id` chain when opened, up to 10 seasons.
Metadata IDs, descending years, unique season coverage, roster IDs and playoff
boundaries are checked. Loads stop on cycles, inconsistent metadata or provider
errors with explicit coverage messages; overlapping history loads are shared.
Each season uses the completed-game validation above, with at most six weekly
requests in flight. Failed weeks remain explicitly partial.

Career identities use primary Sleeper owner IDs, not matching names or roster
numbers. Renames and roster swaps preserve identities; replacements do not
inherit the predecessor's career. Missing owners and owners assigned multiple
rosters in one season are excluded, with counts and explanations. Current/end
of season ownership snapshots do not reconstruct midseason ownership changes
or allocate credit to co-owners.

Career tables show loaded seasons, W/L/T, games, tie-adjusted win equivalent,
points for/against, and cross-season rivalry heat maps. Four historical fact
questions cover most wins, highest weekly score, closest decided game and
most frequent rivalries, with source, season/week and partial-coverage warnings.
Latest team names label each career. Scores/margins tied for a record display
the first game by season, week, and roster ID; most-wins/most-meetings answers
include ties. This is a bounded linked-history record book, not a claim that
disconnected or older leagues are complete.
Loaded career history is included in workspace backup and reload snapshots;
older version-1 backups without this optional field remain supported.
Snapshot history is labeled non-live. ESPN/imported cross-season identity
mapping, championships, final finishes, streaks and median/multi-opponent formats
remain unimplemented.

Median/multi-opponent formats,
automatic multi-season traversal, and verified finishes remain future work.
Standings and projections are never substituted for game scores.

### Schedule-based playoff scenarios

Open **League > Playoff Bracket** and select **Run 5,000-trial scenario**.
The new scenario is separate from the existing interactive, projection-based
bracket and its illustrative path approximations. Changing that bracket's picks
or controls does not change scenario trials.

Live inputs currently support Sleeper only: the current NFL regular season,
even 4-32-team leagues, 4/6/8 playoff teams, single-week rounds ending by Week 18,
no divisions/median games/byes. At least two completed weeks and at least one
remaining regular week are required. Fresh metadata and all regular-season
matchups are fetched (four weeks at a time); every team must have exactly one
known opponent per week and finite completed scores. Missing data, unsupported
rules, provider failures and inconsistent season/league IDs block output with
an explicit error. No incomplete or stale forecast is shown as a successful run.

Standings are reconstructed from completed regular-week scores, preserving ties
and negative scores. Current/future points are ignored, including any in-progress
week: those games are simulated in full. Seeds use win equivalents (wins plus
half of ties), then PF, then stable roster ID for exact ties. This is an explicit
scenario assumption, not automatic certification of provider tiebreakers or
custom standings overrides.

Each team's weekly score is an independent normal draw from its completed-week
mean and sample standard deviation, with a minimum standard deviation of 10,
rounded to cents. Negative scores remain possible. Future lineup changes,
injuries, NFL byes and score correlations are not modeled. Playoffs use those
same distributions, correct 4/6/8-team pairings and six-team first-round byes,
fixed/reseeded semifinals from fresh settings, and higher-seed exact-tie wins.
The fixed random seed makes identical inputs reproducible.

Results include every team's final seed distribution, qualification, bye,
finals/championship frequency, final win equivalents, and conditional
qualification frequency among trials in which it wins its next game (with sample
count). Conditional frequencies are not clinching guarantees or causal effects.
At 5,000 trials the worst-case sampling standard error is about 0.7 percentage
points; unmeasured model error can be much larger. These are uncalibrated
scenario estimates, not official odds, and do not replace older Power Rankings
approximations. Results are in-memory only, not workspace backup content.

Explore Demo runs a separate, explicitly fictional four-team scenario: two
supplied completed weeks, two invented remaining weeks, and playoffs in Weeks
5-6. It is not the demo's displayed standings or live league format.

## Winning-tool readiness

These are ten essential decision-tool categories, not a proven market ranking or
a promise of winning. Browser regression fixtures exercise the calculations and
interactions below; they do not establish projection accuracy against future
NFL results.

### Draft preparation

| Tool | Verified behavior | Remaining limitation |
| --- | --- | --- |
| Scoring/format-aware rankings | Reception presets; standard/superflex models and exact supported league starter-slot needs | Not complete custom scoring or IDP draft support |
| ADP/value comparison | Imported CSV or supplied player ADP; source retained; absent ADP stays unavailable | No licensed/current consensus ADP feed or draft-time data snapshots |
| Snake mock draft | Correct reversing order; recorded user picks; simulated opponents; unique picks; local save/undo; saved keepers removed in keeper mode | Practice only: no connected live draft, round-cost forfeiture or auction engine |
| Roster-needs and next-pick plan | Standard/superflex or exact imported supported slots; retained players count toward needs; next three snake picks | No full keeper-cost, IDP or arbitrary custom scoring engine |
| Draft review | Actual mock pick versus available ADP; exact round-value grade thresholds; missing ADP excluded from summary | Measures ADP value, not team win probability, draft-time consensus or actual NFL outcomes |

### In-season management

| Tool | Verified behavior | Remaining limitation |
| --- | --- | --- |
| Start/sit and game-day checklist | Empty/ineligible/injury/bye starter flags; replacement review; known kickoffs; clock-crossing locks; locked starters stay in their exact slots and locked bench players cannot enter | Unknown kickoff coverage is explicit; official inactive lists and provider-specific lock rules take precedence |
| Waiver/FAAB planning | Owned-player exclusion; lineup gains; ordered claims; budget/fallback warnings; Sleeper remaining balance when total/used metadata is verified | Planning budget remains manually controlled; deadlines, other-provider balances, conditional execution and submission remain unavailable |
| Two-team trade analysis | Ownership, duplication, projection and kickoff validation; both eligible starting lineups before/after; collapsed ROS/playoff model estimates; cleared packages clear stale output | Assumes immediate availability; no provider roster-limit, deadline or processing-time validation; asset values are heuristics |
| Schedule and bye coverage | Published league pairings; incomplete-data warnings; multiweek roster gaps; add/drop coverage scenarios | Provider/input dependent; unknown schedules are not inferred as byes; unsupported playoff/provider rules remain explicit |
| Relevant player updates | Selected-starter status sources/check times in the kickoff checklist; watchlist status changes, including recoveries, observed on sync | Partial: no licensed injury/role/news feed, official active-list integration or closed-browser push service |

### Reliability and data boundaries

- Page reload checks the player database and preserves selected context when
  still available. Data caches and snapshot provenance remain explicit.
- The compact status line distinguishes demo/imported/saved snapshots, failed
  syncs, unverified projections, player statuses older than six hours, and
  rosters at least fifteen minutes old. A different league's last sync cannot
  verify the current roster.
- JSON requests time out after twenty seconds, including response-body reads,
  with endpoint-specific errors. Kickoff failures are visible in Data status;
  they do not silently certify players as unlocked.
- ESPN roster remapping updates exact injury statuses even for already-known
  players. Starter slots preserve empty positions rather than shifting players
  into the wrong slots. Matchups use supplied scoring-week mappings.
- Private ESPN access remains unresolved on the static site. Signing in does
  not bypass browser cookie/CORS restrictions, and league `953585675` has not
  been verified accessible. Never enter session-cookie secrets in this UI.
- Secure provider-supported authentication where available, licensed/current
  projection/ADP/news inputs, verified waiver metadata, and background delivery
  require additional data agreements and/or backend work. None is fabricated by
  these improvements.

## Independent FFWrapped capability inventory

Source: <https://ffwrapped.com/> (public feature descriptions reviewed for this
rollout). This is a functional comparison, not a claim of full parity. Private
and Premium workflows have not been independently exercised.

| Publicly advertised capability | This project's coverage | Remaining work |
| --- | --- | --- |
| Power rankings, standings, scoring, expected wins | Rankings/projections plus verified loaded-score all-play, weekly expected wins and scheduling luck in Records | Replace older ranking approximations and add verified historical weekly trends |
| Weekly reports, awards, storylines | Compact final-result recap integrated into Inbox; completed-score weekly awards in Extras | Broader provider result coverage; no invented news or projected upset claims |
| League-specific roster and player values | Partial: scoring and roster models | Audit scoring completeness and positional assumptions |
| Playoff/championship odds and likely seeds | Schedule-validated Sleeper scenarios with seed distributions, full title paths and conditional next-win qualification; separate illustrative bracket | Calibrate scoring distributions; support more providers, tiebreakers, divisions, median games, byes, multiweek rounds and in-progress scoring |
| Trade comparison and mutually beneficial packages | Validated builder packages and both-team weekly starting-lineup changes; heuristic finder | Provider legality/processing rules, calibration and finder-model completeness |
| All-time records, finishes, head-to-head, rivalries | Season record book plus bounded Sleeper linked-season career records, owner-ID identity mapping and cross-season heat map | ESPN/imported career mapping, championships/finishes, streaks, disconnected seasons and broader provider rules |
| League Historian questions | Fixed season and career fact lookup over loaded scores with source/season context | Broader grounded questions, richer narratives and additional providers |
| FAAB planner | Ordered claims, fallback/budget warnings, outcome comparisons; Sleeper reported remaining balance | Other-provider balances, deadlines, conditional execution and authoritative reconciliation |
| Rate my team and player comparison | Dedicated player comparison, roster scenarios, explained league-relative weekly team grades with starter-group breakdowns | Validated historical production, calibrated season/dynasty grades, and provider-rule completeness |
| Weekly lineup analyzer | Partial: optimizer and kickoff locks | Provider rule verification and missing-input warnings |
| Dynasty analyzer | Partial: dynasty value/trade modes | Contract, pick, and long-term scenario validation |
| Draft grades and personalized draft plans | Mock plan; ADP grades; exact supported slots; keeper pool exclusion and roster needs | Actual draft imports/outcomes, draft-time snapshots, keeper-cost engine and live draft integration |
| Video recaps | Not implemented | Original shareable video generation and export |
| Sleeper, ESPN, Yahoo connections | Sleeper API; ESPN access-dependent; Yahoo file import | Secure backend/provider-supported authentication where available |

## Weekly positional matchups and start/sit guide

**Players → Weekly Matchups** is a dedicated tab that defaults to wide receivers,
with QB/RB/TE filters, all/selected-roster/unrostered scopes, player photos and
opponent logos. Startable projections are shown by default: QB >=14, RB/WR >=8,
TE >=6 projected points. Show all projections includes positive lower-output
players, labels them in muted gray and ranks them after players meeting the minimum.
The top 12 are ordered by projected points with the same capped matchup sensitivity
used by the start/sit guide, not matchup rating alone. This is illustrative, not
a new projection or calibrated scoring probability. Favorable (67–100), neutral
(34–66) and tough (0–33) ratings use green, amber and red with text labels.
Missing photos fall back to initials; missing opponent logos retain team text.
The shortlist links to the existing
Compare Players destination. **Compare Players → Who should I start?** presents
a projection-based lean with availability, known kickoff locks, positional
matchup evidence and verified season workload context. It distinguishes an
actionable roster comparison from informational comparisons of unowned or
opponent-owned players.

The shared weekly-matchups module aggregates Sleeper's public enriched weekly
stat records from at most six prior completed NFL weeks (three concurrent
requests at most). It uses each record's historical team/opponent metadata, not
the player's current team, and only the active season and weeks before both the
selected week and current NFL week. Failed weeks, invalid metadata and missing
scores remain explicit. Verified sparse zero-point participants require played
snaps, all three unranked sentinels, no supplied fantasy totals and no scoring
counters; other missing scores invalidate that defense's game sample. Legitimate
zero and negative scores are preserved.

Ratings require three observed games per defense and 24 qualifying defenses.
Higher 0–100 percentiles mean easier positional allowances; tied defenses share
a percentile. Ratings use standard/half/PPR totals, not custom bonuses,
opponent-quality adjustments, individual CB assignments or weather/news inputs.
Confidence is sample-based (low at 3–5 games, moderate at 6), not calibrated
predictive confidence. Snapshot/demo/imported data receives no live rating.
Upcoming opponents must come from the verified schedule cache; seeded schedule
grades never enter this tool. Per-page results and in-flight loads are keyed by
season/selected week, so changing context cannot display a different week's
results as current.

When both matchup inputs exist, the start/sit guide shows a clearly labeled
sensitivity estimate: 25% of positional allowance deviation from the sampled
mean, capped at +/-10% of each weekly projection. This is a heuristic, not a new
forecast or an extra guaranteed edge; projections may already include matchup.
Missing either input leaves the recommendation projection-only. Injury/bye/
inactive-roster availability takes precedence; kickoff-locked players receive
no actionable recommendation. Workload is displayed as context, not awarded a
second numerical bonus. Close calls are labeled. The optimizer's scoring is
not modified by this model.

Browser source validation against public historical 2025 Weeks 1–6 returned
4,036 records and 32 qualifying WR defense ratings. This proves source shape
and browser accessibility, not future data availability or predictive accuracy.
Private ESPN auth, full custom scoring, keeper-cost rules, provider waiver
deadlines, licensed news and background alerts remain outside this release.

## Multiweek roster planning

Open **My Team → Schedule & Coverage**, select a roster in the header, and
choose a 2-, 4-, or 6-week window beginning with the selected header week.
Windows stop at Week 18. The weekly comparison shows starter-slot coverage,
remaining gaps, and the change from an optional unowned-player addition and
active-roster drop. No-drop additions assume a free roster spot.

The availability matrix shows byes, scheduled opponents, unknown schedules,
and current injury labels. Coverage reuses the lineup assignment engine with
equal player weights: one player cannot cover multiple slots, and FLEX and
superflex eligibility are respected. It measures **coverage, not points or
player quality**. IR, taxi, and draft picks are excluded.

Ranges distinguish coverage with known schedule/bye information from possible
coverage including unknown schedules. Missing games are not automatically
byes: a schedule-derived bye requires 17 reciprocal games across Weeks 1–18.
Only fetched/cached schedules for that league season, checked within 12 hours,
are used; seeded fallback schedules do not count as verified inputs.
Individual supplied schedule games can still be incomplete or corrected.

JSON player entries (including optional `freeAgents`) or CSV player rows may
include `planningByeWeek`, an integer from 1 through 18. This is an explicit
user-supplied snapshot assumption, not independently verified provider data.
It takes precedence over fetched schedules for that imported player. Demo
players have fictional bye snapshots to illustrate clashes.

The injury toggle either holds currently Out/IR/PUP/Suspended/Doubtful players
out for the entire window or ignores those exclusions. Questionable remains
eligible with a visible status. Neither mode predicts recovery. Planning does
not submit transactions or model future scores, roster limits, waiver
deadlines, FAAB cost, or kickoff locks. Use the optimizer for this week's
lineup decisions and verify moves with your provider. Search narrows the first
100 available-player matches while retaining the selected candidate.
Candidates must be active NFL players, not owned on any loaded league roster.
Duplicate normalized name/position aliases are conservatively excluded from
ownership/candidate lists, and imported candidates from other leagues are
excluded. This does not independently verify provider waiver availability.
Scenarios are temporary and reset when switching rosters or leagues.

This closes the initial browser-only multiweek coverage gap, not all remaining
FFWrapped parity gaps. Backend integrations remain deferred.

## Next releases

1. Extend manual workspace snapshots with opt-in autosave and broader saved scenarios.
2. Source-linked player news, timestamped recommendation explanations, and
   explicit missing-data states. News requires a licensed or permitted feed.
3. Visibility-aware score refresh and action deadlines. Background push
   requires a service worker and notification delivery infrastructure.
4. Expand multiweek roster planning with cross-provider outcome tracking.
5. Historical record book, rivalries, calibrated season/dynasty grades, actual-draft reviews, and
   validated simulation features from the inventory above.
6. Backend authentication, optional cross-device persistence, and video
   generation after architecture, provider permissions, and hosting approval.
