"use client"

import { Button } from "./ui/button"
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Scissors, Maximize2, Copy, Clipboard } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import { useState, useEffect } from "react"

export function Controls() {
  const { isPlaying, setIsPlaying, playhead, setPlayhead, zoom, setZoom, clips, selectedClipId, trimClip, autoFitZoom, copyClip, pasteClip, copiedClip } = useClipStore()
  const [isApplyingTrim, setIsApplyingTrim] = useState(false)
  const [timelineWidth, setTimelineWidth] = useState(800)

  const selectedClip = clips.find(c => c.id === selectedClipId)
  const hasTrimmed = selectedClip && (selectedClip.trimStart > 0 || selectedClip.trimEnd < selectedClip.duration)

  const totalDuration = clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0

  // Get timeline width for auto-fit calculation
  useEffect(() => {
    const updateWidth = () => {
      const timeline = document.querySelector('canvas')
      if (timeline) {
        setTimelineWidth(timeline.width)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

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

  const handleFitZoom = () => {
    autoFitZoom(timelineWidth)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleApplyTrim = async () => {
    if (!selectedClip) return

    setIsApplyingTrim(true)
    try {
      await trimClip(selectedClip.id, selectedClip.trimStart, selectedClip.trimEnd)
      console.log("[ClipForge] Trim applied successfully")
    } catch (err) {
      console.error("[ClipForge] Failed to apply trim:", err)
    } finally {
      setIsApplyingTrim(false)
    }
  }



  return (
    <div className="flex items-center justify-between border-t border-zinc-700 bg-zinc-900 px-6 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 hover:bg-zinc-800 text-white border border-zinc-600"
            onClick={handleSkipBack}
          >
            <SkipBack className="h-6 w-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 hover:bg-blue-600 bg-blue-600 text-white border border-blue-500 shadow-md"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 hover:bg-zinc-800 text-white border border-zinc-600"
            onClick={handleSkipForward}
          >
            <SkipForward className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="flex items-center gap-6 px-6 py-2 bg-zinc-800 rounded-lg border border-zinc-600">
          <span className="font-mono text-lg text-zinc-200 font-medium">
            {formatTime(playhead)}
          </span>
          <span className="text-zinc-400">/</span>
          <span className="font-mono text-lg text-zinc-200 font-medium">
            {formatTime(totalDuration)}
          </span>
        </div>

        {hasTrimmed && (
          <Button
            variant="ghost"
            className="h-12 px-6 bg-green-600 hover:bg-green-500 text-white border-2 border-green-500 shadow-lg transition-all duration-200 flex items-center gap-2"
            onClick={handleApplyTrim}
            disabled={isApplyingTrim}
          >
            <Scissors className="h-5 w-5" />
            <span className="font-medium">{isApplyingTrim ? "Applying..." : "Apply Trim"}</span>
          </Button>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 hover:bg-zinc-800 text-white border border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => selectedClipId && copyClip(selectedClipId)}
            disabled={!selectedClipId}
            title={selectedClipId ? "Copy clip (Cmd/Ctrl+C)" : "Select a clip to copy"}
          >
            <Copy className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 hover:bg-zinc-800 text-white border border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => pasteClip()}
            disabled={!copiedClip}
            title={copiedClip ? "Paste clip (Cmd/Ctrl+V)" : "Copy a clip first"}
          >
            <Clipboard className="h-5 w-5" />
          </Button>
        </div>

      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg border border-zinc-600">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-zinc-700 text-white"
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="w-16 text-center font-mono text-sm text-zinc-300">
            {Math.round(zoom)}x
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-zinc-700 text-white"
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <div className="h-6 w-px bg-zinc-600 mx-2" />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-blue-700 bg-blue-600 text-white"
            onClick={handleFitZoom}
            title="Fit to timeline"
          >
            <Maximize2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
