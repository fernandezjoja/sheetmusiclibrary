import { useEffect, useRef, useState } from 'react'
import {
  OpenSheetMusicDisplay,
  type Instrument,
  type Voice,
  type VoiceEntry,
} from 'opensheetmusicdisplay'
import PlaybackEngine from 'osmd-audio-player'
import { PlaybackEvent, PlaybackState } from 'osmd-audio-player/dist/PlaybackEngine'

/**
 * One clickable note's rendered SVG element + its iteration step.
 * Built once after osmd.render(); used by handleScoreClick to do
 * pixel-exact hit testing via the browser's getBoundingClientRect.
 */
type ClickableNote = { el: SVGElement; step: number }

type Props = { url: string }
type Status = 'loading-score' | 'loading-audio' | 'ready' | 'error'
type VoiceInfo = { label: string; muted: boolean; ref: Voice }

// PlaybackEngine internals exposed for click-to-play. These fields are declared
// `private` in the .d.ts but populated and stable enough to read/write — we
// need both: `currentIterationStep` (for progress tracking) and `scheduler`
// (to override the scheduler's "next-to-play" index after a seek).
type EngineInternals = {
  iterationSteps: number
  currentIterationStep: number
  scheduler: { setIterationStep(step: number): void }
}

/**
 * Walk the rendered score and return one entry per note that has a backing
 * SVG element. Each entry pairs the DOM element with its iteration step so a
 * click hit-test can directly map a clicked element back to the right step.
 *
 * Implementation notes:
 *   - Iteration step is computed by walking a fresh MusicPartManager iterator
 *     in parallel and recording (VoiceEntry → step) on first visit.
 *   - The rendered DOM element comes from VexFlow's StaveNote — OSMD attaches
 *     the rendered VexFlow object to each GraphicalVoiceEntry as `vfStaveNote`,
 *     and VexFlow stores the SVG group on `attrs.el` after rendering. These
 *     are runtime-only fields so we cast through a small interface.
 */
function buildClickableNotes(osmd: OpenSheetMusicDisplay): ClickableNote[] {
  const veToStep = new Map<VoiceEntry, number>()
  const iter = osmd.Sheet.MusicPartManager.getIterator()
  let step = 0
  while (!iter.EndReached) {
    const entries = iter.CurrentVoiceEntries as VoiceEntry[] | undefined
    if (entries) {
      for (const ve of entries) {
        if (!veToStep.has(ve)) veToStep.set(ve, step)
      }
    }
    iter.moveToNext()
    step++
  }

  type VfBacked = { vfStaveNote?: { attrs?: { el?: SVGElement } } }
  const result: ClickableNote[] = []
  // GraphicSheet.MeasureList is a 2D array: outer = vertical staff index,
  // inner = measure number. Each entry is a GraphicalMeasure (or undefined
  // if a staff is hidden in that measure).
  for (const row of osmd.GraphicSheet.MeasureList ?? []) {
    for (const measure of row ?? []) {
      if (!measure) continue
      for (const se of measure.staffEntries ?? []) {
        for (const gve of se.graphicalVoiceEntries ?? []) {
          const s = veToStep.get(gve.parentVoiceEntry)
          if (s === undefined) continue
          const el = (gve as unknown as VfBacked).vfStaveNote?.attrs?.el
          if (el) result.push({ el, step: s })
        }
      }
    }
  }
  return result
}

/**
 * Build one mute-toggle entry per <voice> in the score.
 * Naming convention:
 *   - 2 instruments (closed-score SATB layout): "TS V1", "TS V2", "BS V1", "BS V2"
 *   - other instrument counts: fall back to the instrument's name when it has a single voice,
 *     otherwise label as "S<idx> V<n>"
 */
function buildVoiceInfos(instruments: Instrument[]): VoiceInfo[] {
  const result: VoiceInfo[] = []
  const isTwoStaffLayout = instruments.length === 2

  instruments.forEach((inst, instIdx) => {
    const voices = inst.Voices
    const staffPrefix = isTwoStaffLayout
      ? instIdx === 0
        ? 'TS'
        : 'BS'
      : `S${instIdx + 1}`

    voices.forEach((voice, voiceIdx) => {
      let label: string
      if (voices.length === 1 && inst.Name?.trim()) {
        // Open-score / single-voice-per-instrument: use the instrument name as-is.
        label = inst.Name.trim()
      } else {
        label = `${staffPrefix} V${voiceIdx + 1}`
      }
      result.push({ label, muted: false, ref: voice })
    })
  })

  return result
}

