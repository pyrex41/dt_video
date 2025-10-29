# Playhead Dragging - Visual Guide

## Playhead Visual Structure

```
Timeline Canvas (200px height)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                   ◉ ← Draggable Handle                      │  Y=0-40px (hit area)
│                   │   (6px radius red circle)               │
│                   │   (white 1.5px outline)                 │
│                   │                                         │
│  ─────────────────┼─────────────────────────────  Track 0   │  Y=30-90px
│                   │                                         │
│                   │                                         │
│  ─────────────────┼─────────────────────────────  Track 1   │  Y=110-170px
│                   │                                         │
│                   │                                         │
│                   │ ← Red vertical line (2px wide)          │
│                   │   extends full canvas height            │
└─────────────────────────────────────────────────────────────┘
                    ↑
              X = playhead * pixelsPerSecond
```

## Hit Area Details

```
Hit Detection Zone (top of timeline)
┌─────────────────────────────────────┐
│         12px  ←→  12px              │  Total width: 24px
│    ◄─────────◉─────────►            │  Total height: 40px
│              │                      │
│              │                      │
│              │                      │
│              ▼                      │  Y = 0 to 40px
└─────────────────────────────────────┘

Formula:
  isPlayheadHandleClick =
    abs(x - playheadX) < 12  AND  y >= 0  AND  y < 40
```

## Drag Behavior Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. MOUSE DOWN                                               │
│    ┌──────────────────────────────────────────┐             │
│    │ Check: isPlayheadHandleClick?            │             │
│    └────────┬─────────────────────────────────┘             │
│             │                                               │
│        YES  │  NO                                           │
│    ┌────────▼────────┐     ┌──────────────┐                │
│    │ Set dragging:   │     │ Check clips  │                │
│    │ DraggingPlayhead│     │ or timeline  │                │
│    └─────────────────┘     └──────────────┘                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. MOUSE MOVE (while dragging playhead)                    │
│    ┌──────────────────────────────────────────┐             │
│    │ Calculate delta from last mouse position │             │
│    └────────┬─────────────────────────────────┘             │
│             │                                               │
│    ┌────────▼──────────────────────────────────┐            │
│    │ newPlayhead = playhead + (deltaX / pps)   │            │
│    └────────┬──────────────────────────────────┘            │
│             │                                               │
│    ┌────────▼──────────────────────────────────┐            │
│    │ snappedPlayhead = snapToGrid(newPlayhead) │            │
│    └────────┬──────────────────────────────────┘            │
│             │                                               │
│    ┌────────▼──────────────────────────────────┐            │
│    │ clampedPlayhead = clamp(0, maxTime, ...)  │            │
│    └────────┬──────────────────────────────────┘            │
│             │                                               │
│    ┌────────▼──────────────────────────────────┐            │
│    │ Update model.playhead                     │            │
│    │ Send setVideoTime port command            │            │
│    └───────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. MOUSE UP                                                 │
│    ┌──────────────────────────────────────────┐             │
│    │ Set dragging = Nothing                   │             │
│    │ Update status message                    │             │
│    └──────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## Coordinate Systems

```
Page Coordinates (MouseMove)          Canvas Coordinates (MouseDown)
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ Browser window              │      │ Canvas element              │
│                             │      │                             │
│  (pageX, pageY)             │      │  (offsetX, offsetY)         │
│       ↓                     │      │       ↓                     │
│       •                     │      │       •                     │
│                             │      │                             │
│  Used for: delta movement   │      │  Used for: hit testing      │
│  in MouseMove handler       │      │  in MouseDown handler       │
└─────────────────────────────┘      └─────────────────────────────┘

Conversion:
  timeFromCanvasX = offsetX / pixelsPerSecond
  timeFromDeltaX  = deltaX / pixelsPerSecond
```

## Snap-to-Grid Visualization

```
Timeline with 0.5s grid intervals:
┌─────────────────────────────────────────────────────────────┐
│  0.0   0.5   1.0   1.5   2.0   2.5   3.0   3.5   4.0  (sec) │
│   │     │     │     │     │     │     │     │     │         │
│   ·     ·     ·     ·     ·     ·     ·     ·     ·         │ ← Grid lines
│                           ◉                                 │ ← Playhead
│                           │                                 │
│                      Snaps to: 2.0s                         │
│                      (not 1.87s, 2.13s, etc.)               │
└─────────────────────────────────────────────────────────────┘

snapToGrid formula:
  snappedTime = round(time / 0.5) * 0.5

Examples:
  1.23s → 1.0s
  1.37s → 1.5s
  1.76s → 2.0s
  2.24s → 2.0s
  2.26s → 2.5s
```

## State Transitions

