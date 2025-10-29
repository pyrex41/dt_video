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
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  file_path: string
  thumbnail_path?: string
}
