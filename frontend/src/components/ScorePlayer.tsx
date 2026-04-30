import { useEffect, useRef, useState } from 'react'
import { OpenSheetMusicDisplay, type Instrument } from 'opensheetmusicdisplay'
import PlaybackEngine from 'osmd-audio-player'
import { PlaybackEvent, PlaybackState } from 'osmd-audio-player/dist/PlaybackEngine'

type Props = { url: string }
type Status = 'loading-score' | 'loading-audio' | 'ready' | 'error'
type InstrumentInfo = { name: string; muted: boolean; ref: Instrument }

export default function ScorePlayer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PlaybackEngine | null>(null)
  const [status, setStatus] = useState<Status>('loading-score')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED)
  const [instruments, setInstruments] = useState<InstrumentInfo[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let engine: PlaybackEngine | null = null

    setStatus('loading-score')
    setErrorMessage(null)
    setInstruments([])

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawComposer: false,
      // Honor system / page breaks from the MusicXML itself
      // (`<print new-system>` / `<print new-page>` elements).
      // Requires the source MusicXML to actually include them — in MuseScore,
      // enable Preferences → Import & Export → MusicXML → "Export layout"
      // before exporting.
      newSystemFromXML: true,
      newPageFromXML: true,
    })

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
          if (!cancelled) setPlaybackState(state)
        })

        await engine.loadScore(osmd)
        if (cancelled) return

        const infos: InstrumentInfo[] = engine.scoreInstruments.map((inst, i) => ({
          name: inst.Name?.trim() || `Voice ${i + 1}`,
          muted: false,
          ref: inst,
        }))
        setInstruments(infos)
        setPlaybackState(engine.state)
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
      container.innerHTML = ''
    }
  }, [url])

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

  const toggleMute = (idx: number) => {
    setInstruments((prev) =>
      prev.map((inst, i) => {
        if (i !== idx) return inst
        const newMuted = !inst.muted
        // The audio player reads voice.Volume during note scheduling (see
        // osmd-audio-player's getNoteVolume). 0 silences the voice; 1 = full.
        inst.ref.Voices.forEach((v) => {
          v.Volume = newMuted ? 0 : 1
        })
        return { ...inst, muted: newMuted }
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
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

          {instruments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ alignSelf: 'center' }}>Voices:</span>
              {instruments.map((inst, i) => (
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
                    opacity: inst.muted ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!inst.muted}
                    onChange={() => toggleMute(i)}
                  />
                  <span
                    style={{
                      textDecoration: inst.muted ? 'line-through' : 'none',
                    }}
                  >
                    {inst.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          background: '#fff',
          color: '#000',
          padding: 16,
          borderRadius: 6,
        }}
      />
    </div>
  )
}
