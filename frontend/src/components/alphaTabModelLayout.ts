import { SystemsLayoutMode, type AlphaTabApi, type model } from '@coderline/alphatab'

/**
 * Lays scores out with MuseScore's line breaks and measure proportions, so
 * the player matches the PDF (e.g. the last measure of a short piece doesn't
 * wrap onto its own line because alphaTab's spacing runs wider).
 *
 * With "Export layout" on, MuseScore writes every system start
 * (<print new-system="yes"> / new-page="yes") and every measure's width
 * (<measure width="…">). alphaTab's importer turns the breaks into line
 * breaks but still wraps on its own, and ignores the widths. In
 * SystemsLayoutMode.UseModelLayout alphaTab instead takes the number of bars
 * per system from score.systemsLayout and sizes bars within a system by
 * masterBar.displayScale, which is filled here from that information.
 *
 * Scores exported without layout (no measure widths) keep alphaTab's
 * automatic layout.
 */

export type MusicXmlLayout = {
  /** Number of measures in each system, in order. */
  barsPerSystem: number[]
  /** MuseScore width of each measure (tenths), used as relative weights. */
  measureWidths: number[]
}

/** Reads system breaks and measure widths from the first part; null if absent. */
export function findMusicXmlLayout(musicXml: Uint8Array): MusicXmlLayout | null {
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(musicXml), 'application/xml')
  const part = doc.querySelector('part')
  if (!part) return null
  const measures = Array.from(part.children).filter((el) => el.tagName === 'measure')
  if (measures.length === 0) return null

  const measureWidths = measures.map((m) => Number(m.getAttribute('width')))
  if (measureWidths.some((w) => !(w > 0))) return null

  const barsPerSystem: number[] = []
  measures.forEach((measure, index) => {
    const startsSystem =
      index === 0 ||
      !!measure.querySelector('print[new-system="yes"], print[new-page="yes"]')
    if (startsSystem) barsPerSystem.push(1)
    else barsPerSystem[barsPerSystem.length - 1]++
  })
  return { barsPerSystem, measureWidths }
}

/**
 * Call from scoreLoaded (before rendering). Switches the API to model layout
 * and fills the model from `layout`, or back to automatic when it's null.
 */
export function applyMusicXmlLayout(
  api: AlphaTabApi,
  score: model.Score,
  layout: MusicXmlLayout | null,
): void {
  const usable = !!layout && layout.measureWidths.length === score.masterBars.length
  // The main-thread renderer (core.useWorkers: false) holds this same
  // settings object, so setting it before the first render is enough.
  // api.updateSettings() would also re-run the player setup.
  api.settings.display.systemsLayoutMode = usable
    ? SystemsLayoutMode.UseModelLayout
    : SystemsLayoutMode.Automatic
  if (!usable || !layout) return

  // All tracks are rendered, so alphaTab reads the score-level values; the
  // track-level ones are set too for a single-track render.
  score.systemsLayout = layout.barsPerSystem
  for (const track of score.tracks) track.systemsLayout = layout.barsPerSystem
  score.masterBars.forEach((mb, i) => {
    mb.displayScale = layout.measureWidths[i]
  })
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      staff.bars.forEach((bar, i) => {
        bar.displayScale = layout.measureWidths[i]
      })
    }
  }
}
