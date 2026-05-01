import { useEffect, useRef, useState } from 'react'
import {
  OpenSheetMusicDisplay,
  type Instrument,
  type Voice,
  type VoiceEntry,
} from 'opensheetmusicdisplay'
import PlaybackEngine from 'osmd-audio-player'
import { PlaybackEvent, PlaybackState } from 'osmd-audio-player/dist/PlaybackEngine'
import './ScorePlayer.css'

/**
 * One clickable note's rendered SVG element + its iteration step.
 * Built once after osmd.render(); used by handleScoreClick to do
 * pixel-exact hit testing via the browser's getBoundingClientRect.
 */
type ClickableNote = { el: SVGElement; step: number }

type Props = { url: string }
type Status = 'loading-score' | 'loading-audio' | 'ready' | 'error'
type VoiceInfo = { label: string; muted: boolean; ref: Voice; color?: string }

// Global playback mode — applies one MIDI instrument to every voice in the
// score. General MIDI program numbers; the audio player uses soundfont-player
// to load each on demand.
type PlaybackMode = 'piano' | 'choir'
const PLAYBACK_MODES: { value: PlaybackMode; label: string; midiId: number }[] = [
  { value: 'piano', label: 'Piano', midiId: 0 },   // Acoustic Grand Piano
  { value: 'choir', label: 'Choir', midiId: 52 },  // Choir Aahs
]
const PLAYBACK_MODE_STORAGE_KEY = 'sml.playbackMode'

function readStoredPlaybackMode(): PlaybackMode {
  if (typeof localStorage === 'undefined') return 'piano'
  const stored = localStorage.getItem(PLAYBACK_MODE_STORAGE_KEY)
  return PLAYBACK_MODES.some((m) => m.value === stored) ? (stored as PlaybackMode) : 'piano'
}

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

// Hardcoded SATB labels and color codes assumed for 4-voice scores. Both
// authoring shapes — closed-score (2 instruments × 2 voices) and open-score
// (4 instruments × 1 voice) — traverse to the same order. Colors fill the
// voice chip when the voice is unmuted; all four meet WCAG AA contrast with
// white text.
const SATB_VOICES = [
  { label: 'Soprano', color: '#0067c6' },
  { label: 'Alto', color: '#d5008c' },
  { label: 'Tenor', color: '#d62f00' },
  { label: 'Bajo', color: '#008000' },
] as const

/**
 * Build one mute-toggle entry per <voice> in the score.
 *
 * Most of our scores are 4-voice SATB; when that's the case, label the
 * voices Soprano / Alto / Tenor / Bajo regardless of what the MusicXML
 * happens to call its instruments. For other voice counts, fall back to
 * generic positional labels.
 */
