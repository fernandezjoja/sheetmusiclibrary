import { Environment, type model } from '@coderline/alphatab'

/**
 * Support for free-rhythm chant in alphaTab.
 *
 * MuseScore lets a measure's actual duration differ from its time signature
 * (Measure Properties → actual duration) and exports only the nominal
 * signature, e.g. 4/4 on a measure holding 15 quarters. alphaTab times every
 * bar from its time signature, so those bars overlap in playback and the
 * cursor jumps. OSMD timed bars from their notes, which is why this worked
 * with the old player.
 *
 * The fix has two parts:
 *   1. fitTimeSignaturesToContent rewrites each mismatched bar's signature to
 *      its real length, which fixes playback and the cursor.
 *   2. hideRewrittenTimeSignatures stops alphaTab from drawing those
 *      signatures (otherwise nearly every chant bar shows "15/4", "31/16"…).
 *      alphaTab has no setting for this, so it overrides a private renderer
 *      method. It only works when rendering on the main thread
 *      (core.useWorkers: false); a render worker has its own copy of
 *      alphaTab that this patch can't reach.
 *
 * Both depend on alphaTab internals (checked against 1.8.4). Re-check them
 * when upgrading.
 */

const QUARTER_TICKS = 960
const WHOLE_TICKS = QUARTER_TICKS * 4

// Master bars whose time signature must not be drawn: the rewritten ones, and
// the bar after each rewritten one (alphaTab would otherwise redraw the
// original signature there because it differs from the previous bar's).
const hiddenTimeSignatures = new WeakSet<model.MasterBar>()

/**
 * Sets each bar's time signature to the length of its longest staff when
 * that differs from the declared signature. Call from `scoreLoaded`, which
 * fires before alphaTab generates MIDI and renders.
 */
export function fitTimeSignaturesToContent(score: model.Score): void {
  let changed = false
  for (const mb of score.masterBars) {
    let actual = 0
    for (const track of score.tracks) {
      for (const staff of track.staves) {
        const bar = staff.bars[mb.index]
        if (bar) actual = Math.max(actual, bar.calculateDuration())
      }
    }
    if (actual <= 0 || actual === mb.calculateDuration()) continue

    // Smallest denominator that expresses the length exactly (15 quarters →
    // 15/4, 7.75 quarters → 31/16).
    const denominator = [4, 8, 16, 32, 64].find((d) => actual % (WHOLE_TICKS / d) === 0)
    if (!denominator) continue
    mb.timeSignatureNumerator = actual / (WHOLE_TICKS / denominator)
    mb.timeSignatureDenominator = denominator
    mb.timeSignatureCommon = false
    hiddenTimeSignatures.add(mb)
    if (mb.nextMasterBar) hiddenTimeSignatures.add(mb.nextMasterBar)
    changed = true
  }
  if (!changed) return

  // Bar start ticks were computed at import from the old signatures. Same
  // rule as alphaTab's Score.addMasterBar.
  for (const mb of score.masterBars) {
    const prev = mb.previousMasterBar
    if (prev) mb.start = prev.start + (prev.isAnacrusis ? 0 : prev.calculateDuration())
  }
}

type ScoreBarRendererLike = {
  bar: model.Bar
  _createTimeSignatureGlyphs(): void
}
type BarRendererFactoryLike = {
  staffId: string
  create(renderer: unknown, bar: model.Bar): ScoreBarRendererLike
}

let patched = false

/**
 * Makes alphaTab's standard-notation bar renderer skip the time signature on
 * bars marked by fitTimeSignaturesToContent. Idempotent; call once before
 * creating the AlphaTabApi.
 */
export function hideRewrittenTimeSignatures(): void {
  if (patched) return
  const factories = (Environment as unknown as { defaultRenderers: BarRendererFactoryLike[] })
    .defaultRenderers
  const factory = factories.find((f) => f.staffId === 'score')
  if (!factory) return
  const create = factory.create.bind(factory)
  factory.create = (renderer, bar) => {
    const r = create(renderer, bar)
    const draw = r._createTimeSignatureGlyphs.bind(r)
    r._createTimeSignatureGlyphs = () => {
      if (!hiddenTimeSignatures.has(r.bar.masterBar)) draw()
    }
    return r
  }
  patched = true
}