```
┌────────────────────────────────────────────────────────────────┐
│ DragTarget State Machine                                      │
│                                                                │
│           ┌─────────────┐                                      │
│   START → │   Nothing   │ ← MouseUp (any drag)                │
│           └──────┬──────┘                                      │
│                  │                                             │
│      ┌───────────┼───────────┐                                │
│      │           │           │                                 │
│   MouseDown  MouseDown   MouseDown                            │
│  (playhead)  (clip)     (timeline)                            │
│      │           │           │                                 │
│      ▼           ▼           │                                 │
│  ┌──────────┐ ┌──────────┐  │                                 │
│  │ Dragging │ │ Dragging │  │                                 │
│  │ Playhead │ │   Clip   │  │                                 │
│  └──────────┘ └──────────┘  │                                 │
│      │           │           │                                 │
│      └───────────┴───────────┘                                 │
│                  │                                             │
│               MouseUp                                          │
│                  │                                             │
│                  ▼                                             │
│           ┌─────────────┐                                      │
│           │   Nothing   │                                      │
│           └─────────────┘                                      │
└────────────────────────────────────────────────────────────────┘
```

## Cursor States

```
┌─────────────────────────────────────────────────────────────┐
│ Cursor Feedback                                             │
│                                                             │
│ State: Nothing                                              │
│ Cursor: pointer  👆                                         │
│                                                             │
│ State: DraggingPlayhead                                     │
│ Cursor: grabbing ✊                                          │
│                                                             │
│ State: DraggingClip                                         │
│ Cursor: grabbing ✊                                          │
└─────────────────────────────────────────────────────────────┘
```

## Event Flow Example

```
User Action Sequence:
1. Move mouse over playhead handle
   → Cursor: pointer

2. Click down on playhead handle (at X=156px, Y=12px)
   → isPlayheadHandleClick(156, 12, model) = True
   → Set dragging = Just DraggingPlayhead
   → Cursor: grabbing
   → Status: "Dragging playhead"

3. Move mouse to X=220px (delta = +64px)
   → deltaX = 220 - 156 = 64px
   → deltaTime = 64px / 10pps = 6.4s
   → newPlayhead = 0.0s + 6.4s = 6.4s
   → snappedPlayhead = 6.5s (rounds to nearest 0.5s)
   → model.playhead = 6.5s
   → Send: setVideoTime 6.5
   → Video seeks to 6.5s

4. Move mouse to X=280px (delta = +60px)
   → deltaX = 280 - 220 = 60px
   → deltaTime = 60px / 10pps = 6.0s
   → newPlayhead = 6.5s + 6.0s = 12.5s
   → snappedPlayhead = 12.5s
   → model.playhead = 12.5s
   → Send: setVideoTime 12.5
   → Video seeks to 12.5s

5. Release mouse button
   → Set dragging = Nothing
   → Cursor: pointer
   → Status: "Playhead at 0:12"
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│ Operation                    │ Time Complexity │ Notes       │
├──────────────────────────────┼─────────────────┼─────────────┤
│ Hit testing playhead         │ O(1)            │ Simple math │
│ Snap to grid                 │ O(1)            │ Round+mult  │
│ Clamp playhead               │ O(1)            │ Min/max     │
│ Update playhead position     │ O(1)            │ Record upd  │
│ Send video seek command      │ O(1)            │ Port call   │
│ Render playhead              │ O(1)            │ 3 shapes    │
├──────────────────────────────┼─────────────────┼─────────────┤
│ Total per MouseMove event    │ O(1)            │ Constant!   │
└─────────────────────────────────────────────────────────────┘

Memory Usage:
  - No additional allocations during drag
  - Reuses existing mousePos tuple
  - Video seek command is fire-and-forget
```

## Integration with Existing Features

```
┌─────────────────────────────────────────────────────────────┐
│ Feature Interaction Matrix                                 │
├─────────────────────────────┬───────────────────────────────┤
│ Clip Dragging               │ ✅ Independent                │
│                             │    Different DragTarget variant│
├─────────────────────────────┼───────────────────────────────┤
│ Timeline Clicking           │ ✅ Compatible                 │
│                             │    Priority: playhead > click │
├─────────────────────────────┼───────────────────────────────┤
│ Video Playback              │ ✅ Synchronized               │
│                             │    setVideoTime during drag   │
├─────────────────────────────┼───────────────────────────────┤
│ Zoom In/Out                 │ ✅ Works Correctly            │
│                             │    pixelsPerSecond adapts     │
├─────────────────────────────┼───────────────────────────────┤
│ Grid Snapping               │ ✅ Applied                    │
│                             │    0.5s intervals             │
├─────────────────────────────┼───────────────────────────────┤
│ Video Time Updates          │ ✅ Non-conflicting            │
│                             │    Only updates when not drag │
└─────────────────────────────┴───────────────────────────────┘
```
