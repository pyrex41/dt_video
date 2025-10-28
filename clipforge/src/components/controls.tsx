"use client"

import { Button } from "./ui/button"
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"

export function Controls() {
  const { isPlaying, setIsPlaying, playhead, setPlayhead, zoom, setZoom, clips } = useClipStore()

  const totalDuration = clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleSkipBack = () => {
    setPlayhead(Math.max(0, playhead - 5))
  }

  const handleSkipForward = () => {
    setPlayhead(Math.min(totalDuration, playhead + 5))
  }

  const handleZoomIn = () => {
    setZoom(Math.min(50, zoom * 1.5))
  }

  const handleZoomOut = () => {
    setZoom(Math.max(5, zoom / 1.5))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="hover:bg-zinc-800">
          <SkipBack className="h-5 w-5" onClick={handleSkipBack} />
        </Button>
        <Button variant="ghost" size="icon" className="hover:bg-zinc-800" onClick={handlePlayPause}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="hover:bg-zinc-800" onClick={handleSkipForward}>
          <SkipForward className="h-5 w-5" />
        </Button>
        <span className="ml-4 font-mono text-sm text-zinc-300">
          {formatTime(playhead)} / {formatTime(totalDuration)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="hover:bg-zinc-800" onClick={handleZoomOut}>
          <ZoomOut className="h-5 w-5" />
        </Button>
        <span className="min-w-[60px] text-center font-mono text-sm text-zinc-300">{Math.round(zoom * 10)}%</span>
        <Button variant="ghost" size="icon" className="hover:bg-zinc-800" onClick={handleZoomIn}>
          <ZoomIn className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
