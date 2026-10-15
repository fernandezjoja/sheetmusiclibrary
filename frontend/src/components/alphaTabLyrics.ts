import { Environment, NotationElement, platform, type model } from '@coderline/alphatab'

/**
 * Recitation lyrics in chant: one note carrying a whole phrase ("te ha
 * glorificado en todas partes, oh María, …"), sung on that pitch.
 *
 * alphaTab centers every lyric on its note and spaces notes strictly by
 * duration, so a long phrase spills over the neighbouring notes and their
 * syllables. For lyrics with more than one word this:
 *   1. left-aligns the text so it starts at its note, and
 *   2. gives that note enough room for the text before the next note.
 * Single syllables keep alphaTab's placement and spacing.
 *
 * How 2 works: a bar's notes sit on "springs", one per time position, and
 * the gap after a note is force / springConstant. A spring's minimum width
 * only raises the bar's minimum force, which stretches every gap evenly, so
 * it can't widen one gap. Instead, after alphaTab computes the constants,
 * the recitation note's constant is lowered so that at the smallest force
 * the bar can be drawn with, its gap already fits the text. Other gaps
 * are unchanged; the bar gets wider by the extra room.
 *
 * Private alphaTab API (checked against 1.8.4): the renderer factories'
 * effect bands, LyricsEffectInfo.createNewGlyph, BarRendererBase.addBeatGlyph,
 * BeatContainerGlyph.registerLayoutingInfo, and BarLayoutingInfo's springs
 * and _calculateSpringConstants. Like the other renderer patches it only
 * reaches main-thread rendering (core.useWorkers: false).
 */

// Space between the end of a phrase and the next note, leaving room for the
// next note's (centered) syllable.
const GAP_AFTER_TEXT = 20
// alphaTab's default display.stretchForce, the lowest force a bar is drawn at
// unless its minimum widths need more.
const DEFAULT_STRETCH_FORCE = 1

// Words in imported lyrics are separated by non-breaking spaces, which \s
// matches.
function isRecitation(beat: model.Beat | undefined): boolean {
  return !!beat?.lyrics?.some((line) => /\S\s+\S/.test(line))
}

// alphaTab's SVG canvas estimates text width from a built-in table, which
// comes out short for the italic lyric font, so measure in the browser.
let measureContext: CanvasRenderingContext2D | null = null
function measureWidth(text: string, cssFont: string): number {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext) return 0
  measureContext.font = cssFont
  return measureContext.measureText(text).width
}

type Spring = { timePosition: number; springConstant: number }
type BarLayoutingInfoLike = {
  minStretchForce: number
  totalSpringConstant: number
  _timeSortedSprings: Spring[]
  _onTimePositions: unknown
  _calculateSpringConstants(minDuration: number): void
}
type BeatContainerLike = {
  beat: model.Beat
  registerLayoutingInfo(layoutings: BarLayoutingInfoLike): void
}
type ScoreBarRendererLike = {
  resources: { elementFonts: Map<NotationElement, { toCssString(scale?: number): string }> }
  addBeatGlyph(g: BeatContainerLike): void
}
type LyricsGlyphLike = { textAlign: platform.TextAlign }
type EffectInfoLike = {
  notationElement: NotationElement
  createNewGlyph(renderer: unknown, beat: model.Beat): LyricsGlyphLike
}
type BarRendererFactoryLike = {
  staffId: string
  effectBands: { effect: EffectInfoLike }[]
  create(renderer: unknown, bar: model.Bar): ScoreBarRendererLike
}

// Per bar (one BarLayoutingInfo is shared by all staves of a bar): the room
// each recitation note needs after it, keyed by the note's time position.
const requiredGaps = new WeakMap<BarLayoutingInfoLike, Map<number, number>>()

let springsPatched = false

function widenRecitationSprings(info: BarLayoutingInfoLike): void {
  if (springsPatched) return
  const proto = Object.getPrototypeOf(info) as BarLayoutingInfoLike
  const calculate = proto._calculateSpringConstants
  proto._calculateSpringConstants = function (this: BarLayoutingInfoLike, minDuration) {
    calculate.call(this, minDuration)
    const gaps = requiredGaps.get(this)
    const force = Math.max(this.minStretchForce, DEFAULT_STRETCH_FORCE)
    if (!gaps || !(force > 0)) return
    let changed = false
    for (const spring of this._timeSortedSprings) {
      const gap = gaps.get(spring.timePosition)
      if (!gap) continue
      // gap = force / constant at the lowest force used.
      const constant = force / gap
      if (constant < spring.springConstant) {
        spring.springConstant = constant
        changed = true
      }
    }
    if (!changed) return
    let inverse = 0
    for (const spring of this._timeSortedSprings) inverse += 1 / spring.springConstant
    this.totalSpringConstant = 1 / inverse
    this._onTimePositions = null
  }
  springsPatched = true
}

let patched = false

/** Idempotent; call once before creating the AlphaTabApi. */
export function layOutRecitationLyrics(): void {
  if (patched) return
  const factories = (Environment as unknown as { defaultRenderers: BarRendererFactoryLike[] })
    .defaultRenderers
  const factory = factories.find((f) => f.staffId === 'score')
  // The lyrics band is registered on the tab renderer as a shared band;
  // alphaTab moves shared bands onto whichever staff is shown (here the
  // standard-notation one), so search every factory.
  const lyrics = factories
    .flatMap((f) => f.effectBands)
    .find((b) => b.effect.notationElement === NotationElement.EffectLyrics)?.effect
  if (!factory || !lyrics) return

  // 1. Left-align recitation text.
  const createGlyph = lyrics.createNewGlyph.bind(lyrics)
  lyrics.createNewGlyph = (renderer, beat) => {
    const g = createGlyph(renderer, beat)
    if (isRecitation(beat)) g.textAlign = platform.TextAlign.Left
    return g
  }

  // 2. Record how much room each recitation note needs; the spring patch
  // applies it when alphaTab computes the bar's spacing.
  const create = factory.create.bind(factory)
  factory.create = (renderer, bar) => {
    const r = create(renderer, bar)
    const addBeatGlyph = r.addBeatGlyph.bind(r)
    r.addBeatGlyph = (container) => {
      if (isRecitation(container.beat)) {
        const register = container.registerLayoutingInfo.bind(container)
        container.registerLayoutingInfo = (info) => {
          register(info)
          const font = r.resources.elementFonts.get(NotationElement.EffectLyrics)
          if (!font) return
          const cssFont = font.toCssString()
          const textWidth = Math.max(
            ...(container.beat.lyrics ?? []).map((line) => measureWidth(line, cssFont)),
          )
          widenRecitationSprings(info)
          let gaps = requiredGaps.get(info)
          if (!gaps) requiredGaps.set(info, (gaps = new Map()))
          const start = container.beat.absoluteDisplayStart
          gaps.set(start, Math.max(gaps.get(start) ?? 0, textWidth + GAP_AFTER_TEXT))
        }
      }
      addBeatGlyph(container)
    }
    return r
  }

  patched = true
}
