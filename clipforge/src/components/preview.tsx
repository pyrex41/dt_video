"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Plyr from "plyr"
import "plyr/dist/plyr.css"
import { convertFileSrc } from "@tauri-apps/api/core"
import { useClipStore } from "../store/use-clip-store"

export function Preview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const isUpdatingFromPlayer = useRef(false)
  const isUpdatingPlayState = useRef(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const { clips, playhead, isPlaying, setPlayhead, setIsPlaying, addClip, selectedClipId } = useClipStore()

  // If a clip is selected (clicked in timeline), use that clip
  // Otherwise, find clips at playhead and prioritize lowest track number (track 0 = top)
  const currentClip = useMemo(() => {
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId)
      console.log('[ClipForge] Using selected clip:', clip?.name, 'on track', clip?.track)
      return clip
    } else {
      const clipsAtPlayhead = clips.filter((clip) => playhead >= clip.start && playhead < clip.end)
      const clip = clipsAtPlayhead.sort((a, b) => a.track - b.track)[0]

      if (clipsAtPlayhead.length > 0) {
        console.log('[ClipForge] Clips at playhead', playhead, ':', clipsAtPlayhead.map(c => ({
          name: c.name,
          track: c.track,
          start: c.start,
          end: c.end
        })))
        console.log('[ClipForge] Auto-selected clip:', clip?.name, 'on track', clip?.track)
      }
      return clip
    }
  }, [selectedClipId, clips, playhead])

  // Audio settings
  const volume = currentClip?.volume ?? 1
  const muted = currentClip?.muted ?? false

  // Initialize Plyr once on mount
  useEffect(() => {
    if (!videoRef.current) return

    console.log('[ClipForge] Initializing Plyr player')
    const player = new Plyr(videoRef.current, {
      controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"],
      keyboard: { focused: true, global: true },
    })

    playerRef.current = player

    // Set up event listeners
    player.on("timeupdate", () => {
      if (!isUpdatingFromPlayer.current && currentClip) {
        const currentTime = player.currentTime

        // Constrain playback to trim bounds
        if (currentTime < currentClip.trimStart) {
          player.currentTime = currentClip.trimStart
        } else if (currentTime > currentClip.trimEnd) {
          player.currentTime = currentClip.trimStart
          player.pause()
        }

        isUpdatingFromPlayer.current = true
        const clipTime = currentTime + currentClip.start
        setPlayhead(clipTime)
        setTimeout(() => {
          isUpdatingFromPlayer.current = false
        }, 50)
      }
    })

    player.on("play", () => {
      if (!isUpdatingPlayState.current) {
        isUpdatingPlayState.current = true
        setIsPlaying(true)
        setTimeout(() => { isUpdatingPlayState.current = false }, 100)
      }
    })

    player.on("pause", () => {
      if (!isUpdatingPlayState.current) {
        isUpdatingPlayState.current = true
        setIsPlaying(false)
        setTimeout(() => { isUpdatingPlayState.current = false }, 100)
      }
    })

    player.on("error", (error: any) => {
      console.error('[ClipForge] Player error:', error)
      setIsPlaying(false)
    })

    return () => {
      console.log('[ClipForge] Cleaning up Plyr player')
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, []) // Only run once on mount

  // Update source when clip changes using Plyr's source API
  useEffect(() => {
    if (!playerRef.current || !currentClip) return

    const player = playerRef.current
    const convertedSrc = convertFileSrc(currentClip.path)
    console.log('[ClipForge] Setting Plyr source:', currentClip.path, '→', convertedSrc)

    // Use Plyr's source API to change the video
    player.source = {
      type: 'video',
      sources: [{
        src: convertedSrc,
        type: 'video/mp4'
      }]
    }

    // Apply audio settings
    player.volume = volume
    player.muted = muted

    // The playhead sync effect (below) will handle seeking once the video is ready
    console.log('[ClipForge] Source set, waiting for metadata to load...')
  }, [currentClip?.id, volume, muted]) // Re-run when clip ID or audio settings change

  // Apply audio settings when they change
  useEffect(() => {
    if (!playerRef.current) return
    const player = playerRef.current
    player.volume = volume
    player.muted = muted
  }, [volume, muted])

  // When a clip is selected, jump playhead to that clip's start if not already in bounds
  // Also clear selection if playhead moves outside the selected clip
  useEffect(() => {
    if (!selectedClipId || !currentClip) return

    // Check if this is a new selection (selectedClipId just changed)
    // vs playhead moved while a clip was already selected
  }, [selectedClipId]) // Only run when selectedClipId changes

  // Clear clip selection when playhead moves outside the selected clip's bounds
  useEffect(() => {
    const { setSelectedClip } = useClipStore.getState()

    if (!selectedClipId || !currentClip) return

    // If playhead is outside the selected clip's bounds, clear the selection
    // This allows the auto-selection logic to pick the correct clip at the playhead
    if (playhead < currentClip.start || playhead >= currentClip.end) {
      console.log('[ClipForge] Playhead moved outside selected clip bounds, clearing selection')
      setSelectedClip(null)
    }
  }, [playhead, selectedClipId, currentClip])

  // Sync playhead and play/pause state
  useEffect(() => {
    if (!playerRef.current || !currentClip || isUpdatingFromPlayer.current) return

    const player = playerRef.current
    let clipLocalTime = playhead - currentClip.start

    // Constrain to trim bounds
    clipLocalTime = Math.max(currentClip.trimStart, Math.min(currentClip.trimEnd, clipLocalTime))

    // Update video time if loaded OR wait for it to load
    const syncTime = () => {
      const timeDiff = Math.abs(player.currentTime - clipLocalTime)
      if (timeDiff > 0.1) {
        console.log('[ClipForge] Syncing playhead to:', clipLocalTime, 'for clip:', currentClip.id, 'trim:', currentClip.trimStart, '-', currentClip.trimEnd)
        player.currentTime = clipLocalTime
      }
    }

    if (videoRef.current && videoRef.current.readyState >= 2) {
      // Video is already loaded, sync immediately
      syncTime()
    } else {
      // Video not loaded yet, wait for loadedmetadata event
      const handleLoadedMetadata = () => {
        console.log('[ClipForge] Metadata loaded, syncing playhead to:', clipLocalTime)
        syncTime()
      }
      videoRef.current?.addEventListener('loadedmetadata', handleLoadedMetadata)

      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }

    // Sync play/pause state with guard against race conditions
    if (!isUpdatingPlayState.current) {
      if (isPlaying && player.paused) {
        isUpdatingPlayState.current = true
        player.play().then(() => {
          console.log('[ClipForge] Play started successfully')
          setTimeout(() => { isUpdatingPlayState.current = false }, 100)
        }).catch((err) => {
          console.error('[ClipForge] Play failed:', err)
          setIsPlaying(false)
          isUpdatingPlayState.current = false
        })
      } else if (!isPlaying && !player.paused) {
        isUpdatingPlayState.current = true
        console.log('[ClipForge] Pausing playback')
        player.pause()
        setTimeout(() => { isUpdatingPlayState.current = false }, 100)
      }
    }
  }, [playhead, isPlaying, currentClip?.id, currentClip?.trimStart, currentClip?.trimEnd, setIsPlaying])

  // Handle drop from media library
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    try {
      const data = e.dataTransfer.getData("application/json")
      if (!data) return

      const droppedClip = JSON.parse(data)

      // Find next available position at end of timeline
      const lastClipEnd = clips.length > 0
        ? Math.max(...clips.map(c => c.end))
        : 0

      // Add clip to timeline at next available position
      const newClip = {
        ...droppedClip,
        start: lastClipEnd,
        end: lastClipEnd + droppedClip.duration,
      }

      addClip(newClip)
      console.log('[ClipForge] Added clip to timeline:', newClip.name, 'at position:', lastClipEnd)
    } catch (err) {
      console.error('[ClipForge] Failed to handle drop:', err)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  return (
    <div
      className="flex flex-1 items-center justify-center bg-muted p-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {currentClip ? (
        <div className="w-full h-full flex items-center justify-center p-6">
          <div className="relative w-full h-full bg-black rounded-lg overflow-hidden shadow-xl">
            <video
              ref={videoRef}
              className="w-full h-full"
              playsInline
            />
          </div>
        </div>
      ) : (
        <div className={`text-center text-muted-foreground transition-all duration-200 ${isDragOver ? 'scale-110' : ''}`}>
          {isDragOver ? (
            <>
              <div className="text-6xl mb-4">📹</div>
              <p className="text-xl font-semibold text-blue-400">Drop video here</p>
              <p className="text-sm mt-2">Add to timeline instantly</p>
            </>
          ) : (
            <>
              <p className="text-lg">No clip selected</p>
              <p className="text-sm">Import a video to get started</p>
              <p className="text-xs mt-4 text-zinc-600">💡 Drag clips from the library to add them to the timeline</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
