"use client"

import { useState, useRef, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "./ui/button"
import { Video, Monitor, Circle, Mic, MicOff, PictureInPicture, Loader2, Settings } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import type { Clip } from "../types/clip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"

export function RecordButton() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingType, setRecordingType] = useState<"webcam" | "screen" | "pip" | null>(null)
  const [activeRecorder, setActiveRecorder] = useState<{
    recorder: MediaRecorder;
    stream: MediaStream;
    additionalStreams?: MediaStream[]; // For PiP mode and screen recording with mic
    audioContext?: AudioContext; // For audio mixing
  } | null>(null)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string | null>(null)
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const startTimeRef = useRef<number>(0) // Use ref to avoid closure issues
  const [startTime, setStartTime] = useState<number>(0) // Keep for UI display
  const { addClip, setError, clips } = useClipStore()

  // Enumerate audio devices on mount
  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true })
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(device => device.kind === 'audioinput')
        console.log("[ClipForge] Found audio devices:", audioInputs.map(d => `${d.label} (${d.deviceId})`))
        setAudioDevices(audioInputs)

        // Select default device if none selected
        if (!selectedAudioDevice && audioInputs.length > 0) {
          const defaultDevice = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0]
          setSelectedAudioDevice(defaultDevice.deviceId)
          console.log("[ClipForge] Selected default audio device:", defaultDevice.label)
        }
      } catch (err) {
        console.error("[ClipForge] Failed to enumerate audio devices:", err)
      }
    }
    enumerateDevices()
  }, [])

  const stopRecording = () => {
    if (activeRecorder) {
      console.log("[ClipForge] Manual stop requested")
      try {
        // Stop the recorder first
        if (activeRecorder.recorder.state !== 'inactive') {
          activeRecorder.recorder.stop()
        }

        // Stop all tracks in the main stream
        activeRecorder.stream.getTracks().forEach((track) => {
          console.log("[ClipForge] Stopping track:", track.kind, track.label)
          track.stop()
        })

        // Stop additional streams (PiP mode and screen recording with mic)
        if (activeRecorder.additionalStreams) {
          activeRecorder.additionalStreams.forEach((stream) => {
            stream.getTracks().forEach((track) => {
              console.log("[ClipForge] Stopping additional track:", track.kind, track.label)
              track.stop()
            })
          })
        }

        // Close audio context if used
        if (activeRecorder.audioContext) {
          activeRecorder.audioContext.close()
          console.log("[ClipForge] Audio context closed")
        }

        console.log("[ClipForge] All tracks stopped successfully")
      } catch (err) {
        console.error("[ClipForge] Error stopping recording:", err)
      }

      setActiveRecorder(null)
      setIsRecording(false)
      setRecordingType(null)
    } else {
      console.warn("[ClipForge] Stop requested but no active recorder found")
    }
  }

  const toggleAudio = () => {
    if (activeRecorder && activeRecorder.stream) {
      const audioTrack = activeRecorder.stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        console.log("[ClipForge] Audio", audioTrack.enabled ? "enabled" : "muted")
      }
    }
  }

  const handleWebcamRecord = async () => {
    try {
      console.log("[ClipForge] Starting webcam recording...")
      setIsRecording(true)
      setRecordingType("webcam")
      setError(null)

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }

      // Use selected audio device if available
      if (selectedAudioDevice && selectedAudioDevice !== 'default') {
        audioConstraints.deviceId = { exact: selectedAudioDevice }
        console.log("[ClipForge] Using audio device:", selectedAudioDevice)
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: audioConstraints
      })
      console.log("[ClipForge] Got media stream:", stream.getTracks().map(t => `${t.kind}: ${t.label}`))

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
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
          console.log("[ClipForge] Webcam recording stopped, processing...")
          setIsRecording(false)
          setIsProcessing(true)

          // Validate we have data
          if (chunks.length === 0) {
            throw new Error("No video data was recorded")
          }

          const blob = new Blob(chunks, { type: "video/webm" })
          console.log("[ClipForge] Blob size:", blob.size, "bytes")

          // Validate blob size
          if (blob.size === 0) {
            throw new Error("Recorded video is empty")
          }

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

          // Calculate actual duration with validation
          const now = Date.now()
          const recordingStartTime = startTimeRef.current
          const elapsed = now - recordingStartTime
          const duration = Math.max(elapsed / 1000, 1) // At least 1 second
          console.log("[ClipForge] Webcam duration calculation:", {
            now,
            recordingStartTime,
            elapsed,
            duration,
            durationSeconds: duration
          })

          // Validate duration is reasonable (max 24 hours)
          if (duration > 86400) {
            throw new Error("Recording duration is invalid")
          }

          const lastClipEnd = clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0

          const newClip: Clip = {
            id: `clip_${Date.now()}`,
            path: outputPath,
            name: "Webcam Recording",
            start: lastClipEnd,
            end: lastClipEnd + duration,
            duration,
            track: 0,
            trimStart: 0,
            trimEnd: duration,
            volume: 1,
            muted: false,
          }

          // Validate the clip before adding
          console.log("[ClipForge] Validating clip:", {
            duration: newClip.duration,
            start: newClip.start,
            end: newClip.end,
            trimStart: newClip.trimStart,
            trimEnd: newClip.trimEnd,
            checks: {
              durationPositive: newClip.duration > 0,
              durationReasonable: newClip.duration <= 86400,
              endAfterStart: newClip.end > newClip.start,
              trimEndAfterStart: newClip.trimEnd > newClip.trimStart
            }
          })

          if (
            newClip.duration > 0 &&
            newClip.duration <= 86400 &&
            newClip.end > newClip.start &&
            newClip.trimEnd > newClip.trimStart
          ) {
            // Generate thumbnail BEFORE adding clip
            let thumbnailPath: string | undefined
            try {
              console.log("[ClipForge] Generating thumbnail for:", outputPath)
              thumbnailPath = await invoke<string>("generate_thumbnail", {
                filePath: outputPath,
                duration: duration,
                width: 160,
                height: 90
              })
              console.log("[ClipForge] Thumbnail generated:", thumbnailPath)
            } catch (thumbErr) {
              console.warn("[ClipForge] Failed to generate thumbnail:", thumbErr)
              // Don't fail the whole recording if thumbnail generation fails
            }

            // Add thumbnail_path to the clip
            newClip.thumbnail_path = thumbnailPath

            console.log("[ClipForge] Adding clip to store:", newClip)
            addClip(newClip)
            console.log("[ClipForge] Webcam recording complete!")
          } else {
            throw new Error(`Generated clip has invalid values - duration: ${newClip.duration}, start: ${newClip.start}, end: ${newClip.end}, trimStart: ${newClip.trimStart}, trimEnd: ${newClip.trimEnd}`)
          }

          setIsProcessing(false)
          setRecordingType(null)
          setActiveRecorder(null)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          console.error("[ClipForge] Error processing webcam recording:", err)
          setError(`Failed to process webcam recording: ${errorMessage}`)
          setIsRecording(false)
          setIsProcessing(false)
          setRecordingType(null)
          setActiveRecorder(null)
        }
      }

      // Store recorder reference for manual stop
      setActiveRecorder({ recorder, stream })
      const now = Date.now()
      startTimeRef.current = now
      setStartTime(now)

      recorder.start()
      console.log("[ClipForge] Webcam recorder started at:", now)
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

      // Get screen stream (with system audio if available)
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        } as MediaTrackConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      console.log("[ClipForge] Got display stream:", screenStream.getTracks().map(t => `${t.kind}: ${t.label}`))

      // Get microphone audio separately
      let micStream: MediaStream | null = null
      try {
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }

        if (selectedAudioDevice && selectedAudioDevice !== 'default') {
          audioConstraints.deviceId = { exact: selectedAudioDevice }
        }

        micStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints
        })
        console.log("[ClipForge] Got microphone stream:", micStream.getAudioTracks().map(t => t.label))
      } catch (micErr) {
        console.warn("[ClipForge] Could not get microphone audio:", micErr)
        // Continue without mic audio
      }

      // Combine audio tracks if we have both system and mic audio
      const stream = new MediaStream()

      // Add video track from screen
      const videoTrack = screenStream.getVideoTracks()[0]
      if (videoTrack) {
        stream.addTrack(videoTrack)
      }

      // Mix audio tracks
      const audioContext = new AudioContext()
      const destination = audioContext.createMediaStreamDestination()

      // Add system audio if available
      const systemAudioTrack = screenStream.getAudioTracks()[0]
      if (systemAudioTrack) {
        const systemSource = audioContext.createMediaStreamSource(new MediaStream([systemAudioTrack]))
        systemSource.connect(destination)
        console.log("[ClipForge] Added system audio to mix")
      }

      // Add microphone audio if available
      if (micStream) {
        const micAudioTrack = micStream.getAudioTracks()[0]
        if (micAudioTrack) {
          const micSource = audioContext.createMediaStreamSource(new MediaStream([micAudioTrack]))
          micSource.connect(destination)
          console.log("[ClipForge] Added microphone audio to mix")
        }
      }

      // Add mixed audio track to the stream
      const mixedAudioTrack = destination.stream.getAudioTracks()[0]
      if (mixedAudioTrack) {
        stream.addTrack(mixedAudioTrack)
        console.log("[ClipForge] Added mixed audio track")
      }

      console.log("[ClipForge] Final stream tracks:", stream.getTracks().map(t => `${t.kind}: ${t.label}`))

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
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
          console.log("[ClipForge] Screen recording stopped, processing...")
          setIsRecording(false)
          setIsProcessing(true)

          // Validate we have data
          if (chunks.length === 0) {
            throw new Error("No video data was recorded")
          }

          const blob = new Blob(chunks, { type: "video/webm" })
          console.log("[ClipForge] Blob size:", blob.size, "bytes")

          // Validate blob size
          if (blob.size === 0) {
            throw new Error("Recorded video is empty")
          }

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

          // Calculate actual duration with validation
          const now = Date.now()
          const recordingStartTime = startTimeRef.current
          const elapsed = now - recordingStartTime
          const duration = Math.max(elapsed / 1000, 1) // At least 1 second
          console.log("[ClipForge] Screen duration calculation:", {
            now,
            recordingStartTime,
            elapsed,
            duration,
            durationSeconds: duration
          })

          // Validate duration is reasonable (max 24 hours)
          if (duration > 86400) {
            throw new Error("Recording duration is invalid")
          }

          const lastClipEnd = clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0

          const newClip: Clip = {
            id: `clip_${Date.now()}`,
            path: outputPath,
            name: "Screen Recording",
            start: lastClipEnd,
            end: lastClipEnd + duration,
            duration,
            track: 0,
            trimStart: 0,
            trimEnd: duration,
            volume: 1,
            muted: false,
          }

          // Validate the clip before adding
          console.log("[ClipForge] Validating screen clip:", {
            duration: newClip.duration,
            start: newClip.start,
            end: newClip.end,
            trimStart: newClip.trimStart,
            trimEnd: newClip.trimEnd,
            checks: {
              durationPositive: newClip.duration > 0,
              durationReasonable: newClip.duration <= 86400,
              endAfterStart: newClip.end > newClip.start,
              trimEndAfterStart: newClip.trimEnd > newClip.trimStart
            }
          })

          if (
            newClip.duration > 0 &&
            newClip.duration <= 86400 &&
            newClip.end > newClip.start &&
            newClip.trimEnd > newClip.trimStart
          ) {
            // Generate thumbnail BEFORE adding clip
            let thumbnailPath: string | undefined
            try {
              console.log("[ClipForge] Generating thumbnail for:", outputPath)
              thumbnailPath = await invoke<string>("generate_thumbnail", {
                filePath: outputPath,
                duration: duration,
                width: 160,
                height: 90
              })
              console.log("[ClipForge] Thumbnail generated:", thumbnailPath)
            } catch (thumbErr) {
              console.warn("[ClipForge] Failed to generate thumbnail:", thumbErr)
              // Don't fail the whole recording if thumbnail generation fails
            }

            // Add thumbnail_path to the clip
            newClip.thumbnail_path = thumbnailPath

            console.log("[ClipForge] Adding clip to store:", newClip)
            addClip(newClip)
            console.log("[ClipForge] Screen recording complete!")
          } else {
            throw new Error(`Generated screen clip has invalid values - duration: ${newClip.duration}, start: ${newClip.start}, end: ${newClip.end}, trimStart: ${newClip.trimStart}, trimEnd: ${newClip.trimEnd}`)
          }

          setIsProcessing(false)
          setRecordingType(null)
          setActiveRecorder(null)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          console.error("[ClipForge] Error processing screen recording:", err)
          setError(`Failed to process screen recording: ${errorMessage}`)
          setIsRecording(false)
          setIsProcessing(false)
          setRecordingType(null)
          setActiveRecorder(null)
        }
      }

      // Store recorder reference for manual stop (including source streams and audio context)
      const additionalStreams = [screenStream]
      if (micStream) {
        additionalStreams.push(micStream)
      }
      setActiveRecorder({
        recorder,
        stream,
        additionalStreams,
        audioContext
      })
      const now = Date.now()
      startTimeRef.current = now
      setStartTime(now)

      recorder.start()
      console.log("[ClipForge] Screen recorder started at:", now)
    } catch (err) {
      setError(`Failed to record screen: ${err}`)
      console.error("[ClipForge] Screen recording error:", err)
      setIsRecording(false)
      setRecordingType(null)
      setActiveRecorder(null)
    }
  }

  const handlePiPRecord = async () => {
    try {
      console.log("[ClipForge] Starting PiP recording...")
      setIsRecording(true)
      setRecordingType("pip")
      setError(null)

      // Get screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        } as MediaTrackConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      console.log("[ClipForge] Got screen stream")

      // Get webcam stream with microphone audio
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }

      if (selectedAudioDevice && selectedAudioDevice !== 'default') {
        audioConstraints.deviceId = { exact: selectedAudioDevice }
      }

      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 30 }
        },
        audio: audioConstraints
      })
      console.log("[ClipForge] Got webcam stream with audio")

      // Create canvas for compositing
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext('2d')!

      // Create video elements for both streams
      const screenVideo = document.createElement('video')
      screenVideo.srcObject = screenStream
      screenVideo.autoplay = true
      screenVideo.muted = true

      const webcamVideo = document.createElement('video')
      webcamVideo.srcObject = webcamStream
      webcamVideo.autoplay = true
      webcamVideo.muted = true

      // Wait for videos to be ready
      await Promise.all([
        new Promise(resolve => screenVideo.onloadedmetadata = resolve),
        new Promise(resolve => webcamVideo.onloadedmetadata = resolve)
      ])

      // PiP overlay settings (bottom-right corner)
      const pipWidth = 320
      const pipHeight = 180
      const pipX = canvas.width - pipWidth - 20
      const pipY = canvas.height - pipHeight - 20

      // Compositing loop
      let animationId: number
      const composite = () => {
        if (!ctx) return

        // Draw screen (fullscreen background)
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)

        // Draw webcam overlay with border
        ctx.save()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 4
        ctx.strokeRect(pipX - 2, pipY - 2, pipWidth + 4, pipHeight + 4)
        ctx.drawImage(webcamVideo, pipX, pipY, pipWidth, pipHeight)
        ctx.restore()

        animationId = requestAnimationFrame(composite)
      }
      composite()

      // Capture canvas stream
      const compositeStream = canvas.captureStream(30)

      // Mix audio from both screen and webcam/microphone
      const audioContext = new AudioContext()
      const destination = audioContext.createMediaStreamDestination()

      // Add system audio from screen if available
      const systemAudioTrack = screenStream.getAudioTracks()[0]
      if (systemAudioTrack) {
        const systemSource = audioContext.createMediaStreamSource(new MediaStream([systemAudioTrack]))
        systemSource.connect(destination)
        console.log("[ClipForge] Added system audio to PiP mix")
      }

      // Add microphone audio from webcam stream
      const micAudioTrack = webcamStream.getAudioTracks()[0]
      if (micAudioTrack) {
        const micSource = audioContext.createMediaStreamSource(new MediaStream([micAudioTrack]))
        micSource.connect(destination)
        console.log("[ClipForge] Added microphone audio to PiP mix")
      }

      // Add mixed audio track to composite stream
      const mixedAudioTrack = destination.stream.getAudioTracks()[0]
      if (mixedAudioTrack) {
        compositeStream.addTrack(mixedAudioTrack)
        console.log("[ClipForge] Added mixed audio track to PiP stream")
      }

      const recorder = new MediaRecorder(compositeStream, {
        mimeType: "video/webm;codecs=vp8,opus",
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
          console.log("[ClipForge] PiP recording stopped, processing...")
          setIsRecording(false)
          setIsProcessing(true)

          // Stop animation loop
          cancelAnimationFrame(animationId)

          // Stop all streams
          screenStream.getTracks().forEach(track => track.stop())
          webcamStream.getTracks().forEach(track => track.stop())

          // Validate we have data
          if (chunks.length === 0) {
            throw new Error("No video data was recorded")
          }

          const blob = new Blob(chunks, { type: "video/webm" })
          console.log("[ClipForge] Blob size:", blob.size, "bytes")

          // Validate blob size
          if (blob.size === 0) {
            throw new Error("Recorded video is empty")
          }

          const arrayBuffer = await blob.arrayBuffer()
          const data = Array.from(new Uint8Array(arrayBuffer))

          const fileName = `pip_${Date.now()}.webm`
          console.log("[ClipForge] Saving recording:", fileName)

          const outputPath = await invoke<string>("save_recording", {
            fileName: fileName,
            data: data,
            convertToMp4: true,
          })
          console.log("[ClipForge] Recording saved to:", outputPath)

          // Calculate actual duration with validation
          const now = Date.now()
          const recordingStartTime = startTimeRef.current
          const elapsed = now - recordingStartTime
          const duration = Math.max(elapsed / 1000, 1)
          console.log("[ClipForge] PiP duration calculation:", {
            now,
            recordingStartTime,
            elapsed,
            duration,
            durationSeconds: duration
          })

          // Validate duration is reasonable (max 24 hours)
          if (duration > 86400) {
            throw new Error("Recording duration is invalid")
          }

          const lastClipEnd = clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0

          const newClip: Clip = {
            id: `clip_${Date.now()}`,
            path: outputPath,
            name: "PiP Recording",
            start: lastClipEnd,
            end: lastClipEnd + duration,
            duration,
            track: 0,
            trimStart: 0,
            trimEnd: duration,
            volume: 1,
            muted: false,
          }

          // Validate the clip before adding
          console.log("[ClipForge] Validating PiP clip:", {
            duration: newClip.duration,
            start: newClip.start,
            end: newClip.end,
            trimStart: newClip.trimStart,
            trimEnd: newClip.trimEnd,
            checks: {
              durationPositive: newClip.duration > 0,
              durationReasonable: newClip.duration <= 86400,
              endAfterStart: newClip.end > newClip.start,
              trimEndAfterStart: newClip.trimEnd > newClip.trimStart
            }
          })

          if (
            newClip.duration > 0 &&
            newClip.duration <= 86400 &&
            newClip.end > newClip.start &&
            newClip.trimEnd > newClip.trimStart
          ) {
            // Generate thumbnail BEFORE adding clip
            let thumbnailPath: string | undefined
            try {
              console.log("[ClipForge] Generating thumbnail for:", outputPath)
              thumbnailPath = await invoke<string>("generate_thumbnail", {
                filePath: outputPath,
                duration: duration,
                width: 160,
                height: 90
              })
              console.log("[ClipForge] Thumbnail generated:", thumbnailPath)
            } catch (thumbErr) {
              console.warn("[ClipForge] Failed to generate thumbnail:", thumbErr)
              // Don't fail the whole recording if thumbnail generation fails
            }

            // Add thumbnail_path to the clip
            newClip.thumbnail_path = thumbnailPath

            console.log("[ClipForge] Adding clip to store:", newClip)
            addClip(newClip)
            console.log("[ClipForge] PiP recording complete!")
          } else {
            throw new Error(`Generated PiP clip has invalid values - duration: ${newClip.duration}, start: ${newClip.start}, end: ${newClip.end}, trimStart: ${newClip.trimStart}, trimEnd: ${newClip.trimEnd}`)
          }

          setIsProcessing(false)
          setRecordingType(null)
          setActiveRecorder(null)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          console.error("[ClipForge] Error processing PiP recording:", err)
          setError(`Failed to process PiP recording: ${errorMessage}`)
          setIsRecording(false)
          setIsProcessing(false)
          setRecordingType(null)
          setActiveRecorder(null)
        }
      }

      // Store recorder reference for manual stop (including original streams and audio context)
      setActiveRecorder({
        recorder,
        stream: compositeStream,
        additionalStreams: [screenStream, webcamStream],
        audioContext
      })
      const now = Date.now()
      startTimeRef.current = now
      setStartTime(now)

      recorder.start()
      console.log("[ClipForge] PiP recorder started at:", now)
    } catch (err) {
      setError(`Failed to record PiP: ${err}`)
      console.error("[ClipForge] PiP recording error:", err)
      setIsRecording(false)
      setRecordingType(null)
      setActiveRecorder(null)
    }
  }

  // Processing state (saving and converting video)
  if (isProcessing) {
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white border-2 border-blue-500 shadow-lg cursor-not-allowed"
          disabled
        >
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </Button>
        <div className="text-sm text-blue-300 font-mono bg-zinc-800 px-4 py-2 rounded-md border border-blue-600 shadow-md">
          Processing Recording...
        </div>
      </div>
    )
  }

  // Recording state
  if (isRecording) {
    const audioTrack = activeRecorder?.stream.getAudioTracks()[0]
    const isMuted = audioTrack ? !audioTrack.enabled : false

    return (
      <div className="flex items-center gap-3">
        <div className="relative group">
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 bg-red-600 hover:bg-red-500 text-white border-2 border-red-500 shadow-lg animate-pulse"
            onClick={stopRecording}
          >
            <Circle className="h-6 w-6" />
          </Button>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-red-900 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
            Stop Recording
          </div>
        </div>

        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className={`h-12 w-12 text-white border-2 border-zinc-500 shadow-lg transition-all duration-200 ${
              isMuted ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-green-600 hover:bg-green-500 border-green-500'
            }`}
            onClick={toggleAudio}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
            {isMuted ? 'Unmute' : 'Mute'} Audio
          </div>
        </div>

        <div className="text-sm text-zinc-300 font-mono bg-zinc-800 px-4 py-2 rounded-md border border-zinc-600 shadow-md">
          {recordingType === "webcam" ? "Webcam" : recordingType === "screen" ? "Screen" : "PiP"} • {Math.round((Date.now() - startTime) / 1000)}s
        </div>
      </div>
    )
  }

  return (
    <div className="relative group">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 hover:bg-green-600 text-white border-2 border-green-500 hover:border-green-400 transition-all duration-200 shadow-lg"
          >
            <Video className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 bg-zinc-800 border-zinc-700 p-2 rounded-lg shadow-xl">
          <div className="text-zinc-400 text-xs px-2 py-1 font-semibold">
            Recording Mode
          </div>
          <DropdownMenuItem
            onClick={handleWebcamRecord}
            className="cursor-pointer hover:bg-zinc-700 rounded-md p-2 flex items-center gap-3 text-white"
          >
            <Video className="h-5 w-5 text-green-400" />
            <span className="text-sm">Webcam</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleScreenRecord}
            className="cursor-pointer hover:bg-zinc-700 rounded-md p-2 flex items-center gap-3 text-white"
          >
            <Monitor className="h-5 w-5 text-blue-400" />
            <span className="text-sm">Screen</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handlePiPRecord}
            className="cursor-pointer hover:bg-zinc-700 rounded-md p-2 flex items-center gap-3 text-white"
          >
            <PictureInPicture className="h-5 w-5 text-purple-400" />
            <span className="text-sm">PiP (Screen + Webcam)</span>
          </DropdownMenuItem>

          <div className="bg-zinc-700 my-1 h-px" />

          <div className="text-zinc-400 text-xs px-2 py-1 font-semibold flex items-center gap-2">
            <Mic className="h-3 w-3" />
            Microphone
          </div>
          {audioDevices.length > 0 ? (
            audioDevices.map((device) => (
              <DropdownMenuItem
                key={device.deviceId}
                onClick={() => {
                  setSelectedAudioDevice(device.deviceId)
                  console.log("[ClipForge] Selected audio device:", device.label)
                }}
                className={`cursor-pointer hover:bg-zinc-700 rounded-md p-2 text-white text-xs ${
                  selectedAudioDevice === device.deviceId ? 'bg-zinc-700' : ''
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedAudioDevice === device.deviceId ? 'bg-green-500' : 'bg-zinc-600'
                  }`} />
                  <span className="truncate flex-1">{device.label || `Microphone ${device.deviceId.slice(0, 8)}`}</span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled className="text-zinc-500 text-xs px-2 py-1">
              No microphones found
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
        Record Video
      </div>
    </div>
  )
}