function buildVoiceInfos(instruments: Instrument[]): VoiceInfo[] {
  const flat: { voice: Voice; instIdx: number; voiceIdx: number }[] = []
  instruments.forEach((inst, instIdx) => {
    inst.Voices.forEach((voice, voiceIdx) => {
      flat.push({ voice, instIdx, voiceIdx })
    })
  })

  if (flat.length === 4) {
    return flat.map(({ voice }, i) => ({
      label: SATB_VOICES[i].label,
      color: SATB_VOICES[i].color,
      muted: false,
      ref: voice,
    }))
  }

  // Fallback for non-4-voice scores: use the instrument name when it has a
  // single voice, otherwise generic positional labels.
  const isTwoStaffLayout = instruments.length === 2
  return flat.map(({ voice, instIdx, voiceIdx }) => {
    const inst = instruments[instIdx]
    const staffPrefix = isTwoStaffLayout
      ? instIdx === 0
        ? 'TS'
        : 'BS'
      : `S${instIdx + 1}`
    const label =
      inst.Voices.length === 1 && inst.Name?.trim()
        ? inst.Name.trim()
        : `${staffPrefix} V${voiceIdx + 1}`
    return { label, muted: false, ref: voice }
  })
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
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(readStoredPlaybackMode)

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
      // Render everything OSMD knows from the MusicXML's header — title,
      // subtitle, composer, lyricist, free-form credits — so the in-browser
      // score area visually mirrors the PDF as closely as possible.
      // ScoreDetail also shows title + composer in HTML above the score; the
      // duplication is intentional (HTML header is searchable / sortable; the
      // typeset OSMD header preserves the printed-score look).
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawLyricist: true,
      drawCredits: true,
      cursorsOptions: [
        // Deep red — high contrast against the white score-render background,
        // and a nod to the red-letter rubrics in liturgical service books.
        // `follow: true` auto-scrolls the page to keep the cursor in view
        // during normal playback. Seek-jumps still trigger an explicit
        // scrollIntoView in handleSeek for predictable centering.
        { type: 0, color: '#8b1a1a', alpha: 0.4, follow: true },
      ],
      // Honor system / page breaks from the MusicXML itself
      // (`<print new-system>` / `<print new-page>` elements).
      // Requires the source MusicXML to actually include them — in MuseScore,
      // enable Preferences → Import & Export → MusicXML → "Export layout"
      // before exporting.
      newSystemFromXML: true,
      newPageFromXML: true,
    })
    // Add some breathing room around header text (default is 1 OSMD unit each,
    // which causes title / subtitle / composer to crowd together).
    osmd.EngravingRules.TitleTopDistance = 5
    osmd.EngravingRules.TitleBottomDistance = 4
    osmd.EngravingRules.SheetMinimumDistanceBetweenTitleAndSubtitle = 3
    osmd.EngravingRules.SystemComposerDistance = 4
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

  // Apply the selected playback instrument to every voice, and persist the
  // choice. Runs whenever the score finishes loading (status -> ready) or the
  // user picks a different mode. setInstrument is async (loads the SoundFont
  // for the MIDI program on first use); subsequent switches to the same mode
  // are cached and instant.
  useEffect(() => {
    if (status !== 'ready') return
    const engine = engineRef.current
    if (!engine) return

    const midiId = PLAYBACK_MODES.find((m) => m.value === playbackMode)?.midiId ?? 0
    let cancelled = false
    ;(async () => {
      for (const inst of engine.scoreInstruments) {
        for (const voice of inst.Voices) {
          if (cancelled) return
          try {
            await engine.setInstrument(voice, midiId)
          } catch {
            // If a SoundFont fails to load (network glitch, missing program),
            // the audio player falls back to piano internally. Surface nothing
            // to the user — silent fallback is a better UX than an alarm.
          }
        }
      }
    })()

    try {
      localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, playbackMode)
    } catch {
      // localStorage may be disabled in some privacy modes; preference simply
      // won't persist across sessions, which is acceptable.
    }

    return () => {
      cancelled = true
    }
  }, [status, playbackMode])

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
        <div className="score-dock">
          {/* Progress bar — click to seek to that step. */}
          <div
            className="score-dock-progress"
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, totalSteps - 1)}
            aria-valuenow={currentStep}
            onClick={handleSeek}
            style={{ cursor: totalSteps > 0 ? 'pointer' : 'default' }}
          >
            <div className="score-dock-progress-track">
              <div
                className="score-dock-progress-fill"
                style={{
                  width:
                    totalSteps > 0
                      ? `${(currentStep / Math.max(1, totalSteps - 1)) * 100}%`
                      : '0%',
                }}
              />
            </div>
          </div>

          <div className="score-dock-row">
            <div className="score-dock-transport">
              <button
                type="button"
                className="score-dock-btn"
                onClick={handlePlay}
                disabled={playbackState === PlaybackState.PLAYING}
                aria-label="Play"
                title="Play (space)"
              >
                ▶
              </button>
              <button
                type="button"
                className="score-dock-btn"
                onClick={handlePause}
                disabled={playbackState !== PlaybackState.PLAYING}
                aria-label="Pause"
                title="Pause (space)"
              >
                ⏸
              </button>
              <button
                type="button"
                className="score-dock-btn"
                onClick={handleStop}
                disabled={playbackState === PlaybackState.STOPPED}
                aria-label="Stop"
                title="Stop"
              >
                ⏹
              </button>
            </div>

            <span className="score-dock-sound-label">Sound:</span>
            <div
              className="score-dock-segmented"
              role="group"
              aria-label="Playback sound"
            >
              {PLAYBACK_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className="score-dock-segmented-btn"
                  onClick={() => setPlaybackMode(m.value)}
                  aria-pressed={m.value === playbackMode}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {voices.length > 0 && (
            <div
              className="score-dock-voices"
              role="group"
              aria-label="Voices"
            >
              {voices.map((info, i) => (
                <button
                  key={i}
                  type="button"
                  className="score-dock-voice"
                  onClick={() => toggleMute(i)}
                  aria-pressed={!info.muted}
                  aria-label={`${info.label} ${info.muted ? '(muted)' : ''}`}
                  style={
                    info.color
                      ? ({ '--voice-color': info.color } as React.CSSProperties)
                      : undefined
                  }
                >
                  {info.label}
                </button>
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
