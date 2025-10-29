"use client"

import { useEffect, useRef, useState } from "react"
// @ts-ignore
import Plyr from "plyr"
import "plyr/dist/plyr.css"
import { convertFileSrc } from "@tauri-apps/api/tauri"
import { useClipStore } from "../store/use-clip-store"

export function Preview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const isUpdatingFromPlayer = useRef(false)
  const isUpdatingPlayState = useRef(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const { clips, playhead, isPlaying, setPlayhead, setIsPlaying, addClip } = useClipStore()

  const currentClip = clips.find((clip) => playhead >= clip.start && playhead < clip.end)

  // Audio settings
  const volume = currentClip?.volume ?? 1
  const muted = currentClip?.muted ?? false

  // Destroy and recreate Plyr whenever clip changes
  useEffect(() => {
    if (!videoRef.current || !currentClip) return

    const video = videoRef.current

    // STEP 1: Destroy old player if it exists
    if (playerRef.current) {
      console.log('[ClipForge] Destroying old Plyr instance')
      try {
        playerRef.current.destroy()
      } catch (e) {
        console.error('[ClipForge] Error destroying player:', e)
      }
      playerRef.current = null
    }

    // STEP 2: Remove ALL orphaned Plyr DOM elements
    document.querySelectorAll('.plyr').forEach((el) => el.remove())

    // STEP 3: Set video source
    video.src = convertFileSrc(currentClip.path)

    // STEP 4: Create fresh player
    console.log('[ClipForge] Creating new Plyr instance for clip:', currentClip.id)
    const player = new Plyr(video, {
      controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"],
      keyboard: { focused: true, global: true },
    })
    playerRef.current = player

    // Set up event listeners
    player.on("timeupdate", () => {
      if (!isUpdatingFromPlayer.current) {
        // Constrain playback to trim bounds
        if (player.currentTime < currentClip.trimStart) {
          player.currentTime = currentClip.trimStart
        } else if (player.currentTime > currentClip.trimEnd) {
          player.currentTime = currentClip.trimStart
          player.pause()
        }

        isUpdatingFromPlayer.current = true
        const clipTime = player.currentTime + currentClip.start
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

    // Apply settings
    player.volume = volume
    player.muted = muted

    // Seek to position
    let clipLocalTime = playhead - currentClip.start
    clipLocalTime = Math.max(currentClip.trimStart, Math.min(currentClip.trimEnd, clipLocalTime))
    if (clipLocalTime >= 0 && clipLocalTime <= currentClip.duration) {
      player.currentTime = clipLocalTime
    }

    // Resume playback if needed
    if (isPlaying) {
      player.play()
    }

    return () => {
      // Cleanup on unmount or clip change
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [currentClip?.id]) // Recreate whenever clip changes

  // Apply audio settings when they change
  useEffect(() => {
    if (!playerRef.current) return

    const player = playerRef.current
    player.volume = volume
    player.muted = muted
  }, [volume, muted])

  useEffect(() => {
    if (!playerRef.current || !currentClip || isUpdatingFromPlayer.current) return

    const player = playerRef.current
    let clipLocalTime = playhead - currentClip.start

    // Constrain to trim bounds
    clipLocalTime = Math.max(currentClip.trimStart, Math.min(currentClip.trimEnd, clipLocalTime))

    // Update video time if loaded
    if (videoRef.current && videoRef.current.readyState >= 2) {
      // Always sync when trim positions change or when there's a significant playhead difference
      const timeDiff = Math.abs(player.currentTime - clipLocalTime)
      if (timeDiff > 0.1) {
        console.log('[ClipForge] Syncing playhead to:', clipLocalTime, 'for clip:', currentClip.id, 'trim:', currentClip.trimStart, '-', currentClip.trimEnd)
        player.currentTime = clipLocalTime
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
        player.pause()
        setTimeout(() => { isUpdatingPlayState.current = false }, 100)
      }
    }
  }, [playhead, isPlaying, currentClip?.id, currentClip?.trimStart, currentClip?.trimEnd])

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
        <div className="w-full h-full flex items-center justify-center">
          <div className="relative max-w-3xl max-h-full aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                <div className="text-white text-sm">Loading...</div>
              </div>
            )}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
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
