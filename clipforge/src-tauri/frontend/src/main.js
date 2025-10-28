import './index.css'  // Import Tailwind styles
import { Elm } from './Main.elm'
import { open } from '@tauri-apps/plugin-dialog'
import { convertFileSrc } from '@tauri-apps/api/core'

// Tauri backend integration
import { invoke } from '@tauri-apps/api/core'

/**
 * TAURI-ELM PORT BRIDGE
 *
 * This file establishes the communication bridge between Elm frontend and Tauri backend.
 *
 * Backend Commands (from prd-integration-reference.md):
 * - check_ffmpeg(): Verify FFmpeg availability
 * - import_file(path, dest): Copy video to clips/ and return metadata
 * - record_webcam_clip(output, duration): Capture webcam video via nokhwa
 * - save_recording(path, data): Save screen recording blob
 * - trim_clip(input, output, start, end): Trim clip using FFmpeg
 * - export_video(inputs, output, resolution): Export clips to MP4
 *
 * Port Flow:
 * Elm → Port (Cmd) → JavaScript → Tauri invoke() → Rust Backend
 * Rust Backend → Response → JavaScript → Port (Sub) → Elm
 */

// Initialize Elm app
const app = Elm.Main.init({
  node: document.getElementById('root'),
  flags: null
})

// Get video element reference
let videoElement = null

// Helper to get video element
function getVideoElement() {
  if (!videoElement) {
    videoElement = document.getElementById('video-player')
  }
  return videoElement
}

// Handle import request from Elm
app.ports.requestImport.subscribe(async () => {
  try {
    // Open file dialog for video files
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Video',
        extensions: ['mp4', 'mov', 'MOV', 'MP4']
      }]
    })

    if (selected) {
      // TAURI INTEGRATION - ACTIVE:
      try {
        const fileName = selected.split('/').pop() || selected.split('\\').pop()
        const dest = `clips/${fileName}`
        const metadataJson = await invoke('import_file', { path: selected, dest: dest })
        const metadata = JSON.parse(metadataJson)

        // Convert file path to Tauri asset URL
        const assetUrl = convertFileSrc(dest)

        const clip = {
          id: Date.now().toString(),
          path: assetUrl,  // Use Tauri asset URL for video player
          fileName: fileName,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height
        }

        // Send clip data back to Elm
        app.ports.clipImported.send(clip)

        // Reset video element reference when new video is loaded
        videoElement = null
      } catch (error) {
        console.error('Error importing file:', error)
        alert(`Import failed: ${error}`)
      }
    }
  } catch (error) {
    console.error('Error opening file dialog:', error)
  }
})

// Handle video time setting from Elm
app.ports.setVideoTime.subscribe((time) => {
  const video = getVideoElement()
  if (video) {
    video.currentTime = time
  }
})

// Handle play command from Elm
app.ports.playVideo.subscribe(() => {
  const video = getVideoElement()
  if (video) {
    video.play().catch(err => console.error('Error playing video:', err))
  }
})

// Handle pause command from Elm
app.ports.pauseVideo.subscribe(() => {
  const video = getVideoElement()
  if (video) {
    video.pause()
  }
})

// Handle trim clip command from Elm
app.ports.trimClip.subscribe(async (trimData) => {
  console.log('Trim clip requested:', trimData)

  // TAURI INTEGRATION - ACTIVE:
  try {
    await invoke('trim_clip', {
      input: trimData.input,
      output: trimData.output,
      start: trimData.start,
      end: trimData.end
    })
    alert(`Trim complete!\nOutput: ${trimData.output}`)
  } catch (error) {
    console.error('Trim failed:', error)
    alert(`Trim failed: ${error}`)
  }
})

// Handle export video command from Elm
app.ports.exportVideo.subscribe(async (exportData) => {
  console.log('Export video requested:', exportData)

  // TAURI INTEGRATION - ACTIVE:
  try {
    // Parse resolution (e.g., "720p" → "1280x720")
    const resolutionMap = {
      '720p': '1280x720',
      '1080p': '1920x1080'
    }
    const resolution = resolutionMap[exportData.resolution] || '1280x720'

    // TODO: Implement progress tracking via Tauri events
    // For now, show initial progress
    app.ports.exportProgress.send(0)

    // Call backend (this is async, but FFmpeg progress would need event streaming)
    await invoke('export_video', {
      inputs: exportData.inputs,
      output: exportData.output,
      resolution: resolution
    })

    // Mark as complete
    app.ports.exportProgress.send(100)
    alert(`Export complete!\nOutput: ${exportData.output}`)
  } catch (error) {
    console.error('Export failed:', error)
    alert(`Export failed: ${error}`)
  }
})

// Handle webcam recording from Elm
app.ports.recordWebcam.subscribe(async (recordData) => {
  console.log('Webcam recording requested:', recordData)

  // TAURI INTEGRATION - ACTIVE:
  try {
    const outputPath = await invoke('record_webcam_clip', {
      output: recordData.output,
      duration: recordData.duration
    })

    // Get metadata for the recorded clip
    const metadataJson = await invoke('import_file', {
      path: outputPath,
      dest: outputPath
    })
    const metadata = JSON.parse(metadataJson)

    // Convert file path to Tauri asset URL
    const assetUrl = convertFileSrc(outputPath)

    const clip = {
      id: Date.now().toString(),
      path: assetUrl,
      fileName: recordData.output,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height
    }

    app.ports.recordingComplete.send(clip)
    alert(`Webcam recording complete!\nSaved to: ${outputPath}`)
  } catch (error) {
    console.error('Webcam recording failed:', error)
    alert(`Webcam recording failed: ${error}`)
  }
})

// Handle screen recording from Elm
app.ports.recordScreen.subscribe(async () => {
  console.log('Screen recording requested')

  // BROWSER API + TAURI INTEGRATION - ACTIVE:
  try {
    // Request screen capture
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    })

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8'
    })

    const chunks = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    recorder.onstop = async () => {
      try {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Create blob
        const blob = new Blob(chunks, { type: 'video/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        const data = Array.from(new Uint8Array(arrayBuffer))

        const fileName = `screen_recording_${Date.now()}.webm`
        const path = `clips/${fileName}`

        // Save via Tauri backend
        await invoke('save_recording', { path, data })

        // Get metadata
        const metadataJson = await invoke('import_file', { path, dest: path })
        const metadata = JSON.parse(metadataJson)

        // Convert file path to Tauri asset URL
        const assetUrl = convertFileSrc(path)

        const clip = {
          id: Date.now().toString(),
          path: assetUrl,
          fileName: fileName,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height
        }

        app.ports.recordingComplete.send(clip)
        alert(`Screen recording complete!\nSaved to: ${path}`)
      } catch (error) {
        console.error('Error saving screen recording:', error)
        alert(`Failed to save recording: ${error}`)
      }
    }

    // Record for 10 seconds
    recorder.start()
    setTimeout(() => recorder.stop(), 10000)

    alert('Screen recording started (10 seconds)...')
  } catch (error) {
    console.error('Screen recording failed:', error)
    alert(`Screen recording failed: ${error}`)
  }
})

// Listen for video time updates and send to Elm
document.addEventListener('DOMContentLoaded', () => {
  // Use event delegation since video element may not exist yet
  document.addEventListener('timeupdate', (e) => {
    if (e.target.id === 'video-player') {
      app.ports.videoTimeUpdate.send(e.target.currentTime)
    }
  })
})
