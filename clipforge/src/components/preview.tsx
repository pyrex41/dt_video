"use client"

import { useEffect, useRef } from "react"
import Plyr from "plyr"
import { convertFileSrc } from "@tauri-apps/api/tauri"
import { useClipStore } from "../store/use-clip-store"

export function Preview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const { clips, playhead, isPlaying, setPlayhead, setIsPlaying } = useClipStore()

  const currentClip = clips.find((clip) => playhead >= clip.start && playhead < clip.end)

  useEffect(() => {
    if (!videoRef.current) return

    playerRef.current = new Plyr(videoRef.current, {
      controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"],
      keyboard: { focused: true, global: true },
    })

    const player = playerRef.current

    player.on("timeupdate", () => {
      if (currentClip) {
        const clipTime = player.currentTime + currentClip.start
        setPlayhead(clipTime)
      }
    })

    player.on("play", () => setIsPlaying(true))
    player.on("pause", () => setIsPlaying(false))

    return () => {
      player.destroy()
    }
  }, [])

  useEffect(() => {
    if (!playerRef.current || !currentClip) return

    const player = playerRef.current
    const clipLocalTime = playhead - currentClip.start

    if (Math.abs(player.currentTime - clipLocalTime) > 0.1) {
      player.currentTime = clipLocalTime
    }

    if (isPlaying && player.paused) {
      player.play()
    } else if (!isPlaying && !player.paused) {
      player.pause()
    }
  }, [playhead, isPlaying, currentClip])

  return (
    <div className="flex flex-1 items-center justify-center bg-muted p-4">
      {currentClip ? (
        <video
          ref={videoRef}
          src={convertFileSrc(currentClip.path)}
          className="max-h-full max-w-full"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No clip selected</p>
          <p className="text-sm">Import a video to get started</p>
        </div>
      )}
    </div>
  )
}
