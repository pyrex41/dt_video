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

  // SIMPLE RULE 1: Which clip to show?
  // - If a clip is selected, show that clip
  // - Otherwise, show the topmost clip at playhead position
  const currentClip = useMemo(() => {
    if (selectedClipId) {
      const clip = clips.find(c => c.id === selectedClipId)
      console.log('[ClipForge] Showing selected clip:', clip?.name || 'NOT FOUND')
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

  // SIMPLE RULE 2: Auto-select clip when playhead moves over it
  useEffect(() => {
    console.log('[ClipForge] === Auto-select check ===')
    console.log('[ClipForge] Playhead position:', playhead)
    console.log('[ClipForge] All clips:', clips.map(c => ({
      name: c.name,
      start: c.start,
      end: c.end,
      track: c.track,
      id: c.id
    })))

    // Find clip at playhead
    const clipsAtPlayhead = clips.filter((clip) => {
      const isAt = playhead >= clip.start && playhead < clip.end
      console.log(`[ClipForge] ${clip.name}: start=${clip.start}, end=${clip.end}, playhead=${playhead}, isAt=${isAt}`)
      return isAt
    })

    console.log('[ClipForge] Clips at playhead:', clipsAtPlayhead.map(c => c.name))

    const topClipAtPlayhead = clipsAtPlayhead.sort((a, b) => a.track - b.track)[0]

    if (topClipAtPlayhead) {
      console.log('[ClipForge] Top clip at playhead:', topClipAtPlayhead.name, 'id:', topClipAtPlayhead.id)
      console.log('[ClipForge] Currently selected ID:', selectedClipId)

      if (selectedClipId !== topClipAtPlayhead.id) {
        console.log('[ClipForge] *** AUTO-SELECTING:', topClipAtPlayhead.name)
        useClipStore.getState().setSelectedClip(topClipAtPlayhead.id)
      } else {
        console.log('[ClipForge] Already selected, no change')
      }
    } else {
      console.log('[ClipForge] No clip at playhead, keeping current selection')
    }
  }, [playhead, clips]) // Don't include selectedClipId to avoid loops

  // RULE 3: Initialize Plyr once
  useEffect(() => {
    if (!videoRef.current) return

    const player = new Plyr(videoRef.current, {
      controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"],
      keyboard: { focused: true, global: true },
    })

    playerRef.current = player

    // When video plays, update playhead in timeline
    player.on("timeupdate", () => {
      if (!isUpdatingFromPlayer.current && currentClip) {
        const currentTime = player.currentTime

        // Constrain to trim bounds
        if (currentTime < currentClip.trimStart) {
          player.currentTime = currentClip.trimStart
        } else if (currentTime > currentClip.trimEnd) {
          player.currentTime = currentClip.trimStart
          player.pause()
        }

        isUpdatingFromPlayer.current = true
        setPlayhead(currentTime + currentClip.start)
        setTimeout(() => { isUpdatingFromPlayer.current = false }, 50)
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

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [])

  // RULE 4: When clip changes, load the new video
  useEffect(() => {
    if (!playerRef.current || !currentClip || !videoRef.current) return

    const player = playerRef.current
    const convertedSrc = convertFileSrc(currentClip.path)

    console.log('[ClipForge] Loading video:', currentClip.name)

    player.source = {
      type: 'video',
      sources: [{ src: convertedSrc, type: 'video/mp4' }]
    }

    player.volume = currentClip.volume ?? 1
    player.muted = currentClip.muted ?? false
  }, [currentClip?.id])

  // RULE 5: Show the frame at the playhead position
  useEffect(() => {
    if (!playerRef.current || !currentClip || !videoRef.current || isUpdatingFromPlayer.current) return

    // Calculate the position within the video file
    // playhead is absolute timeline position
    // clip.start is where the clip starts on the timeline
    // So: video time = playhead - clip.start
    let videoTime = playhead - currentClip.start

    // If playhead is outside clip bounds (when clip is selected), show first or last frame
    if (playhead < currentClip.start) {
      videoTime = 0 // Show first frame
    } else if (playhead >= currentClip.end) {
      videoTime = currentClip.end - currentClip.start - 0.01 // Show last frame
    }

    // Constrain to trim bounds
    const constrainedTime = Math.max(
      currentClip.trimStart,
      Math.min(currentClip.trimEnd, videoTime)
    )

    console.log('[ClipForge] Playhead:', playhead, 'Clip bounds:', currentClip.start, '-', currentClip.end, 'Video time:', constrainedTime)

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
  }, [playhead, currentClip?.id, currentClip?.start, currentClip?.end, currentClip?.trimStart, currentClip?.trimEnd])

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
      {currentClip ? (
        <div className="w-full h-full flex items-center justify-center p-6">
          <div className="relative bg-black rounded-lg overflow-hidden shadow-xl" style={{ width: '960px', maxWidth: '90%', aspectRatio: '16/9' }}>
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
