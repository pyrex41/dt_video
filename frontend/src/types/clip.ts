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
}

export interface VideoMetadata {
  duration: number
  resolution: string
  fps: number
}
