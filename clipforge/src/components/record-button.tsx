"use client"

import { useState } from "react"
import { invoke } from "@tauri-apps/api/tauri"
import { Button } from "./ui/button"
import { Video, Monitor } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import type { Clip } from "../types/clip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"

export function RecordButton() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingType, setRecordingType] = useState<"webcam" | "screen" | null>(null)
  const [activeRecorder, setActiveRecorder] = useState<{ recorder: MediaRecorder; stream: MediaStream } | null>(null)
  const { addClip, setError, clips } = useClipStore()

  const stopRecording = () => {
    if (activeRecorder) {
      console.log("[ClipForge] Manual stop requested")
      activeRecorder.recorder.stop()
      activeRecorder.stream.getTracks().forEach((track) => track.stop())
      setActiveRecorder(null)
    }
  }

  const handleWebcamRecord = async () => {
    try {
      console.log("[ClipForge] Starting webcam recording...")
      setIsRecording(true)
      setRecordingType("webcam")
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      console.log("[ClipForge] Got media stream:", stream.getTracks().map(t => `${t.kind}: ${t.label}`))

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          console.log("[ClipForge] Data chunk received:", e.data.size, "bytes")
          chunks.push(e.data)
        }
      }

      recorder.onstop = async () => {
        try {
          console.log("[ClipForge] Recording stopped, processing...")
          const blob = new Blob(chunks, { type: "video/webm" })
          console.log("[ClipForge] Blob size:", blob.size, "bytes")
          const arrayBuffer = await blob.arrayBuffer()
          const data = Array.from(new Uint8Array(arrayBuffer))

          const fileName = `webcam_${Date.now()}.webm`
          console.log("[ClipForge] Saving recording:", fileName)

          const outputPath = await invoke<string>("save_recording", {
            fileName: fileName,
            data: data,
            convertToMp4: true,
          })
          console.log("[ClipForge] Recording saved to:", outputPath)

          const duration = 10 // Approximate duration

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

          console.log("[ClipForge] Adding clip to store:", newClip)
          addClip(newClip)
          console.log("[ClipForge] Webcam recording complete!")
          setIsRecording(false)
          setRecordingType(null)
          setActiveRecorder(null)
        } catch (err) {
          console.error("[ClipForge] Error processing webcam recording:", err)
          setError(`Failed to process webcam recording: ${err}`)
          setIsRecording(false)
          setRecordingType(null)
          setActiveRecorder(null)
        }
      }

      // Store recorder reference for manual stop
      setActiveRecorder({ recorder, stream })

      recorder.start()
      console.log("[ClipForge] Recorder started, will record for 10 seconds...")
      setTimeout(() => {
        console.log("[ClipForge] Stopping recorder...")
        recorder.stop()
        stream.getTracks().forEach((track) => track.stop())
      }, 10000) // 10 seconds
    } catch (err) {
      setError(`Failed to record webcam: ${err}`)
      console.error("[ClipForge] Webcam recording error:", err)
      setIsRecording(false)
      setRecordingType(null)
      setActiveRecorder(null)
    }
  }

  const handleScreenRecord = async () => {
    try {
      console.log("[ClipForge] Starting screen recording...")
      setIsRecording(true)
      setRecordingType("screen")
      setError(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" } as MediaTrackConstraints,
        audio: true,
      })
      console.log("[ClipForge] Got display stream:", stream.getTracks().map(t => `${t.kind}: ${t.label}`))

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          console.log("[ClipForge] Data chunk received:", e.data.size, "bytes")
          chunks.push(e.data)
        }
      }

      recorder.onstop = async () => {
        try {
          console.log("[ClipForge] Recording stopped, processing...")
          const blob = new Blob(chunks, { type: "video/webm" })
          console.log("[ClipForge] Blob size:", blob.size, "bytes")
          const arrayBuffer = await blob.arrayBuffer()
          const data = Array.from(new Uint8Array(arrayBuffer))

          const fileName = `screen_${Date.now()}.webm`
          console.log("[ClipForge] Saving recording:", fileName)

          const outputPath = await invoke<string>("save_recording", {
            fileName: fileName,
            data: data,
            convertToMp4: true,
          })
          console.log("[ClipForge] Recording saved to:", outputPath)

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

          console.log("[ClipForge] Adding clip to store:", newClip)
          addClip(newClip)
          console.log("[ClipForge] Screen recording complete!")
          setIsRecording(false)
          setRecordingType(null)
          setActiveRecorder(null)
        } catch (err) {
          console.error("[ClipForge] Error processing screen recording:", err)
          setError(`Failed to process screen recording: ${err}`)
          setIsRecording(false)
          setRecordingType(null)
          setActiveRecorder(null)
        }
      }

      // Store recorder reference for manual stop
      setActiveRecorder({ recorder, stream })

      recorder.start()
      console.log("[ClipForge] Recorder started, will record for 10 seconds...")
      setTimeout(() => {
        console.log("[ClipForge] Stopping recorder...")
        recorder.stop()
        stream.getTracks().forEach((track) => track.stop())
      }, 10000) // 10 seconds
    } catch (err) {
      setError(`Failed to record screen: ${err}`)
      console.error("[ClipForge] Screen recording error:", err)
      setIsRecording(false)
      setRecordingType(null)
      setActiveRecorder(null)
    }
  }

  if (isRecording) {
    return (
      <Button variant="destructive" size="sm" onClick={stopRecording}>
        <Video className="mr-2 h-4 w-4" />
        Stop {recordingType === "webcam" ? "Webcam" : "Screen"} Recording
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Video className="mr-2 h-4 w-4" />
          Record
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