export default function ScorePlayer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PlaybackEngine | null>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const clickableNotesRef = useRef<ClickableNote[]>([])
  // Set to true after a seek to step > 0 so the next ITERATION event can
  // undo the audio player's automatic cursor advance (which would put cursor
  // on the note *after* the one we landed on).
  const undoFirstAdvanceRef = useRef(false)
  const [status, setStatus] = useState<Status>('loading-score')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let engine: PlaybackEngine | null = null

    setStatus('loading-score')
    setErrorMessage(null)
    setVoices([])
    setCurrentStep(0)
    setTotalSteps(0)

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawComposer: false,
      cursorsOptions: [
        // `follow: true` auto-scrolls the page to keep the cursor in view
        // during normal playback. Seek-jumps still trigger an explicit
        // scrollIntoView in handleSeek for predictable centering.
        { type: 0, color: '#ff7a00', alpha: 0.4, follow: true },
      ],
      // Honor system / page breaks from the MusicXML itself
      // (`<print new-system>` / `<print new-page>` elements).
      // Requires the source MusicXML to actually include them — in MuseScore,
      // enable Preferences → Import & Export → MusicXML → "Export layout"
      // before exporting.
      newSystemFromXML: true,
      newPageFromXML: true,
    })
    osmdRef.current = osmd

    ;(async () => {
      try {
        await osmd.load(url)
        if (cancelled) return
        osmd.render()
        if (cancelled) return

        setStatus('loading-audio')
        engine = new PlaybackEngine()
        engineRef.current = engine

        engine.on(PlaybackEvent.STATE_CHANGE, (state: PlaybackState) => {
          if (cancelled) return
          setPlaybackState(state)
          if (state === PlaybackState.STOPPED) setCurrentStep(0)
        })

        await engine.loadScore(osmd)
        if (cancelled) return

        const internals = engine as unknown as EngineInternals
        engine.on(PlaybackEvent.ITERATION, () => {
          if (cancelled) return
          // The audio player's iterationCallback auto-advances the cursor on
          // every iteration after step 0 (`if (currentIterationStep > 0)
          // cursor.next()`). After a seek, we want the *clicked* note to play
          // first, not the one after it — so we undo that single advance the
          // first time iter fires post-seek. The cursor lands back on the
          // note the user clicked, audio plays it, and from the next iter
          // onwards advances proceed normally.
          if (undoFirstAdvanceRef.current) {
            osmd.cursor.previous()
            undoFirstAdvanceRef.current = false
          }
          setCurrentStep(internals.currentIterationStep)
        })

        // Make the cursor visible immediately (the audio player only calls
        // cursor.show() inside play() on first run, so without this the
        // user sees nothing until they click Play — and seeking before
        // playing wouldn't visibly move the cursor either).
        osmd.cursors.forEach((cursor) => cursor.show())

        // Build a flat list of (rendered SVG element, iteration step) pairs
        // so click handling can do exact DOM hit-testing instead of brittle
        // coordinate math. Browser's getBoundingClientRect handles all SVG
        // transforms, scroll offsets, and zoom for us.
        clickableNotesRef.current = buildClickableNotes(osmd)

        setVoices(buildVoiceInfos(engine.scoreInstruments))
        setPlaybackState(engine.state)
        setTotalSteps(internals.iterationSteps)
        setStatus('ready')
      } catch (e: unknown) {
        if (cancelled) return
        setErrorMessage(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      if (engine) {
        // Stop is async and we're tearing down — fire-and-forget is fine here.
        engine.stop().catch(() => {})
      }
      engineRef.current = null
      osmdRef.current = null
      clickableNotesRef.current = []
      container.innerHTML = ''
    }
  }, [url])

  // Spacebar toggles play/pause once the player is ready. Mirrors the
  // standard media-player shortcut (YouTube, MuseScore, Spotify, etc.).
  useEffect(() => {
    if (status !== 'ready') return

    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Don't hijack space while the user is typing in a form field.
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      const engine = engineRef.current
      if (!engine) return

      e.preventDefault() // suppress the default page-scroll on space
      if (playbackState === PlaybackState.PLAYING) {
        engine.pause()
      } else {
        engine.play().catch((err: unknown) =>
          setErrorMessage(err instanceof Error ? err.message : String(err)),
        )
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [status, playbackState])

  const handlePlay = () => {
    engineRef.current?.play().catch((e: unknown) =>
      setErrorMessage(e instanceof Error ? e.message : String(e)),
    )
  }
  const handlePause = () => {
    engineRef.current?.pause()
  }
  const handleStop = () => {
    engineRef.current?.stop().catch(() => {})
  }

  const seekToStep = (step: number, scrollMode: 'center' | 'nearest' | 'none') => {
    const engine = engineRef.current
    const osmd = osmdRef.current
    if (!engine || !osmd) return
    const target = Math.max(0, Math.min(Math.max(0, totalSteps - 1), step))
    const wasPlaying = playbackState === PlaybackState.PLAYING

    // Workaround: the audio player's jumpToStep takes a "reset + walk forward"
    // path on rewinds and a "walk forward only" path on forward seeks. The
    // forward-only path leaves the cursor / scheduler in an off-by-one state
    // that desyncs the cursor from playback by one note. Round-tripping through
    // step 0 first guarantees the reset branch runs, fixing the desync.
    if (target > 0) engine.jumpToStep(0)
    engine.jumpToStep(target)
    setCurrentStep(target)

    // jumpToStep deliberately sets the scheduler one step ahead of the cursor
    // (so a normal "resume from here" plays the next note). We want the
    // *clicked* note to play, so override the scheduler's next-to-play index
    // and arm undoFirstAdvance so the first iter callback's automatic cursor
    // advance gets reverted. For step 0 the audio player already starts at 0
    // without an advance, so no override is needed.
    if (target > 0) {
      const internals = engine as unknown as EngineInternals
      internals.scheduler.setIterationStep(target)
      undoFirstAdvanceRef.current = true
    } else {
      undoFirstAdvanceRef.current = false
    }

    if (scrollMode !== 'none') {
      const cursorEl = osmd.cursors[0]?.cursorElement
      if (cursorEl) {
        cursorEl.scrollIntoView({ behavior: 'smooth', block: scrollMode })
      }
    }

    // jumpToStep pauses internally; resume if the user was playing when they clicked.
    if (wasPlaying) engine.play().catch(() => {})
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalSteps === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekToStep(Math.floor(fraction * totalSteps), 'center')
  }

  const handleScoreClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalSteps === 0) return
    // DOM-native hit test: walk the precomputed (notehead element, step)
    // pairs and find the first element whose bounding rect contains the
    // click pixel. Browser handles SVG transforms, scroll, and zoom; no
    // coordinate math needed. Click on whitespace = no rect contains it = no-op.
    for (const { el, step } of clickableNotesRef.current) {
      const rect = el.getBoundingClientRect()
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        seekToStep(step, 'none')
        return
      }
    }
  }

  const toggleMute = (idx: number) => {
    setVoices((prev) =>
      prev.map((info, i) => {
        if (i !== idx) return info
        const newMuted = !info.muted
        // osmd-audio-player reads voice.Volume during note scheduling
        // (getNoteVolume returns note.ParentVoiceEntry.ParentVoice.Volume).
        // Setting the Voice's Volume directly mutes that voice only — even
        // when multiple voices share a Part / staff (closed-score layout).
        info.ref.Volume = newMuted ? 0 : 1
        return { ...info, muted: newMuted }
      }),
    )
  }

  return (
    <div>
      {status === 'loading-score' && <p>Rendering score…</p>}
      {status === 'loading-audio' && <p>Loading audio engine…</p>}
      {status === 'error' && (
        <p role="alert">Failed to render score: {errorMessage}</p>
      )}

      {status === 'ready' && (
        <div
          // Fixed-position dock at the bottom-right of the viewport so transport
          // controls + voice toggles stay reachable while the user scrolls
          // through a long score.
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 100,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            boxShadow: 'var(--shadow)',
            maxWidth: 'calc(100vw - 32px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Progress bar — click to seek to that step. */}
          <div
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, totalSteps - 1)}
            aria-valuenow={currentStep}
            onClick={handleSeek}
            style={{
              cursor: totalSteps > 0 ? 'pointer' : 'default',
              padding: '6px 0',
            }}
          >
            <div
              style={{
                position: 'relative',
                height: 6,
                background: 'var(--border)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width:
                    totalSteps > 0
                      ? `${(currentStep / Math.max(1, totalSteps - 1)) * 100}%`
                      : '0%',
                  background: 'var(--accent)',
                  transition: 'width 120ms linear',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handlePlay}
              disabled={playbackState === PlaybackState.PLAYING}
            >
              ▶ Play
            </button>
            <button
              onClick={handlePause}
              disabled={playbackState !== PlaybackState.PLAYING}
            >
              ⏸ Pause
            </button>
            <button
              onClick={handleStop}
              disabled={playbackState === PlaybackState.STOPPED}
            >
              ⏹ Stop
            </button>
          </div>

          {voices.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                maxWidth: 360,
              }}
            >
              {voices.map((info, i) => (
                <label
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    opacity: info.muted ? 0.5 : 1,
                    fontSize: '0.9rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!info.muted}
                    onChange={() => toggleMute(i)}
                  />
                  <span
                    style={{
                      textDecoration: info.muted ? 'line-through' : 'none',
                    }}
                  >
                    {info.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        onClick={handleScoreClick}
        style={{
          width: '100%',
          background: '#fff',
          color: '#000',
          padding: 16,
          borderRadius: 6,
          cursor: status === 'ready' ? 'pointer' : 'default',
        }}
      />
    </div>
  )
}
