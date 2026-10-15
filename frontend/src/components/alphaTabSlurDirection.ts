import { Environment, rendering, type model } from '@coderline/alphatab'

/**
 * Places slurs and ties by voice on two-voice staves: voice 1 (S, T) above,
 * voice 2 (A, B) below. alphaTab always curves them opposite the stem and
 * has no per-voice option, which puts the soprano's slurs between soprano
 * and alto.
 *
 * Every tie, slur, and legato glyph is handed to its bar renderer through
 * registerTie before layout computes its direction, so the patch wraps the
 * standard-notation renderer's registerTie and overrides the glyph's
 * calculateTieDirection. Private alphaTab API (checked against 1.8.4), and
 * like alphaTabFreeTime.ts it only reaches main-thread rendering
 * (core.useWorkers: false).
 */

type TieGlyphLike = {
  startNote?: model.Note
  startBeat?: model.Beat
  calculateTieDirection(): rendering.BeamDirection
}
type ScoreBarRendererLike = { registerTie(tie: TieGlyphLike): void }
type BarRendererFactoryLike = {
  staffId: string
  create(renderer: unknown, bar: model.Bar): ScoreBarRendererLike
}

function voiceDirection(beat: model.Beat | undefined): rendering.BeamDirection | null {
  if (!beat) return null
  const voicesWithNotes = beat.voice.bar.voices.filter((v) => !v.isEmpty).length
  if (voicesWithNotes < 2) return null
  return beat.voice.index === 0 ? rendering.BeamDirection.Up : rendering.BeamDirection.Down
}

let patched = false

/** Idempotent; call once before creating the AlphaTabApi. */
export function placeSlursByVoice(): void {
  if (patched) return
  const factories = (Environment as unknown as { defaultRenderers: BarRendererFactoryLike[] })
    .defaultRenderers
  const factory = factories.find((f) => f.staffId === 'score')
  if (!factory) return
  const create = factory.create.bind(factory)
  factory.create = (renderer, bar) => {
    const r = create(renderer, bar)
    const register = r.registerTie.bind(r)
    r.registerTie = (tie) => {
      const fallback = tie.calculateTieDirection.bind(tie)
      tie.calculateTieDirection = () =>
        voiceDirection(tie.startNote?.beat ?? tie.startBeat) ?? fallback()
      register(tie)
    }
    return r
  }
  patched = true
}
