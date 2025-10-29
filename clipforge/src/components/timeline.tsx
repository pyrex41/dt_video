"use client"

import { useRef, useEffect, useState } from "react"
import { Canvas, Rect, Line, Text } from "fabric"
import { useClipStore } from "../store/use-clip-store"

const NUM_TRACKS = 3 // Support 3 tracks for now
const TRACK_HEIGHT = 80
const TRACK_PADDING = 10
const TRACK_SPACING = 5
const RULER_HEIGHT = 40
const TRACK_LABEL_WIDTH = 60
const TIMELINE_HEIGHT = RULER_HEIGHT + (NUM_TRACKS * (TRACK_HEIGHT + TRACK_SPACING)) + TRACK_PADDING * 2

export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const isDraggingRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, scrollOffset: 0 })
  const [forceRender, setForceRender] = useState(0)
  const { clips, playhead, setPlayhead, zoom, scrollOffset, setScrollOffset, selectedClipId, setSelectedClip, updateClip, trimClip, deleteClip, autoFitZoom } = useClipStore()

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return

    const parent = canvasRef.current.parentElement
    const parentWidth = parent?.offsetWidth || 800
    console.log('[Timeline] Initializing canvas - parent width:', parentWidth)

    const canvas = new Canvas(canvasRef.current, {
      width: parentWidth,
      height: TIMELINE_HEIGHT,
      backgroundColor: "#18181b", // zinc-900
      selection: false,
    })

    fabricCanvasRef.current = canvas

    // Handle resize
    const handleResize = () => {
      const width = canvasRef.current?.parentElement?.offsetWidth || 800
      const currentWidth = canvas.getWidth()

      if (width !== currentWidth) {
        console.log('[Timeline] Resizing canvas from', currentWidth, 'to', width)
        canvas.setDimensions({ width, height: TIMELINE_HEIGHT })
        setForceRender(prev => prev + 1) // Trigger full re-render of clips
      }
    }

    // Window resize handler - check immediately
    const windowResizeHandler = () => {
      console.log('[Timeline] Window resize event fired')
      handleResize()
    }

    // Listen to window resize
    window.addEventListener("resize", windowResizeHandler)

    // Poll for size changes - sync Fabric canvas internal dimensions with CSS width
    const pollInterval = setInterval(() => {
      if (!canvasRef.current) return

      // Get the actual rendered width of the canvas element (after CSS width: 100%)
      const renderedWidth = canvasRef.current.offsetWidth
      const fabricWidth = canvas.getWidth()

      if (renderedWidth !== fabricWidth && renderedWidth > 0) {
        console.log('[Timeline] Syncing Fabric canvas dimensions from', fabricWidth, 'to', renderedWidth)
        canvas.setDimensions({ width: renderedWidth, height: TIMELINE_HEIGHT })
        setForceRender(prev => prev + 1)
      }
    }, 100) // Check frequently (every 100ms)

    return () => {
      window.removeEventListener("resize", windowResizeHandler)
      clearInterval(pollInterval)
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose()
      }
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

  // Helper function to calculate Y position for a track
  const getTrackY = (trackNumber: number): number => {
    return RULER_HEIGHT + TRACK_PADDING + (trackNumber * (TRACK_HEIGHT + TRACK_SPACING))
  }

  // Render timeline elements
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Don't re-render while dragging
    if (isDraggingRef.current) {
      return
    }

    // Sync canvas width with actual rendered width BEFORE rendering
    if (canvasRef.current) {
      const renderedWidth = canvasRef.current.offsetWidth
      if (renderedWidth > 0 && renderedWidth !== canvas.getWidth()) {
        console.log('[Timeline] Syncing width before render:', renderedWidth)
        canvas.setDimensions({ width: renderedWidth, height: TIMELINE_HEIGHT })
      }
    }

    canvas.clear()
    canvas.backgroundColor = "#18181b" // zinc-900

    // Create clipping path to prevent content from rendering over track labels
    canvas.clipPath = new Rect({
      left: TRACK_LABEL_WIDTH,
      top: 0,
      width: (canvas.width || 800) - TRACK_LABEL_WIDTH,
      height: TIMELINE_HEIGHT,
      absolutePositioned: true,
    })

    // Draw track backgrounds and labels
    for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
      const trackY = getTrackY(trackNum)

      // Track label
      const trackLabel = new Text(`Track ${trackNum + 1}`, {
        left: 8,
        top: trackY + TRACK_HEIGHT / 2 - 8,
        fontSize: 12,
        fill: "#71717a", // zinc-500
        selectable: false,
        evented: false,
      })
      canvas.add(trackLabel)

      // Track background
      const track = new Rect({
        left: TRACK_LABEL_WIDTH,
        top: trackY,
        width: (canvas.width || 800) - TRACK_LABEL_WIDTH,
        height: TRACK_HEIGHT,
        fill: trackNum % 2 === 0 ? "#27272a" : "#1f1f23", // Alternating zinc-800/900
        stroke: "#3f3f46", // zinc-700
        strokeWidth: 1,
        selectable: false,
        evented: false,
      })
      canvas.add(track)
    }

    // Draw time ruler - scale to longest clip
    const canvasWidth = canvas.width || 800
    const maxDuration = clips.length > 0 ? Math.max(...clips.map(c => c.end)) : 60
    const secondsVisible = Math.max(maxDuration * 1.2, 60) // Add 20% padding

    // Dynamic marker interval based on zoom level
    // When zoomed out, show minutes; when zoomed in, show seconds
    let markerInterval: number
    let useMinutes = false

    if (zoom < 5) {
      // Zoomed out - show minutes
      markerInterval = 60 // Every minute
      useMinutes = true
    } else if (zoom < 10) {
      // Medium zoom - show 10-second intervals
      markerInterval = 10
    } else if (zoom < 20) {
      // More zoomed in - show 5-second intervals
      markerInterval = 5
    } else {
      // Very zoomed in - show every second
      markerInterval = 1
    }

    for (let i = 0; i <= secondsVisible; i += markerInterval) {
      const x = i * zoom - scrollOffset + TRACK_LABEL_WIDTH

      // Skip markers that are off-screen to the left
      if (x < TRACK_LABEL_WIDTH) continue
      // Skip markers that are off-screen to the right
      if (x > canvas.width!) break

      // Ruler line
      const line = new Line([x, RULER_HEIGHT - 10, x, RULER_HEIGHT], {
        stroke: "#52525b", // zinc-600
        strokeWidth: 1,
        selectable: false,
        evented: false,
      })
      canvas.add(line)

      // Time label - show minutes or seconds based on zoom
      const timeLabel = useMinutes
        ? `${Math.floor(i / 60)}m${i % 60 === 0 ? '' : ` ${i % 60}s`}`
        : `${i}s`

      const timeText = new Text(timeLabel, {
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
      const x = clip.start * zoom - scrollOffset + TRACK_LABEL_WIDTH
      const fullWidth = (clip.end - clip.start) * zoom

      // Skip clips that are completely off-screen to the left
      if (x + fullWidth < TRACK_LABEL_WIDTH) return
      // Skip clips that are completely off-screen to the right
      if (x > canvas.width!) return

      // Calculate trim handle positions within the clip
      const trimStartOffset = clip.trimStart * zoom
      const trimEndOffset = clip.trimEnd * zoom
      const trimmedWidth = trimEndOffset - trimStartOffset

      const isSelected = clip.id === selectedClipId

      // Calculate Y position based on track number
      const trackY = getTrackY(clip.track)
      const clipYOffset = 10 // Vertical padding within track

      // Check for overlaps with other clips on same track
      const hasOverlap = clips.some(c =>
        c.id !== clip.id &&
        c.track === clip.track &&
        ((clip.start >= c.start && clip.start < c.end) ||
         (clip.end > c.start && clip.end <= c.end) ||
         (clip.start <= c.start && clip.end >= c.end))
      )

      // Full clip rectangle (dimmed to show untrimmed portions)
      const clipRect = new Rect({
        left: x,
        top: trackY + clipYOffset,
        width: fullWidth,
        height: TRACK_HEIGHT - (clipYOffset * 2),
        fill: isSelected ? "#1e3a8a" : "#312e81", // darker blue for full clip
        stroke: isSelected ? "#60a5fa" : "#818cf8",
        strokeWidth: 1,
        rx: 4,
        ry: 4,
        opacity: 0.4,
        selectable: false,
        evented: false,
      })

      // Trimmed portion (brighter) - with overlap indicator
      const trimmedRect = new Rect({
        left: x + trimStartOffset,
        top: trackY + clipYOffset,
        width: trimmedWidth,
        height: TRACK_HEIGHT - (clipYOffset * 2),
        fill: hasOverlap ? "#dc2626" : (isSelected ? "#3b82f6" : "#6366f1"), // Red if overlapping
        stroke: hasOverlap ? "#ef4444" : (isSelected ? "#60a5fa" : "#818cf8"), // Red border if overlapping
        strokeWidth: hasOverlap ? 3 : 2, // Thicker border for overlap
        rx: 4,
        ry: 4,
        shadow: hasOverlap ? "0 4px 12px rgba(220, 38, 38, 0.6)" : (isSelected ? "0 4px 12px rgba(59, 130, 246, 0.4)" : "0 2px 8px rgba(0, 0, 0, 0.3)"),
      })

      // Clip name text
      const clipText = new Text(clip.name, {
        left: x + trimStartOffset + 8,
        top: trackY + clipYOffset + 8,
        fontSize: 13,
        fill: "#ffffff",
        selectable: false,
        evented: false,
      })

      // Trim handles - positioned at trim points
      const leftHandle = new Rect({
        left: x + trimStartOffset,
        top: trackY + clipYOffset,
        width: 12,
        height: TRACK_HEIGHT - (clipYOffset * 2),
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
        top: trackY + clipYOffset,
        width: 12,
        height: TRACK_HEIGHT - (clipYOffset * 2),
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
        console.log('[Timeline] Clip clicked, setting selected clip:', clip.id, clip.name)
      })

      trimmedRect.on("moving", (e) => {
        // Allow both horizontal and vertical movement
        const target = e.target
        if (!target) return

        // Constrain to positive time only (horizontal)
        const minX = TRACK_LABEL_WIDTH
        if ((target.left || 0) < minX) {
          target.left = minX
        }

        // Constrain vertical movement to valid tracks
        const targetY = target.top || 0
        let snappedTrack = 0
        let minDistance = Infinity

        // Find closest track based on Y position
        for (let i = 0; i < NUM_TRACKS; i++) {
          const trackCenterY = getTrackY(i) + (TRACK_HEIGHT / 2)
          const distance = Math.abs(targetY - trackCenterY + clipYOffset + (TRACK_HEIGHT / 2))
          if (distance < minDistance) {
            minDistance = distance
            snappedTrack = i
          }
        }

        // Snap to the detected track
        target.top = getTrackY(snappedTrack) + clipYOffset
      })

      trimmedRect.on("mouseup", (e) => {
        const target = e.target
        if (target) {
          // Calculate new start time and track
          const newStart = Math.max(0, ((target.left || 0) - TRACK_LABEL_WIDTH - trimStartOffset) / zoom)
          const duration = clip.end - clip.start

          // Determine which track based on Y position
          const targetY = target.top || 0
          let newTrack = clip.track
          for (let i = 0; i < NUM_TRACKS; i++) {
            const trackCenterY = getTrackY(i) + (TRACK_HEIGHT / 2)
            const distance = Math.abs(targetY - trackCenterY + clipYOffset + (TRACK_HEIGHT / 2))
            if (distance < (TRACK_HEIGHT / 2)) {
              newTrack = i
              break
            }
          }

          // Check for overlaps on the target track
          const clipsOnTrack = clips.filter(c => c.id !== clip.id && c.track === newTrack)
          const sortedClips = [...clipsOnTrack].sort((a, b) => a.start - b.start)

          const hasOverlap = sortedClips.some(c =>
            (newStart >= c.start && newStart < c.end) ||
            (newStart + duration > c.start && newStart + duration <= c.end) ||
            (newStart <= c.start && newStart + duration > c.start)
          )

          let finalStart = newStart

          if (hasOverlap) {
            // Find the clip(s) we're overlapping with
            const overlappingClips = sortedClips.filter(c =>
              (newStart >= c.start && newStart < c.end) ||
              (newStart + duration > c.start && newStart + duration <= c.end) ||
              (newStart <= c.start && newStart + duration > c.start)
            )

            if (overlappingClips.length > 0) {
              // Find the end of the last overlapping clip
              const lastOverlappingClip = overlappingClips[overlappingClips.length - 1]
              const afterLastClip = lastOverlappingClip.end

              // Check if there's a gap after this clip that fits our clip
              const nextClipAfter = sortedClips.find(c => c.start >= afterLastClip)

              if (nextClipAfter) {
                const gapSize = nextClipAfter.start - afterLastClip
                if (gapSize >= duration) {
                  // Fits in the gap
                  finalStart = afterLastClip
                } else {
                  // Doesn't fit, place after the next clip
                  finalStart = nextClipAfter.end
                }
              } else {
                // No clips after, place at the end
                finalStart = afterLastClip
              }
            }
          }

          // Update clip position and track
          updateClip(clip.id, {
            start: finalStart,
            end: finalStart + duration,
            track: newTrack,
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

      trimmedRect.set({ hoverCursor: "move" }) // Allow vertical movement for track switching
      leftHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hasControls: false })
      rightHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true, hasControls: false })

      // Add clip elements - handles MUST be added last so they're on top and can receive mouse events
      canvas.add(clipRect, trimmedRect, clipText)
      canvas.add(leftHandle, rightHandle)
    })

    // Draw playhead (only if visible)
    const playheadX = playhead * zoom - scrollOffset + TRACK_LABEL_WIDTH

    if (playheadX >= TRACK_LABEL_WIDTH && playheadX <= canvas.width!) {
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

        // Constrain to valid timeline area (account for track label)
        const minX = TRACK_LABEL_WIDTH - 6
        if ((target.left || 0) < minX) {
          target.left = minX
        }
      })

      playheadHandle.on("mouseup", (e) => {
        const target = e.target
        if (target) {
          // Update state only once when drag ends
          const newTime = Math.max(0, ((target.left || 0) + 6 - TRACK_LABEL_WIDTH) / zoom)
          setPlayhead(newTime)
        }
        isDraggingRef.current = false
        setForceRender(prev => prev + 1)
      })

      playheadHandle.set({ lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true })

      canvas.add(playheadLine, playheadHandle)
    }

    // Click on timeline to move playhead
    canvas.on("mouse:down", (e) => {
      if (!e.target) {
        const pointer = canvas.getPointer(e.e)
        const newTime = Math.max(0, (pointer.x - TRACK_LABEL_WIDTH + scrollOffset) / zoom)
        setPlayhead(newTime)
      }
    })

    canvas.renderAll()
  }, [clips, playhead, zoom, scrollOffset, selectedClipId, setPlayhead, setSelectedClip, updateClip, trimClip, deleteClip, forceRender])

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
      const dropY = e.clientY - rect.top
      const dropTime = Math.max(0, (dropX - TRACK_LABEL_WIDTH) / zoom)

      // Calculate which track was dropped on
      let targetTrack = 0
      for (let i = 0; i < NUM_TRACKS; i++) {
        const trackY = getTrackY(i)
        if (dropY >= trackY && dropY <= trackY + TRACK_HEIGHT) {
          targetTrack = i
          break
        }
      }

      // Find next available position on the target track
      const clipsOnTrack = clips.filter(c => c.track === targetTrack)
      let startTime = dropTime

      // Sort clips on track by start time
      const sortedClips = [...clipsOnTrack].sort((a, b) => a.start - b.start)

      // Check if dropping in an occupied space
      const hasOverlap = sortedClips.some(c =>
        (startTime >= c.start && startTime < c.end) ||
        (startTime + clipData.duration > c.start && startTime + clipData.duration <= c.end) ||
        (startTime <= c.start && startTime + clipData.duration > c.start)
      )

      if (hasOverlap) {
        // Find the clip(s) we're overlapping with
        const overlappingClips = sortedClips.filter(c =>
          (startTime >= c.start && startTime < c.end) ||
          (startTime + clipData.duration > c.start && startTime + clipData.duration <= c.end) ||
          (startTime <= c.start && startTime + clipData.duration > c.start)
        )

        if (overlappingClips.length > 0) {
          // Find the end of the last overlapping clip
          const lastOverlappingClip = overlappingClips[overlappingClips.length - 1]
          const afterLastClip = lastOverlappingClip.end

          // Check if there's a gap after this clip that fits our clip
          const nextClipAfter = sortedClips.find(c => c.start >= afterLastClip)

          if (nextClipAfter) {
            const gapSize = nextClipAfter.start - afterLastClip
            if (gapSize >= clipData.duration) {
              // Fits in the gap
              startTime = afterLastClip
            } else {
              // Doesn't fit, place after the next clip
              startTime = nextClipAfter.end
            }
          } else {
            // No clips after, place at the end
            startTime = afterLastClip
          }
        }
      }

      // Generate new unique ID for the timeline instance
      const newClip = {
        ...clipData,
        id: `${clipData.id}-${Date.now()}`, // New ID for timeline instance
        start: startTime,
        end: startTime + clipData.duration,
        trimStart: clipData.trimStart || 0,
        trimEnd: clipData.trimEnd || clipData.duration,
        track: targetTrack,
      }

      // Add to timeline
      useClipStore.getState().addClip(newClip)
      setPlayhead(startTime)
      setSelectedClip(newClip.id)

      console.log('[ClipForge] Clip dropped on timeline:', {
        dropTime,
        startTime,
        targetTrack,
        hasOverlap,
        clip: newClip
      })
    } catch (err) {
      console.error('[ClipForge] Failed to drop clip:', err)
    }
  }

  // Handle horizontal scrolling with mouse wheel / trackpad
  const handleWheel = (e: React.WheelEvent) => {
    // Only handle horizontal scroll or shift+vertical scroll
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault()
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
      setScrollOffset(scrollOffset + delta)
    }
  }

  // Handle space+drag panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.spaceKey) { // Middle mouse or space key
      e.preventDefault()
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, scrollOffset }
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanningRef.current) {
      e.preventDefault()
      const deltaX = panStartRef.current.x - e.clientX
      setScrollOffset(panStartRef.current.scrollOffset + deltaX)
    }
  }

  const handleCanvasMouseUp = () => {
    isPanningRef.current = false
  }

  return (
    <div
      className="relative w-full border-t border-zinc-800 bg-zinc-900 overflow-hidden"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          display: 'block',
          cursor: isPanningRef.current ? 'grabbing' : 'default'
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      />
    </div>
  )
}
