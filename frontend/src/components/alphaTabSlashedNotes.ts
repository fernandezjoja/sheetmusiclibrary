import { Environment, type model } from '@coderline/alphatab'

/**
 * Notes with a slashed notehead (<notehead>slashed</notehead>) mark the
 * reciting note in chant. They're drawn without their flag and augmentation
 * dot; head and stem stay, and timing and playback are unchanged.
 *
 * alphaTab's MusicXML importer ignores the slashed notehead, so
 * findSlashedNotes reads those notes from the MusicXML (part, measure,
 * voice, onset, pitch) and markSlashedNotes matches them to alphaTab's beats.
 * Then:
 *   - the dot: beat.dots is only read for drawing once the score is loaded
 *     (durations are computed at import), so it's set to 0;
 *   - the flag: BeamingHelper.hasFlag returns false for those beats.
 *
 * Private alphaTab API (checked against 1.8.4): Environment.defaultRenderers,
 * ScoreBarRenderer.shouldPaintBeamingHelper (to reach BeamingHelper), and
 * BeamingHelper.hasFlag. Like the other renderer patches it only reaches
 * main-thread rendering (core.useWorkers: false).
 */

const QUARTER_TICKS = 960
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export type SlashedNote = {
  part: number
  measure: number
  voice: number
  onsetTicks: number
  midi: number
}

/** Slashed-notehead notes in the MusicXML, with onsets in alphaTab ticks. */
export function findSlashedNotes(musicXml: Uint8Array): SlashedNote[] {
  const result: SlashedNote[] = []
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(musicXml), 'application/xml')
  doc.querySelectorAll('part').forEach((part, partIndex) => {
    let divisions = 1
    Array.from(part.children)
      .filter((el) => el.tagName === 'measure')
      .forEach((measure, measureIndex) => {
        let cursor = 0
        let lastOnset = 0
        for (const el of Array.from(measure.children)) {
          if (el.tagName === 'attributes') {
            const d = el.querySelector('divisions')
            if (d) divisions = Number(d.textContent) || divisions
          } else if (el.tagName === 'backup' || el.tagName === 'forward') {
            const duration = Number(el.querySelector('duration')?.textContent ?? 0)
            cursor += el.tagName === 'backup' ? -duration : duration
          } else if (el.tagName === 'note') {
            const isChord = !!el.querySelector('chord')
            const isGrace = !!el.querySelector('grace')
            const onset = isChord ? lastOnset : cursor
            if (el.querySelector('notehead')?.textContent === 'slashed') {
              const step = el.querySelector('pitch > step')?.textContent ?? ''
              const alter = Number(el.querySelector('pitch > alter')?.textContent ?? 0)
              const octave = Number(el.querySelector('pitch > octave')?.textContent ?? NaN)
              if (step in STEP_SEMITONES && !Number.isNaN(octave)) {
                result.push({
                  part: partIndex,
                  measure: measureIndex,
                  voice: Number(el.querySelector('voice')?.textContent ?? 1),
                  onsetTicks: Math.round((onset / divisions) * QUARTER_TICKS),
                  midi: (octave + 1) * 12 + STEP_SEMITONES[step] + alter,
                })
              }
            }
            if (!isChord) {
              lastOnset = cursor
              if (!isGrace) cursor += Number(el.querySelector('duration')?.textContent ?? 0)
            }
          }
        }
      })
  })
  return result
}

const slashedBeats = new WeakSet<model.Beat>()

/** Call from scoreLoaded, before rendering. Returns how many beats matched. */
export function markSlashedNotes(score: model.Score, notes: SlashedNote[]): number {
  let matched = 0
  for (const n of notes) {
    const track = score.tracks[n.part]
    if (!track) continue
    const candidates: model.Beat[] = []
    for (const staff of track.staves) {
      const bar = staff.bars[n.measure]
      if (!bar) continue
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          if (beat.playbackStart !== n.onsetTicks) continue
          if (!beat.notes.some((note) => note.realValue === n.midi)) continue
          candidates.push(beat)
        }
      }
    }
    // Voices sharing a pitch at the same time both match; prefer the
    // MusicXML voice (1-based, per part here) when it's among them.
    const sameVoice = candidates.filter((b) => b.voice.index === n.voice - 1)
    for (const beat of sameVoice.length > 0 ? sameVoice : candidates.slice(0, 1)) {
      if (!slashedBeats.has(beat)) matched++
      slashedBeats.add(beat)
      beat.dots = 0
    }
  }
  return matched
}

type BeamingHelperLike = { hasFlag(forceFlagOnSingleBeat: boolean, beat: model.Beat | null): boolean }
type ScoreBarRendererLike = { shouldPaintBeamingHelper(h: BeamingHelperLike): boolean }
type BarRendererFactoryLike = {
  staffId: string
  create(renderer: unknown, bar: model.Bar): ScoreBarRendererLike
}

let helperPatched = false

function patchBeamingHelper(h: BeamingHelperLike): void {
  if (helperPatched) return
  const proto = Object.getPrototypeOf(h) as BeamingHelperLike & { beats: model.Beat[] }
  const hasFlag = proto.hasFlag
  proto.hasFlag = function (this: BeamingHelperLike & { beats: model.Beat[] }, force, beat) {
    const target = beat ?? (this.beats.length === 1 ? this.beats[0] : null)
    if (target && slashedBeats.has(target)) return false
    return hasFlag.call(this, force, beat)
  }
  helperPatched = true
}

let patched = false

/** Idempotent; call once before creating the AlphaTabApi. */
export function patchSlashedNotes(): void {
  if (patched) return
  const factories = (Environment as unknown as { defaultRenderers: BarRendererFactoryLike[] })
    .defaultRenderers
  const factory = factories.find((f) => f.staffId === 'score')
  if (!factory) return
  // BeamingHelper isn't exported; reach its prototype through the first
  // helper the standard-notation renderer is asked to paint.
  const create = factory.create.bind(factory)
  factory.create = (renderer, bar) => {
    const r = create(renderer, bar)
    const shouldPaint = r.shouldPaintBeamingHelper.bind(r)
    r.shouldPaintBeamingHelper = (h) => {
      patchBeamingHelper(h)
      return shouldPaint(h)
    }
    return r
  }
  patched = true
}
