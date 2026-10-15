import { Environment, midi, model } from '@coderline/alphatab'

/**
 * Fully hides notes hidden in MuseScore, used for syllables sung on a
 * repeated recitation note, while keeping them audible. MuseScore exports
 * them either as <note print-object="no"> (V key) or with
 * <notehead>none</notehead>.
 *
 * alphaTab handles the two differently, and neither fully:
 *   - notehead none: only the head is blank. The note still counts as
 *     visible, so its augmentation dot, stem, and beam are drawn.
 *   - print-object="no": the beat is marked empty, and alphaTab treats empty
 *     beats as rests (Beat.isRest), so the note doesn't play.
 * Beats must be empty to render with no visible notes (the chord glyph
 * crashes otherwise) and not empty to play, so:
 *   - hideInvisibleNotes (from scoreLoaded) marks both kinds of notes
 *     invisible and their beats empty, and splits beams around those beats
 *     (Beat.beamingMode) so they form beam groups of their own;
 *   - the MIDI generator patch un-empties them while generating;
 *   - the renderer patch skips painting beam groups made only of them,
 *     which would otherwise still get a stem and flag.
 *
 * Private alphaTab API (checked against 1.8.4): MidiFileGenerator.generate
 * and _score, ScoreBarRenderer.shouldPaintBeamingHelper. Like the other
 * renderer patches this only reaches main-thread rendering
 * (core.useWorkers: false).
 */

// MusicFontSymbol.NoteheadNull (SMuFL U+E0A5), what alphaTab's MusicXML
// importer sets for <notehead>none</notehead>. The enum isn't exported.
const NOTEHEAD_NULL = 0xe0a5

function isHidden(beat: model.Beat): boolean {
  return beat.notes.length > 0 && beat.notes.every((n) => !n.isVisible)
}

const hiddenBeatsByScore = new WeakMap<model.Score, model.Beat[]>()

/** Call from scoreLoaded, before MIDI generation and rendering. */
export function hideInvisibleNotes(score: model.Score): void {
  const hiddenBeats: model.Beat[] = []
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            for (const note of beat.notes) {
              if ((note.style?.noteHead as number | undefined) === NOTEHEAD_NULL) note.isVisible = false
            }
            if (!isHidden(beat)) continue
            beat.isEmpty = true
            hiddenBeats.push(beat)
            beat.beamingMode = model.BeatBeamingMode.ForceSplitToNext
            if (beat.previousBeat) beat.previousBeat.beamingMode = model.BeatBeamingMode.ForceSplitToNext
          }
        }
      }
    }
  }
  hiddenBeatsByScore.set(score, hiddenBeats)
}

type BeamingHelperLike = { beats: model.Beat[] }
type ScoreBarRendererLike = { shouldPaintBeamingHelper(h: BeamingHelperLike): boolean }
type BarRendererFactoryLike = {
  staffId: string
  create(renderer: unknown, bar: model.Bar): ScoreBarRendererLike
}

type GeneratorInternals = { _score: model.Score; generate(): void }

let patched = false

/** Idempotent; call once before creating the AlphaTabApi. */
export function patchHiddenNotes(): void {
  if (patched) return

  const proto = midi.MidiFileGenerator.prototype as unknown as GeneratorInternals
  const generate = proto.generate
  proto.generate = function (this: GeneratorInternals) {
    const hiddenBeats = hiddenBeatsByScore.get(this._score) ?? []
    for (const beat of hiddenBeats) beat.isEmpty = false
    try {
      generate.call(this)
    } finally {
      for (const beat of hiddenBeats) beat.isEmpty = true
    }
  }

  const factories = (Environment as unknown as { defaultRenderers: BarRendererFactoryLike[] })
    .defaultRenderers
  const factory = factories.find((f) => f.staffId === 'score')
  if (!factory) return
  const create = factory.create.bind(factory)
  factory.create = (renderer, bar) => {
    const r = create(renderer, bar)
    const shouldPaint = r.shouldPaintBeamingHelper.bind(r)
    r.shouldPaintBeamingHelper = (h) => shouldPaint(h) && !h.beats.every(isHidden)
    return r
  }
  patched = true
}
