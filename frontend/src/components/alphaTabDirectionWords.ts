import { Environment, NotationElement, type model } from '@coderline/alphatab'

/**
 * Staff text written in several runs, e.g. a bold "Antífona 1", " - " and an
 * italic "Obikhod Tono 8 Estiquio". MuseScore exports each run as its own
 * <words> inside one <direction-type>:
 *
 *   <direction-type>
 *     <words font-weight="bold">Antífona 1</words>
 *     <words> - </words>
 *     <words font-style="italic">Obikhod Tono 8 Estiquio</words>
 *   </direction-type>
 *
 * alphaTab's MusicXML importer reads one child per <direction-type>, the
 * last, so only "Obikhod Tono 8 Estiquio" reached the page. mergeDirectionWords
 * rewrites the MusicXML before it is loaded so each such group is a single
 * <words> holding the whole text. Per-run styling is dropped; alphaTab draws
 * all beat text in one font anyway (NotationElement.EffectText).
 *
 * Several staff texts on one note, e.g. "Hora Prima - Obikhod Tono 8 Estiquio"
 * and "(dos veces)" on the first note of a section. MuseScore exports each as
 * its own <direction>. The importer keeps one text for the next note, so the
 * last one replaced the others. Consecutive text-only directions are merged
 * into a single <words> with one text per line, highest first; alphaTab's
 * TextGlyph draws each line under the previous one. It advances by the height
 * of the tallest letter in the line, which makes the lines touch, so
 * spaceStackedTextLines gives each line of such a text the font's line height.
 *
 * Checked against alphaTab 1.8.4 (MusicXmlImporter._parseDirection, TextGlyph,
 * TextEffectInfo.createNewGlyph). The glyph patch is private API and, like the
 * other renderer patches, only reaches main-thread rendering.
 */

const DIRECTION_TYPE = /<direction-type>([\s\S]*?)<\/direction-type>/g
const WORDS = /<words\b([^>]*)>([^<]*)<\/words>/g
// Only groups made of nothing but <words> runs are rewritten.
const ONLY_WORDS = /^(?:\s*<words\b[^>]*>[^<]*<\/words>)+\s*$/

// A <direction> holding one <words> and nothing else but an optional <staff>.
const TEXT_DIRECTION =
  '<direction\\b[^>]*>\\s*<direction-type>\\s*<words\\b[^>]*>[^<]*</words>\\s*</direction-type>\\s*(?:<staff>\\d+</staff>\\s*)?</direction>'
const TEXT_DIRECTION_RUN = new RegExp(`${TEXT_DIRECTION}(?:\\s*${TEXT_DIRECTION})+`, 'g')
const TEXT_DIRECTION_PARTS = new RegExp(
  TEXT_DIRECTION.replace('<words\\b[^>]*>[^<]*</words>', '<words\\b([^>]*)>([^<]*)</words>').replace(
    '(?:<staff>\\d+</staff>\\s*)?',
    '(<staff>\\d+</staff>)?\\s*',
  ),
  'g',
)
const RELATIVE_Y = /\brelative-y="(-?[\d.]+)"/

/** Merges consecutive text-only directions into one text with a line per direction. */
function mergeStackedTexts(source: string): string {
  return source.replace(TEXT_DIRECTION_RUN, (run) => {
    const texts = [...run.matchAll(TEXT_DIRECTION_PARTS)].map((part) => ({
      text: part[2],
      staff: part[3] ?? '',
      y: Number(RELATIVE_Y.exec(part[1])?.[1] ?? Number.NaN),
    }))
    if (texts.some((t) => t.staff !== texts[0].staff)) return run
    // Higher relative-y is higher on the page. Without it, keep document order.
    if (texts.every((t) => !Number.isNaN(t.y))) texts.sort((a, b) => b.y - a.y)
    const lines = texts.map((t) => t.text).join('\n')
    return `<direction placement="above"><direction-type><words>${lines}</words></direction-type>${texts[0].staff}</direction>`
  })
}

/** Returns the MusicXML with staff text merged, or the input unchanged. */
export function mergeDirectionWords(musicXml: Uint8Array): Uint8Array {
  const source = new TextDecoder().decode(musicXml)
  let changed = false
  const merged = source.replace(DIRECTION_TYPE, (block, inner: string) => {
    if (!ONLY_WORDS.test(inner)) return block
    const runs = [...inner.matchAll(WORDS)]
    if (runs.length < 2) return block
    changed = true
    // Runs read left to right. They usually carry their own spacing (" - ");
    // add a space only where two runs would otherwise touch.
    const text = runs
      .map((run) => run[2])
      .reduce((all, next) => (/\s$/.test(all) || /^\s/.test(next) ? all + next : `${all} ${next}`))
    return `<direction-type><words${runs[0][1]}>${text}</words></direction-type>`
  })
  const stacked = mergeStackedTexts(merged)
  return changed || stacked !== merged ? new TextEncoder().encode(stacked) : musicXml
}

// Line height of stacked staff text, as a multiple of the font size.
const LINE_HEIGHT = 1.2

type TextGlyphLike = {
  _lines: string[]
  _lineHeights: number[] | null
  font: { size: number }
  height: number
  doLayout(): void
}
type EffectInfoLike = {
  notationElement: NotationElement
  createNewGlyph(renderer: unknown, beat: model.Beat): TextGlyphLike
}
type BarRendererFactoryLike = { effectBands: { effect: EffectInfoLike }[] }

let patched = false

/** Idempotent; call once before creating the AlphaTabApi. */
export function spaceStackedTextLines(): void {
  if (patched) return
  const factories = (Environment as unknown as { defaultRenderers: BarRendererFactoryLike[] })
    .defaultRenderers
  const effects = new Set(
    factories
      .flatMap((f) => f.effectBands)
      .map((b) => b.effect)
      .filter((e) => e.notationElement === NotationElement.EffectText),
  )
  for (const effect of effects) {
    const createGlyph = effect.createNewGlyph.bind(effect)
    effect.createNewGlyph = (renderer, beat) => {
      const g = createGlyph(renderer, beat)
      // Private fields: leave the glyph alone if a later alphaTab lacks them.
      if (!Array.isArray(g._lines) || g._lines.length < 2 || typeof g.font?.size !== 'number') return g
      const doLayout = g.doLayout.bind(g)
      g.doLayout = () => {
        doLayout()
        const lineHeight = g.font.size * LINE_HEIGHT
        g._lineHeights = g._lines.map(() => lineHeight)
        g.height = lineHeight * g._lines.length
      }
      return g
    }
  }
  patched = true
}
