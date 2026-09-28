import { midi, type model } from '@coderline/alphatab'

/**
 * Per-voice muting for closed-score SATB (2 staves × 2 voices) in alphaTab.
 *
 * alphaTab mutes per track, and a track is a MusicXML <part> (a staff here),
 * so its own API can only mute SA or TB together. Each track does own two
 * MIDI channels, though: a primary one for normal notes and a secondary one
 * alphaTab only uses for bends, whammy bar, and vibrato (none of which occur
 * in choral scores). routeVoicesToChannels sends voice 1 to the primary
 * channel and every other voice to the secondary one, so each voice can be
 * muted with the synth's per-channel mute (api.player.setChannelMute).
 *
 * This overrides a private MidiFileGenerator method (checked against
 * alphaTab 1.8.4). Re-check it when upgrading. MIDI generation runs on the
 * main thread, so the override applies with or without the render worker.
 */

type GeneratorInternals = {
  _determineChannel(track: model.Track, note: model.Note): number
}

let patched = false

/** Idempotent; call once before the score's MIDI is generated. */
export function routeVoicesToChannels(): void {
  if (patched) return
  const proto = midi.MidiFileGenerator.prototype as unknown as GeneratorInternals
  proto._determineChannel = (track, note) =>
    note.beat.voice.index === 0
      ? track.playbackInfo.primaryChannel
      : track.playbackInfo.secondaryChannel
  patched = true
}

export type VoiceChannel = { track: model.Track; voiceIndex: number; channel: number }

/**
 * One entry per (track, voice slot) that has notes, in score order: each
 * track's voice 1 then its other voices (which share the secondary channel).
 */
export function listVoiceChannels(score: model.Score): VoiceChannel[] {
  const result: VoiceChannel[] = []
  for (const track of score.tracks) {
    let hasPrimary = false
    let hasSecondary = false
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          if (voice.isEmpty) continue
          if (voice.index === 0) hasPrimary = true
          else hasSecondary = true
        }
      }
    }
    if (hasPrimary) {
      result.push({ track, voiceIndex: 0, channel: track.playbackInfo.primaryChannel })
    }
    if (hasSecondary) {
      result.push({ track, voiceIndex: 1, channel: track.playbackInfo.secondaryChannel })
    }
  }
  return result
}
