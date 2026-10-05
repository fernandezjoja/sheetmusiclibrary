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
 * Checked against alphaTab 1.8.4 (MusicXmlImporter._parseDirection).
 */

const DIRECTION_TYPE = /<direction-type>([\s\S]*?)<\/direction-type>/g
const WORDS = /<words\b([^>]*)>([^<]*)<\/words>/g
// Only groups made of nothing but <words> runs are rewritten.
const ONLY_WORDS = /^(?:\s*<words\b[^>]*>[^<]*<\/words>)+\s*$/

/** Returns the MusicXML with multi-run staff text merged, or the input unchanged. */
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
  return changed ? new TextEncoder().encode(merged) : musicXml
}
