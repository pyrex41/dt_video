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
  const loadingClipIdRef = useRef<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [isPlyrReady, setIsPlyrReady] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const { clips, playhead, isPlaying, setPlayhead, setIsPlaying, addClip, selectedClipId, updateClip } = useClipStore()

  // SIMPLE RULE 1: Which clip to show?
  // - If a clip is selected, show that clip
  // - Otherwise, show the topmost clip at playhead position
  const currentClip = useMemo(() => {
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId)
      console.log('[ClipForge] Showing selected clip:', clip?.name || 'NOT FOUND', 'ID:', clip?.id, 'Path:', clip?.path)
      return clip
    }

    const clipsAtPlayhead = clips.filter((clip) => playhead >= clip.start && playhead < clip.end)
    const topClip = clipsAtPlayhead.sort((a, b) => a.track - b.track)[0]

    if (topClip) {
      console.log('[ClipForge] No selection, showing clip at playhead:', topClip.name)
    } else {
      console.log('[ClipForge] No clip at playhead')
    }

    return topClip
  }, [selectedClipId, clips, playhead])

  // NO AUTO-SELECTION - user must manually select clips
  // Playhead position is independent of clip selection

  // RULE 3: Initialize Plyr once
  useEffect(() => {
    if (!videoRef.current) {
      console.log('[ClipForge] Plyr init skipped - no videoRef')
      return
    }

    console.log('[ClipForge] Initializing Plyr player...')
    const player = new Plyr(videoRef.current, {
      controls: ["play", "progress", "current-time", "mute", "volume", "captions", "fullscreen"],
      keyboard: { focused: true, global: true },
      captions: { active: true, update: true },
    })

    playerRef.current = player
    setIsPlyrReady(true)
    console.log('[ClipForge] Plyr player initialized and ready!')

    // When video plays, update playhead in timeline
    player.on("timeupdate", () => {
      if (isUpdatingFromPlayer.current) return

      // CRITICAL: Get current clip from store, not from closure!
      // The closure captures the clip value at handler registration time
      const state = useClipStore.getState()
      const activeClip = state.selectedClipId
        ? state.clips.find(c => c.id === state.selectedClipId)
        : state.clips.filter(c => state.playhead >= c.start && state.playhead < c.end)
            .sort((a, b) => a.track - b.track)[0]

      if (!activeClip) return

      const currentTime = player.currentTime

      // Constrain to trim bounds
      if (currentTime < activeClip.trimStart) {
        player.currentTime = activeClip.trimStart
      } else if (currentTime > activeClip.trimEnd) {
        player.currentTime = activeClip.trimStart
        player.pause()
      }

      // CRITICAL: currentTime is the video file timestamp
      // The playhead position on the timeline = video time + clip start offset
      // BUT we need to account for trimStart offset as well
      // Timeline position = clip.start + (video_time - trimStart)
      const timelinePosition = activeClip.start + (currentTime - activeClip.trimStart)

      console.log('[ClipForge] 🎬 TIMEUPDATE: video_time=', currentTime, 'clip.start=', activeClip.start, 'trimStart=', activeClip.trimStart, '→ timeline_pos=', timelinePosition)

      isUpdatingFromPlayer.current = true
      setPlayhead(timelinePosition)
      setTimeout(() => { isUpdatingFromPlayer.current = false }, 50)
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

    // Persist volume/mute changes to the store
    player.on("volumechange", () => {
      const state = useClipStore.getState()
      const activeClip = state.selectedClipId
        ? state.clips.find(c => c.id === state.selectedClipId)
        : state.clips.filter(c => state.playhead >= c.start && state.playhead < c.end)
            .sort((a, b) => a.track - b.track)[0]

      if (activeClip) {
        console.log('[ClipForge] 🔊 Volume changed:', { volume: player.volume, muted: player.muted })
        updateClip(activeClip.id, {
          volume: player.volume,
          muted: player.muted
        })
      }
    })

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [])

  // RULE 4: When clip changes, load the new video
  useEffect(() => {
    console.log('[Preview] 🎬 Video loading effect triggered. playerRef:', !!playerRef.current, 'currentClip:', !!currentClip, 'videoRef:', !!videoRef.current)

    if (!playerRef.current || !currentClip || !videoRef.current) {
      console.log('[Preview] ⏭️  Video loading skipped - missing refs or clip')
      setIsVideoLoaded(false)
      setIsVideoLoading(false)
      setVideoError(null)
      return
    }

    // Abort if we're already loading this clip
    if (loadingClipIdRef.current === currentClip.id) {
      console.log('[Preview] ⏭️  Already loading this clip, skipping:', currentClip.name)
      return
    }

    console.log('[Preview] 📂 Loading new video:', currentClip.name, 'ID:', currentClip.id)
    console.log('[Preview] 📍 File path:', currentClip.path)

    // Mark this clip as loading
    loadingClipIdRef.current = currentClip.id
    setIsVideoLoaded(false)
    setIsVideoLoading(true)
    setVideoError(null)

    const player = playerRef.current
    const convertedSrc = convertFileSrc(currentClip.path)

    console.log('[Preview] 🔗 Converted source URL:', convertedSrc)

    // Add error handler for video loading
    const handleVideoError = (e: Event) => {
      // Only handle error if this is still the clip we're loading
      if (loadingClipIdRef.current !== currentClip.id) {
        console.log('[Preview] ⏭️  Ignoring error for stale clip load')
        return
      }

      console.error('[Preview] ❌ Video load error for:', currentClip.name)
      const videoEl = videoRef.current
      if (videoEl?.error) {
        const errorMessages = [
          'Unknown error',
          'Video loading aborted',
          'Network error loading video',
          'Video format not supported',
          'Video source not found'
        ]
        const errorMsg = errorMessages[videoEl.error.code] || errorMessages[0]
        console.error('[Preview] 💥 Error details:', {
          code: videoEl.error.code,
          message: videoEl.error.message,
          networkState: videoEl.networkState,
          readyState: videoEl.readyState,
          src: videoEl.src
        })
        setVideoError(`${errorMsg}: ${currentClip.name}`)
      } else {
        setVideoError(`Failed to load video: ${currentClip.name}`)
      }
      setIsVideoLoading(false)
      setIsVideoLoaded(false)
      loadingClipIdRef.current = null
    }

    // Seek to the correct position once video is loaded
    const handleLoadedMetadata = () => {
      // Only handle if this is still the clip we're loading
      if (loadingClipIdRef.current !== currentClip.id) {
        console.log('[Preview] ⏭️  Ignoring metadata for stale clip load')
        return
      }

      if (!playerRef.current || !currentClip) return

      console.log('[Preview] ✅ Video metadata loaded successfully!')
      setIsVideoLoaded(true)
      setIsVideoLoading(false)
      setVideoError(null)
      loadingClipIdRef.current = null

      // Get current playhead position from store (not from closure)
      const state = useClipStore.getState()
      const currentPlayhead = state.playhead

      // Calculate initial video position based on playhead
      let timelineOffset = currentPlayhead - currentClip.start

      if (currentPlayhead < currentClip.start) {
        timelineOffset = 0
      } else if (currentPlayhead >= currentClip.end) {
        timelineOffset = currentClip.end - currentClip.start
      }

      const videoTime = currentClip.trimStart + timelineOffset
      const constrainedTime = Math.max(
        currentClip.trimStart,
        Math.min(currentClip.trimEnd, videoTime)
      )

      console.log('[Preview] 🎯 Initial seek to:', constrainedTime, 'seconds (playhead:', currentPlayhead, ')')
      playerRef.current.currentTime = constrainedTime
    }

    // Add listeners BEFORE setting source
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
      videoRef.current.addEventListener('error', handleVideoError)
    }

    // Now set the source with optional captions
    const tracks = currentClip.transcription?.vttPath ? [{
      kind: 'captions' as const,
      label: 'English',
      srclang: 'en',
      src: convertFileSrc(currentClip.transcription.vttPath),
      default: true
    }] : []

    player.source = {
      type: 'video',
      sources: [{ src: convertedSrc, type: 'video/mp4' }],
      tracks
    }

    if (tracks.length > 0) {
      console.log('[ClipForge] Loading captions from:', currentClip.transcription?.vttPath)
    }

    player.volume = currentClip.volume ?? 1
    player.muted = currentClip.muted ?? false

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata)
        videoRef.current.removeEventListener('error', handleVideoError)
      }
    }
  }, [currentClip?.id, currentClip?.path])

  // RULE 5: Show the frame at the playhead position
  useEffect(() => {
    if (!playerRef.current || !currentClip || !videoRef.current || isUpdatingFromPlayer.current || !isVideoLoaded) return

    // Calculate the position within the video file
    // playhead = absolute timeline position (e.g., 140s)
    // clip.start = where clip starts on timeline (e.g., 120s)
    // clip.trimStart = where the visible part starts in the video file (e.g., 5s)
    //
    // Timeline offset from clip start: playhead - clip.start = 140 - 120 = 20s
    // Actual video file position: trimStart + timeline_offset = 5 + 20 = 25s

    let timelineOffset = playhead - currentClip.start

    // If playhead is outside clip bounds (when clip is selected), clamp to clip edges
    if (playhead < currentClip.start) {
      timelineOffset = 0 // Start of clip on timeline
    } else if (playhead >= currentClip.end) {
      timelineOffset = currentClip.end - currentClip.start // End of clip on timeline
    }

    // Convert timeline offset to actual video file position
    const videoTime = currentClip.trimStart + timelineOffset

    // Constrain to trim bounds (should already be within bounds, but safety check)
    const constrainedTime = Math.max(
      currentClip.trimStart,
      Math.min(currentClip.trimEnd, videoTime)
    )

    console.log('[ClipForge] Playhead:', playhead, 'Clip:', currentClip.start, '-', currentClip.end, 'Trim:', currentClip.trimStart, '-', currentClip.trimEnd, 'Timeline offset:', timelineOffset, 'Video time:', constrainedTime)

    // Wait for video to be ready
    const seekWhenReady = () => {
      if (!videoRef.current || !playerRef.current) return

      if (videoRef.current.readyState >= 2) {
        const diff = Math.abs(playerRef.current.currentTime - constrainedTime)
        if (diff > 0.1) {
          console.log('[ClipForge] Seeking to:', constrainedTime)
          playerRef.current.currentTime = constrainedTime
        }
      } else {
        // Not ready yet, try again soon
        setTimeout(seekWhenReady, 50)
      }
    }

    seekWhenReady()
  }, [playhead, currentClip?.id, currentClip?.start, currentClip?.end, currentClip?.trimStart, currentClip?.trimEnd, isVideoLoaded])

  // RULE 6: Sync play/pause
  useEffect(() => {
    if (!playerRef.current || isUpdatingPlayState.current) return

    const player = playerRef.current

    if (isPlaying && player.paused) {
      isUpdatingPlayState.current = true
      player.play()
        .then(() => setTimeout(() => { isUpdatingPlayState.current = false }, 100))
        .catch(() => {
          setIsPlaying(false)
          isUpdatingPlayState.current = false
        })
    } else if (!isPlaying && !player.paused) {
      isUpdatingPlayState.current = true
      player.pause()
      setTimeout(() => { isUpdatingPlayState.current = false }, 100)
    }
  }, [isPlaying, setIsPlaying])

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    try {
      const data = e.dataTransfer.getData("application/json")
      if (!data) return

      const droppedClip = JSON.parse(data)
      const lastClipEnd = clips.length > 0 ? Math.max(...clips.map(c => c.end)) : 0

      addClip({
        ...droppedClip,
        start: lastClipEnd,
        end: lastClipEnd + droppedClip.duration,
      })
    } catch (err) {
      console.error('[ClipForge] Failed to handle drop:', err)
    }
  }

  return (
    <div
      className="flex flex-1 items-center justify-center bg-muted p-4"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setIsDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
    >
      {/* Always render video element so Plyr can initialize */}
      <div className="w-full h-full flex items-center justify-center px-8 py-6">
        <div
          className="relative bg-black rounded-lg overflow-hidden shadow-xl max-w-full max-h-full"
          style={{
            aspectRatio: '16/9',
            width: 'min(95%, calc(100vh * 16/9))',
            height: 'auto',
            display: currentClip ? 'block' : 'none'
          }}
        >
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
          />
        </div>
      </div>

      {/* Overlay message when no clip */}
      {!currentClip && (
        <div className={`absolute text-center text-muted-foreground transition-all duration-200 ${isDragOver ? 'scale-110' : ''}`}>
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

      {/* Loading overlay */}
      {currentClip && isVideoLoading && (
        <div className="absolute text-center text-white bg-black/60 backdrop-blur-sm rounded-lg px-6 py-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3" />
          <p className="text-sm font-medium">Loading video...</p>
          <p className="text-xs text-zinc-400 mt-1">{currentClip.name}</p>
        </div>
      )}

      {/* Error overlay */}
      {currentClip && videoError && (
        <div className="absolute text-center bg-red-900/80 backdrop-blur-sm border-2 border-red-600 rounded-lg px-6 py-4 max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-sm font-semibold text-white mb-2">Video Load Failed</p>
          <p className="text-xs text-red-200">{videoError}</p>
          <button
            onClick={() => {
              console.log('[Preview] 🔄 Retrying video load')
              setVideoError(null)
              loadingClipIdRef.current = null
              setIsVideoLoaded(false)
              setIsVideoLoading(false)
            }}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
