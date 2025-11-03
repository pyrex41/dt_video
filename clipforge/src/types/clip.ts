export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface Transcription {
  text: string
  segments: TranscriptionSegment[]
  vttPath?: string
  language: string
}

export interface Clip {
  id: string
  path: string
  name: string
  start: number
  end: number
  duration: number
  track: number
  trimStart: number
  trimEnd: number
  resolution?: string
  fps?: number
  thumbnail_path?: string
  file_size?: number
  codec?: string
  bit_rate?: number
  volume?: number // Volume level 0-1 (default 1)
  muted?: boolean // Mute state (default false)
  transcription?: Transcription // AI-generated transcription with captions
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  file_path: string
  thumbnail_path?: string
  file_size: number
  codec?: string
  fps?: number
  bit_rate?: number
}
