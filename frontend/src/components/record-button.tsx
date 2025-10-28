"use client"

import { useState } from "react"
import { invoke } from "../lib/tauri-mock"
import { Button } from "./ui/button"
import { Video, Monitor } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import type { Clip } from "../types/clip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"

export function RecordButton() {
  const [isRecording, setIsRecording] = useState(false)
  const { addClip, setError, clips } = useClipStore()

  const handleWebcamRecord = async () => {
    try {
      setIsRecording(true)
      setError(null)

      const outputPath = `clips/webcam_${Date.now()}.mp4`
      const duration = 10 // 10 seconds for MVP

      await invoke<string>("record_webcam_clip", {
        output: outputPath,
        duration,
      })

      const newClip: Clip = {
        id: `clip_${Date.now()}`,
        path: outputPath,
        name: "Webcam Recording",
        start: clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0,
        end: (clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0) + duration,
        duration,
        track: 0,
        trimStart: 0,
        trimEnd: duration,
      }

      addClip(newClip)
      console.log("[v0] Webcam recording added:", newClip)
    } catch (err) {
      setError(`Failed to record webcam: ${err}`)
      console.error("[v0] Webcam recording error:", err)
    } finally {
      setIsRecording(false)
    }
  }

  const handleScreenRecord = async () => {
    try {
      setIsRecording(true)
      setError(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" } as MediaTrackConstraints,
      })

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        const arrayBuffer = await blob.arrayBuffer()
        const data = Array.from(new Uint8Array(arrayBuffer))

        const outputPath = `clips/screen_${Date.now()}.webm`

        await invoke("save_recording", {
          path: outputPath,
          data,
        })

        const duration = 10 // Approximate duration

        const newClip: Clip = {
          id: `clip_${Date.now()}`,
          path: outputPath,
          name: "Screen Recording",
          start: clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0,
          end: (clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0) + duration,
          duration,
          track: 0,
          trimStart: 0,
          trimEnd: duration,
        }

        addClip(newClip)
        console.log("[v0] Screen recording added:", newClip)
        setIsRecording(false)
      }

      recorder.start()
      setTimeout(() => {
        recorder.stop()
        stream.getTracks().forEach((track) => track.stop())
      }, 10000) // 10 seconds
    } catch (err) {
      setError(`Failed to record screen: ${err}`)
      console.error("[v0] Screen recording error:", err)
      setIsRecording(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isRecording}>
          <Video className="mr-2 h-4 w-4" />
          {isRecording ? "Recording..." : "Record"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleWebcamRecord}>
          <Video className="mr-2 h-4 w-4" />
          Webcam
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleScreenRecord}>
          <Monitor className="mr-2 h-4 w-4" />
          Screen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
