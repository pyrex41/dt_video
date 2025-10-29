"use client"

import { useRef, useEffect } from "react"
import { Canvas, Rect, Line, Text } from "fabric"
import { useClipStore } from "../store/use-clip-store"

const TIMELINE_HEIGHT = 240
const TRACK_HEIGHT = 80
const TRACK_PADDING = 20
const RULER_HEIGHT = 40

export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const { clips, playhead, setPlayhead, zoom, selectedClipId, setSelectedClip, updateClip } = useClipStore()

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

  // Render timeline elements
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Remove all event listeners to prevent memory leaks
    canvas.off()
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

    // Draw time ruler
    const canvasWidth = canvas.width || 800
    const secondsVisible = canvasWidth / zoom
    const markerInterval = secondsVisible > 60 ? 10 : secondsVisible > 30 ? 5 : 1

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
      const width = (clip.end - clip.start) * zoom
      const isSelected = clip.id === selectedClipId

      // Clip rectangle
      const clipRect = new Rect({
        left: x,
        top: RULER_HEIGHT + TRACK_PADDING + 10,
        width: width,
        height: TRACK_HEIGHT - 20,
        fill: isSelected ? "#3b82f6" : "#6366f1", // blue-500 : indigo-500
        stroke: isSelected ? "#60a5fa" : "#818cf8", // blue-400 : indigo-400
        strokeWidth: 2,
        rx: 4,
        ry: 4,
        shadow: isSelected ? "0 4px 12px rgba(59, 130, 246, 0.4)" : "0 2px 8px rgba(0, 0, 0, 0.3)",
      })

      // Clip name text
      const clipText = new Text(clip.name, {
        left: x + 8,
        top: RULER_HEIGHT + TRACK_PADDING + 18,
        fontSize: 13,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      })

      // Trim handles
      const leftHandle = new Rect({
        left: x,
        top: RULER_HEIGHT + TRACK_PADDING + 10,
        width: 8,
        height: TRACK_HEIGHT - 20,
        fill: "#10b981", // green-500
        rx: 2,
        ry: 2,
      })

      const rightHandle = new Rect({
        left: x + width - 8,
        top: RULER_HEIGHT + TRACK_PADDING + 10,
        width: 8,
        height: TRACK_HEIGHT - 20,
        fill: "#10b981", // green-500
        rx: 2,
        ry: 2,
      })

      // Make clip draggable
      clipRect.on("moving", (e) => {
        const target = e.target
        if (!target) return

        const newStart = (target.left || 0) / zoom
        const duration = clip.end - clip.start
        updateClip(clip.id, {
          start: Math.max(0, newStart),
          end: Math.max(0, newStart) + duration,
        })
      })

      clipRect.on("mousedown", () => {
        setSelectedClip(clip.id)
      })

      // Make handles draggable for trimming
      leftHandle.on("moving", (e) => {
        const target = e.target
        if (!target) return

        const newStart = Math.max(0, (target.left || 0) / zoom)
        if (newStart < clip.end - 0.1) {
          updateClip(clip.id, { start: newStart })
        }
      })

      rightHandle.on("moving", (e) => {
        const target = e.target
        if (!target) return

        const newEnd = ((target.left || 0) + 8) / zoom
        if (newEnd > clip.start + 0.1) {
          updateClip(clip.id, { end: newEnd })
        }
      })

      clipRect.set({ lockMovementY: true })
      leftHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true })
      rightHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true })

      canvas.add(clipRect, clipText, leftHandle, rightHandle)
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

    playheadHandle.on("moving", (e) => {
      const target = e.target
      if (!target) return

      const newTime = Math.max(0, ((target.left || 0) + 6) / zoom)
      setPlayhead(newTime)
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
  }, [clips, playhead, zoom, selectedClipId, setPlayhead, setSelectedClip, updateClip])

  return (
    <div className="relative border-t border-zinc-800 bg-zinc-900">
      <canvas ref={canvasRef} />
    </div>
  )
}
