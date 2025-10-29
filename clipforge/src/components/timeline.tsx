"use client"

import { useRef, useEffect, useState } from "react"
import { Canvas, Rect, Line, Text } from "fabric"
import { useClipStore } from "../store/use-clip-store"

const TIMELINE_HEIGHT = 240
const TRACK_HEIGHT = 80
const TRACK_PADDING = 20
const RULER_HEIGHT = 40

export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const isDraggingRef = useRef(false)
  const [forceRender, setForceRender] = useState(0)
  const { clips, playhead, setPlayhead, zoom, selectedClipId, setSelectedClip, updateClip, trimClip, deleteClip, autoFitZoom } = useClipStore()

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new Canvas(canvasRef.current, {
      width: canvasRef.current.parentElement?.offsetWidth || 800,
      height: TIMELINE_HEIGHT,
      backgroundColor: "#18181b", // zinc-900
      selection: false,
    })

    fabricCanvasRef.current = canvas

    // Handle window resize
    const handleResize = () => {
      const width = canvasRef.current?.parentElement?.offsetWidth || 800
      canvas.setDimensions({ width, height: TIMELINE_HEIGHT })
      canvas.renderAll()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      canvas.dispose()
    }
  }, [])

  // Auto-fit zoom when clips change
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas || clips.length === 0) return

    // Auto-fit zoom on initial load or when all clips change
    const timelineWidth = canvas.width || 800
    autoFitZoom(timelineWidth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.length, JSON.stringify(clips.map(c => ({ id: c.id, duration: c.duration })))])

  // Render timeline elements
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Don't re-render while dragging
    if (isDraggingRef.current) {
      return
    }

    canvas.clear()
    canvas.backgroundColor = "#18181b" // zinc-900

    // Draw track background
    const track = new Rect({
      left: 0,
      top: RULER_HEIGHT + TRACK_PADDING,
      width: canvas.width || 800,
      height: TRACK_HEIGHT,
      fill: "#27272a", // zinc-800
      selectable: false,
      evented: false,
    })
    canvas.add(track)

    // Draw time ruler - scale to longest clip
    const canvasWidth = canvas.width || 800
    const maxDuration = clips.length > 0 ? Math.max(...clips.map(c => c.end)) : 60
    const secondsVisible = Math.max(maxDuration * 1.2, 60) // Add 20% padding
    const markerInterval = secondsVisible > 120 ? 10 : secondsVisible > 60 ? 5 : 1

    for (let i = 0; i <= secondsVisible; i += markerInterval) {
      const x = i * zoom

      // Ruler line
      const line = new Line([x, RULER_HEIGHT - 10, x, RULER_HEIGHT], {
        stroke: "#52525b", // zinc-600
        strokeWidth: 1,
        selectable: false,
        evented: false,
      })
      canvas.add(line)

      // Time label
      const timeText = new Text(`${i}s`, {
        left: x + 4,
        top: RULER_HEIGHT - 30,
        fontSize: 11,
        fill: "#a1a1aa", // zinc-400
        selectable: false,
        evented: false,
      })
      canvas.add(timeText)
    }

    // Draw clips
    clips.forEach((clip) => {
      const x = clip.start * zoom
      const fullWidth = (clip.end - clip.start) * zoom

      // Calculate trim handle positions within the clip
      const trimStartOffset = clip.trimStart * zoom
      const trimEndOffset = clip.trimEnd * zoom
      const trimmedWidth = trimEndOffset - trimStartOffset

      const isSelected = clip.id === selectedClipId

      // Full clip rectangle (dimmed to show untrimmed portions)
      const clipRect = new Rect({
        left: x,
        top: RULER_HEIGHT + TRACK_PADDING + 10,
        width: fullWidth,
        height: TRACK_HEIGHT - 20,
        fill: isSelected ? "#1e3a8a" : "#312e81", // darker blue for full clip
        stroke: isSelected ? "#60a5fa" : "#818cf8",
        strokeWidth: 1,
        rx: 4,
        ry: 4,
        opacity: 0.4,
        selectable: false,
        evented: false,
      })

      // Trimmed portion (brighter)
      const trimmedRect = new Rect({
        left: x + trimStartOffset,
        top: RULER_HEIGHT + TRACK_PADDING + 10,
        width: trimmedWidth,
        height: TRACK_HEIGHT - 20,
        fill: isSelected ? "#3b82f6" : "#6366f1",
        stroke: isSelected ? "#60a5fa" : "#818cf8",
        strokeWidth: 2,
        rx: 4,
        ry: 4,
        shadow: isSelected ? "0 4px 12px rgba(59, 130, 246, 0.4)" : "0 2px 8px rgba(0, 0, 0, 0.3)",
      })

      // Clip name text
      const clipText = new Text(clip.name, {
        left: x + trimStartOffset + 8,
        top: RULER_HEIGHT + TRACK_PADDING + 18,
        fontSize: 13,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      })

      // Trim handles - positioned at trim points
      const leftHandle = new Rect({
        left: x + trimStartOffset,
        top: RULER_HEIGHT + TRACK_PADDING + 10,
        width: 12,
        height: TRACK_HEIGHT - 20,
        fill: "#ffffff",
        stroke: "#3b82f6",
        strokeWidth: 2,
        rx: 3,
        ry: 3,
        opacity: 0.9,
        hoverCursor: "ew-resize",
        selectable: true,
        evented: true,
      })

      const rightHandle = new Rect({
        left: x + trimEndOffset - 12,
        top: RULER_HEIGHT + TRACK_PADDING + 10,
        width: 12,
        height: TRACK_HEIGHT - 20,
        fill: "#ffffff",
        stroke: "#3b82f6",
        strokeWidth: 2,
        rx: 3,
        ry: 3,
        opacity: 0.9,
        hoverCursor: "ew-resize",
        selectable: true,
        evented: true,
      })

      // Make trimmed clip draggable (move clip position in timeline)
      trimmedRect.on("mousedown", () => {
        isDraggingRef.current = true
        setSelectedClip(clip.id)
        setPlayhead(clip.start + clip.trimStart) // Move playhead to trim start
      })

      trimmedRect.on("moving", (e) => {
        // Just constrain movement, don't update state
        const target = e.target
        if (!target) return

        // Constrain to positive time only
        const minX = 0
        if ((target.left || 0) < minX) {
          target.left = minX
        }
      })

      trimmedRect.on("mouseup", (e) => {
        const target = e.target
        if (target) {
          // Now update the state only once when drag ends
          const newStart = Math.max(0, ((target.left || 0) - trimStartOffset) / zoom)
          const duration = clip.end - clip.start
          updateClip(clip.id, {
            start: newStart,
            end: newStart + duration,
          })
        }
        isDraggingRef.current = false
        setForceRender(prev => prev + 1)
      })

      // Make handles draggable for trimming
      // Store initial positions for constraining movement
      let initialLeftHandlePos = x + trimStartOffset
      let initialRightHandlePos = x + trimEndOffset - 12

      leftHandle.on("mousedown", () => {
        isDraggingRef.current = true
        initialLeftHandlePos = x + trimStartOffset
        setSelectedClip(clip.id)
      })

      leftHandle.on("moving", (e) => {
        const target = e.target
        if (!target) return

        // Constrain movement to stay within clip bounds
        const minX = x
        const maxX = x + trimEndOffset - 12 - (0.1 * zoom) // Leave at least 0.1s before trim end

        if ((target.left || 0) < minX) {
          target.left = minX
        } else if ((target.left || 0) > maxX) {
          target.left = maxX
        }
      })

      leftHandle.on("mouseup", (e) => {
        const target = e.target
        if (target) {
          // Update trim position in store
          const newTrimStart = Math.max(0, Math.min(clip.trimEnd - 0.1, ((target.left || 0) - x) / zoom))
          console.log('[ClipForge] Left handle released:', { newTrimStart, targetLeft: target.left, x, zoom })
          updateClip(clip.id, { trimStart: newTrimStart })
          // Move playhead to new trim start to update preview
          setPlayhead(clip.start + newTrimStart)
        }
        isDraggingRef.current = false
        // Force re-render to update button state
        setForceRender(prev => prev + 1)
      })

      rightHandle.on("mousedown", () => {
        isDraggingRef.current = true
        initialRightHandlePos = x + trimEndOffset - 12
        setSelectedClip(clip.id)
      })

      rightHandle.on("moving", (e) => {
        const target = e.target
        if (!target) return

        // Constrain movement to stay within clip bounds
        const minX = x + trimStartOffset + (0.1 * zoom) // Leave at least 0.1s after trim start
        const maxX = x + (clip.duration * zoom) - 12

        if ((target.left || 0) < minX) {
          target.left = minX
        } else if ((target.left || 0) > maxX) {
          target.left = maxX
        }
      })

      rightHandle.on("mouseup", (e) => {
        const target = e.target
        if (target) {
          // Update trim position in store
          const newTrimEnd = Math.max(clip.trimStart + 0.1, Math.min(clip.duration, ((target.left || 0) + 12 - x) / zoom))
          console.log('[ClipForge] Right handle released:', { newTrimEnd, targetLeft: target.left, x, zoom })
          updateClip(clip.id, { trimEnd: newTrimEnd })
          // Move playhead to new trim end to update preview
          setPlayhead(clip.start + newTrimEnd)
        }
        isDraggingRef.current = false
        // Force re-render to update button state
        setForceRender(prev => prev + 1)
      })

      trimmedRect.set({ lockMovementY: true, hoverCursor: "move" })
      leftHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hasControls: false })
      rightHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hasControls: false })

      // Add clip elements - handles MUST be added last so they're on top and can receive mouse events
      canvas.add(clipRect, trimmedRect, clipText)
      canvas.add(leftHandle, rightHandle)
    })

    // Draw playhead
    const playheadX = playhead * zoom
    const playheadLine = new Line([playheadX, 0, playheadX, TIMELINE_HEIGHT], {
      stroke: "#ef4444", // red-500
      strokeWidth: 2,
      selectable: false,
      evented: false,
    })

    const playheadHandle = new Rect({
      left: playheadX - 6,
      top: 0,
      width: 12,
      height: 12,
      fill: "#ef4444", // red-500
      rx: 2,
      ry: 2,
    })

    playheadHandle.on("mousedown", () => {
      isDraggingRef.current = true
    })

    playheadHandle.on("moving", (e) => {
      // Just constrain movement, don't update state
      const target = e.target
      if (!target) return

      // Constrain to positive time only
      const minX = -6
      if ((target.left || 0) < minX) {
        target.left = minX
      }
    })

    playheadHandle.on("mouseup", (e) => {
      const target = e.target
      if (target) {
        // Update state only once when drag ends
        const newTime = Math.max(0, ((target.left || 0) + 6) / zoom)
        setPlayhead(newTime)
      }
      isDraggingRef.current = false
      setForceRender(prev => prev + 1)
    })

    playheadHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true })

    canvas.add(playheadLine, playheadHandle)

    // Click on timeline to move playhead
    canvas.on("mouse:down", (e) => {
      if (!e.target) {
        const pointer = canvas.getPointer(e.e)
        const newTime = Math.max(0, pointer.x / zoom)
        setPlayhead(newTime)
      }
    })

    canvas.renderAll()
  }, [clips, playhead, zoom, selectedClipId, setPlayhead, setSelectedClip, updateClip, trimClip, deleteClip, forceRender])

  // Handle drag and drop from media library
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()

    try {
      const clipData = JSON.parse(e.dataTransfer.getData("application/json"))
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      // Calculate drop position in timeline
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const dropX = e.clientX - rect.left
      const dropTime = Math.max(0, dropX / zoom)

      // Create a new clip instance from the library clip
      // Find the end of the timeline to place it sequentially by default
      const existingClips = clips
      const lastClipEnd = existingClips.length > 0
        ? Math.max(...existingClips.map(c => c.end))
        : 0

      // Use drop position if it's after existing clips, otherwise append
      const startTime = Math.max(dropTime, lastClipEnd)

      // Generate new unique ID for the timeline instance
      const newClip = {
        ...clipData,
        id: `${clipData.id}-${Date.now()}`, // New ID for timeline instance
        start: startTime,
        end: startTime + clipData.duration,
        trimStart: clipData.trimStart || 0,
        trimEnd: clipData.trimEnd || clipData.duration,
        track: 0, // Default to main track
      }

      // Add to timeline
      useClipStore.getState().addClip(newClip)
      setPlayhead(startTime)
      setSelectedClip(newClip.id)

      console.log('[ClipForge] Clip dropped on timeline:', { dropTime, startTime, clip: newClip })
    } catch (err) {
      console.error('[ClipForge] Failed to drop clip:', err)
    }
  }

  return (
    <div
      className="relative border-t border-zinc-800 bg-zinc-900"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
