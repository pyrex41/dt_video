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
