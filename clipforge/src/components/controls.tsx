"use client"

import { Button } from "./ui/button"
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Scissors, Maximize2, Merge } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import { useState, useEffect } from "react"

export function Controls() {
  const { isPlaying, setIsPlaying, playhead, setPlayhead, zoom, setZoom, clips, selectedClipId, trimClip, concatClips, autoFitZoom, exportProgress, setExportProgress } = useClipStore()
  const [isApplyingTrim, setIsApplyingTrim] = useState(false)
  const [isConcatenating, setIsConcatenating] = useState(false)
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

  const handleConcat = async () => {
    if (clips.length < 2) return

    setIsConcatenating(true)
    setExportProgress(0)
    try {
      const result = await concatClips()
      console.log("[ClipForge] Concat completed successfully:", result)
    } catch (err) {
      console.error("[ClipForge] Failed to concat clips:", err)
    } finally {
      setIsConcatenating(false)
      setTimeout(() => setExportProgress(0), 2000)
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

        {clips.length >= 2 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-12 px-6 bg-purple-600 hover:bg-purple-500 text-white border-2 border-purple-500 shadow-lg transition-all duration-200 flex items-center gap-2"
              onClick={handleConcat}
              disabled={isConcatenating}
            >
              <Merge className="h-5 w-5" />
              <span className="font-medium">{isConcatenating ? "Concatenating..." : "Concat Clips"}</span>
            </Button>
            {isConcatenating && exportProgress > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 font-mono">{Math.round(exportProgress)}%</span>
              </div>
            )}
          </div>
        )}
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
