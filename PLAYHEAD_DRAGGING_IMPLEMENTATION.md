# Playhead Dragging Implementation

## Summary

Successfully implemented draggable playhead functionality for the ClipForge video editor timeline. The playhead can now be clicked and dragged to scrub through the video, with visual feedback and snap-to-grid behavior.

## Implementation Details

### 1. Extended DragTarget Type

**File:** `/Users/reuben/gauntlet/dt_video/clipforge/src-tauri/frontend/src/Main.elm`

```elm
type DragTarget
    = DraggingClip String Float  -- clipId, offsetX (in pixels from clip start)
    | DraggingPlayhead           -- Dragging the playhead handle
```

Added `DraggingPlayhead` variant to distinguish playhead dragging from clip dragging.

### 2. Playhead Handle Hit Testing

Added `isPlayheadHandleClick` helper function:

```elm
isPlayheadHandleClick : Float -> Float -> Model -> Bool
isPlayheadHandleClick x y model =
    let
        playheadX =
            model.playhead * model.pixelsPerSecond

        handleSize =
            12  -- pixels (radius of hit area)

        handleTopY =
            0  -- Top of canvas

        handleBottomY =
            40  -- Extended hit area at top
    in
    abs (x - playheadX) < handleSize && y >= handleTopY && y < handleBottomY
```

This creates a 24px-wide by 40px-tall hit area at the top of the playhead for easy clicking.

### 3. Updated Mouse Handlers

#### MouseDown Priority System:
1. **Priority 1:** Check playhead handle
2. **Priority 2:** Check clips
3. **Priority 3:** Timeline click (set playhead position)

```elm
MouseDown canvasX canvasY ->
    -- Priority 1: Check if clicking on playhead handle
    if isPlayheadHandleClick canvasX canvasY model then
        ( { model
            | dragging = Just DraggingPlayhead
            , statusMessage = "Dragging playhead"
          }
        , Cmd.none
        )
    -- Priority 2: Check if mouse is clicking on a clip
    else
        case findClipAtPosition canvasX canvasY model of
            -- ... handle clip dragging
            Nothing ->
                -- Priority 3: Timeline click
```

#### MouseMove - Playhead Dragging:

```elm
Just DraggingPlayhead ->
    let
        ( oldX, oldY ) = model.mousePos
        deltaX = pageX - oldX

        -- Calculate new playhead position
        newPlayhead = model.playhead + (deltaX / model.pixelsPerSecond)

        -- Apply snap-to-grid
        snappedPlayhead = snapToGrid newPlayhead

        -- Clamp to valid range [0, maxTime]
        maxTime = getTimelineDuration model
        clampedPlayhead = clamp 0 maxTime snappedPlayhead
    in
    ( { model
        | playhead = clampedPlayhead
        , mousePos = ( pageX, pageY )
      }
    , setVideoTime clampedPlayhead  -- Seek video during drag
    )
```

#### MouseUp - Complete Drag:

```elm
Just DraggingPlayhead ->
    ( { model
        | dragging = Nothing
        , statusMessage = "Playhead at " ++ formatDuration model.playhead
      }
    , Cmd.none
    )
```

### 4. Visual Playhead Handle

Enhanced `renderPlayhead` function to include a draggable handle:

```elm
renderPlayhead : Float -> Float -> Float -> Renderable
renderPlayhead time pixelsPerSecond canvasHeight =
    let
        x = time * pixelsPerSecond
        handleRadius = 6
        handleY = 20  -- Center of handle, positioned at top
    in
    Canvas.group []
        [ -- Playhead line (vertical red line)
          Canvas.shapes
            [ stroke (Color.rgb 1.0 0.2 0.2), lineWidth 2 ]
            [ Canvas.path ( x, 0 ) [ Canvas.lineTo ( x, canvasHeight ) ] ]
        , -- Playhead handle (red circle at top)
          Canvas.shapes
            [ fill (Color.rgb 1.0 0.2 0.2) ]
            [ Canvas.circle ( x, handleY ) handleRadius ]
        , -- Handle outline (white border for visibility)
          Canvas.shapes
            [ stroke (Color.rgb 1.0 1.0 1.0), lineWidth 1.5 ]
            [ Canvas.circle ( x, handleY ) handleRadius ]
        ]
```

### 5. Cursor Feedback

Updated cursor styles to provide visual feedback:

```elm
style "cursor"
    (case model.dragging of
        Just DraggingPlayhead ->
            "grabbing"
        Just (DraggingClip _ _) ->
            "grabbing"
        Nothing ->
            "pointer"
    )
```

### 6. Pattern Matching Completeness

Fixed `renderClip` function to handle all `DragTarget` cases:

```elm
isBeingDragged =
    case draggingState of
        Just (DraggingClip clipId _) ->
            clip.id == clipId

        Just DraggingPlayhead ->
            False

        Nothing ->
            False
```

## Features Implemented

✅ **Draggable Playhead Handle**
- Visible red circle at top of playhead line
- White outline for better visibility
- 12px radius hit area (24px wide × 40px tall)

✅ **Smooth Dragging**
- Delta-based position calculation
- Snap-to-grid (0.5s intervals)
- Clamped to valid range [0, timeline end]

✅ **Video Synchronization**
- Calls `setVideoTime` during drag
- Video seeks in real-time as playhead moves
- Status message shows current playhead time

✅ **Visual Feedback**
- Cursor changes to "grabbing" during drag
- Status message: "Dragging playhead" → "Playhead at MM:SS"
- Clear visual handle at top of playhead

✅ **Priority System**
- Playhead handle checked before clips
- Prevents accidental clip dragging when clicking playhead
- Timeline clicks still work in empty areas

## Behavior

1. **Click and Hold** on playhead handle (red circle at top)
2. **Drag Left/Right** to scrub through timeline
3. Playhead **snaps to 0.5s grid** intervals
4. Video **seeks in real-time** during drag
5. **Release** to complete drag

## Performance Considerations

- **Efficient Dragging:** Uses delta-based calculation (no repeated hit testing)
- **Video Seeking:** Sends `setVideoTime` port command on each drag update
  - Note: Consider debouncing if video seeking becomes laggy
- **Snap-to-Grid:** Applied during drag for smooth scrubbing
- **Bounds Checking:** Playhead clamped to [0, timeline duration]

## Future Enhancements (Optional)

1. **Debounced Video Seeking:**
   - Only seek every 100ms during fast dragging
   - Would reduce load on video element

2. **Visual Feedback:**
   - Make playhead line thicker during drag
   - Add time tooltip following cursor during drag

3. **Hover State:**
   - Change cursor to "grab" when hovering over handle
   - Highlight handle on hover

4. **Keyboard Support:**
   - Arrow keys to nudge playhead
   - Shift+arrow for larger jumps

## Testing

✅ Elm code compiles successfully
✅ All pattern matches are exhaustive
✅ Type safety maintained throughout

## Files Modified

- `/Users/reuben/gauntlet/dt_video/clipforge/src-tauri/frontend/src/Main.elm`

## Lines of Code Changed

- Added: ~80 lines
- Modified: ~30 lines
- Total impact: ~110 lines

## Functional Programming Principles Applied

1. **Pure Functions:** All helper functions are pure (no side effects)
2. **Type Safety:** Exhaustive pattern matching on all variants
3. **Immutability:** Model updates through record updates, not mutation
4. **Composition:** Small, focused functions composed together
5. **Explicit Effects:** Video seeking isolated to port commands
6. **Clear Data Flow:** Model → View → Update cycle maintained
