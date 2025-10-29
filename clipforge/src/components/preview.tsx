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
  const { clips, playhead, isPlaying, setPlayhead, setIsPlaying } = useClipStore()

  const currentClip = clips.find((clip) => playhead >= clip.start && playhead < clip.end)

  // Audio settings
  const volume = currentClip?.volume ?? 1
  const muted = currentClip?.muted ?? false

  useEffect(() => {
    if (!videoRef.current || !currentClip) return

    const video = videoRef.current
    setIsLoading(true)

    // Completely reset any existing player and media BEFORE loading new video
    if (playerRef.current) {
      const oldPlayer = playerRef.current
      console.log('[ClipForge] Destroying old player instance')
      try {
        // Stop media playback completely
        // @ts-ignore
        if (oldPlayer.media) {
          // @ts-ignore
          oldPlayer.media.pause()
          // @ts-ignore
          oldPlayer.media.currentTime = 0
          // @ts-ignore
          oldPlayer.media.src = ''
          // @ts-ignore
          oldPlayer.media.load() // Force reload to clear buffer
        }
        oldPlayer.destroy()
        playerRef.current = null
      } catch (err) {
        console.error('[ClipForge] Error destroying old player:', err)
        playerRef.current = null
      }
    }

    // Clean up any orphaned Plyr DOM elements (from HMR or incomplete cleanups)
    const container = video.parentElement
    if (container) {
      const plyrContainers = container.querySelectorAll('.plyr')
      plyrContainers.forEach((plyrEl, index) => {
        if (index > 0) { // Keep only the first one (current video)
          console.log('[ClipForge] Removing orphaned Plyr container')
          plyrEl.remove()
        }
      })
    }

    // Wait for video to load before initializing Plyr
    const handleLoadedData = () => {
      console.log('[ClipForge] Video loaded for clip:', currentClip.id)
      setIsLoading(false)

      // Clear loading timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

      playerRef.current = new Plyr(video, {
        controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"],
        keyboard: { focused: true, global: true },
      })

      const player = playerRef.current

      // Apply audio settings
      player.volume = volume
      player.muted = muted

      player.on("timeupdate", () => {
        if (currentClip && !isUpdatingFromPlayer.current) {
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

      // Sync play state from player events (with debounce to prevent race conditions)
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

      // Handle play errors (buffering, network issues, etc.)
      player.on("error", (error: any) => {
        console.error('[ClipForge] Player error:', error)
        setIsPlaying(false)
      })

       // Seek to correct position after loading, respecting trim bounds
       let clipLocalTime = playhead - currentClip.start
       // Constrain to trim bounds
       clipLocalTime = Math.max(currentClip.trimStart, Math.min(currentClip.trimEnd, clipLocalTime))
       console.log('[ClipForge] Seeking to position:', clipLocalTime, 'in clip:', currentClip.id, 'playhead:', playhead, 'clipStart:', currentClip.start, 'trim:', currentClip.trimStart, '-', currentClip.trimEnd, 'duration:', currentClip.duration)
       if (clipLocalTime >= 0 && clipLocalTime <= currentClip.duration) {
         player.currentTime = clipLocalTime
         console.log('[ClipForge] Set player.currentTime to:', clipLocalTime)
       }

      // Resume playback if it was playing
      if (isPlaying) {
        console.log('[ClipForge] Resuming playback for clip:', currentClip.id)
        isUpdatingPlayState.current = true
        player.play().then(() => {
          setTimeout(() => { isUpdatingPlayState.current = false }, 100)
        }).catch((err) => {
          console.error('[ClipForge] Failed to resume playback:', err)
          setIsPlaying(false)
          isUpdatingPlayState.current = false
        })
      }
    }

    // Add timeout protection (10 seconds)
    loadingTimeoutRef.current = setTimeout(() => {
      console.warn('[ClipForge] Video loading timeout for clip:', currentClip.id)
      setIsLoading(false)
      // Force initialization even if loadeddata didn't fire
      handleLoadedData()
    }, 10000)

    const handleError = () => {
      console.error('[ClipForge] Video loading error for clip:', currentClip.id)
      setIsLoading(false)
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('error', handleError)

      // Clear loading timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

      // Clean up player on unmount
      if (playerRef.current) {
        const player = playerRef.current
        console.log('[ClipForge] Cleanup: destroying player')
        try {
          // Complete media reset before destruction
          // @ts-ignore
          if (player.media) {
            // @ts-ignore
            player.media.pause()
            // @ts-ignore
            player.media.currentTime = 0
            // @ts-ignore
            player.media.src = ''
            // @ts-ignore
            player.media.load() // Force clear
          }
          player.destroy()
          playerRef.current = null
        } catch (err) {
          console.error('[ClipForge] Error during cleanup:', err)
          playerRef.current = null
        }
      }
    }
  }, [currentClip, volume, muted])

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

  return (
    <div className="flex flex-1 items-center justify-center bg-muted p-4">
      {currentClip ? (
        <div key={currentClip.path} className="w-full h-full flex items-center justify-center">
          <div className="relative max-w-3xl max-h-full aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                <div className="text-white text-sm">Loading...</div>
              </div>
            )}
            <video
              key={`${currentClip.id}-${currentClip.path}-${currentClip.duration}`}
              ref={videoRef}
              src={convertFileSrc(currentClip.path)}
              className="w-full h-full object-contain"
              playsInline
            />
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No clip selected</p>
          <p className="text-sm">Import a video to get started</p>
        </div>
      )}
    </div>
  )
}
