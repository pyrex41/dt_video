## Elm Frontend PRD

### Objective
Build a fast, responsive Elm frontend for ClipForge, using `elm-canvas` for a canvas-based timeline, Elm's built-in state management for the Elm Architecture (Model-View-Update), and a custom video player for preview. Integrate with the Tauri Rust backend to deliver a trim-only editor MVP and add recording and multi-track features for the final submission.

### Scope
- **MVP**: Video import (drag-and-drop/file picker), single-track elm-canvas timeline (draggable clips, playhead), trim functionality, MP4 export, basic UI with Tailwind CSS styling.
- **Final Submission**: Webcam capture (`nokhwa` via backend), screen recording (`getDisplayMedia`), two-track timeline, clip splitting, zoom, snap-to-grid.
- **Out of Scope**: Real-time effects, transitions, text overlays, audio waveforms, undo/redo.

### Requirements
#### MVP
1. **App UI**:
   - Basic layout with import button, timeline, and preview pane.
   - Responsive design (800x600 minimum) using Tailwind CSS utility classes.
2. **Video Import**:
   - Support drag-and-drop and file picker for MP4/MOV.
   - Display clip metadata (duration, resolution).
3. **Timeline**:
   - elm-canvas with draggable shapes for clips, line for playhead.
   - Single track, basic drag (no snap-to-grid).
   - Virtualized rendering (only visible clips).
4. **Preview**:
   - Custom Elm video player for playback, synced with timeline playhead.
   - Play/pause controls, scrubbing via playhead drag.
5. **Trim**:
   - Drag handles on clips for in/out points.
   - Invoke backend `trim_clip` command.
6. **Export**:
   - Export single clip to MP4 (720p) via `export_video` command.
   - Show progress bar using backend stderr events.

#### Final Submission
1. **Recording**:
   - Webcam capture button invoking `record_webcam_clip`.
   - Screen recording via `getDisplayMedia`, saved via `save_recording`.
   - Add recordings to timeline.
2. **Timeline Enhancements**:
   - Two tracks (main + picture-in-picture).
   - Split clips at playhead position.
   - Zoom in/out (canvas scaling).
   - Snap-to-grid for clip drags.
3. **Performance**:
   - 30fps timeline with 10+ clips.
   - No memory leaks in 15-minute sessions.
   - Responsive UI during export.

### Technical Stack
- **Elm**: v0.19 for functional UI with Elm Architecture.
- **Vite**: For fast development and bundling with HMR.
- **vite-plugin-elm**: To compile Elm files within Vite.
- **elm-canvas**: For canvas-based timeline rendering.
- **Tailwind CSS**: For utility-first styling and responsive design.
- **Custom Video Player**: Elm port to JavaScript video element for preview.
- **@tauri-apps/api**: v1.7 for backend commands via Elm ports.
- **V0.dev**: Generate initial timeline component (adapted for Elm).

### Implementation Details
- **Setup**:
  ```bash
  cd clipforge/src-tauri/frontend
  pnpm add -D vite-plugin-elm tailwindcss postcss autoprefixer
  npx tailwindcss init -p
  elm install elm/canvas
  pnpm add @tauri-apps/api
  ```
  Update `tailwind.config.js`:
  ```js
  export default {
    content: ['./src/**/*.elm', './index.html'],
    theme: {
      extend: {},
    },
    plugins: [],
  }
  ```
  Create `src/index.css`:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
  Update `vite.config.js`:
  ```js
  import { defineConfig } from 'vite'
  import elmPlugin from 'vite-plugin-elm'

  export default defineConfig({
    plugins: [elmPlugin()],
    // Tauri-specific config if needed
  })
  ```
- **Main Entry**:
  In `src/main.js` (or equivalent):
  ```js
  import './index.css'  // Import Tailwind styles
  import { Elm } from './Main.elm'

  Elm.Main.init({
    node: document.getElementById('root'),
    flags: null
  })
  ```
  Elm code goes in `src/Main.elm` following the Elm Architecture.
- **State Management (Elm Architecture)**:
  ```elm
  type alias Model =
      { clips : List Clip
      , playhead : Float
      }

  type Msg
      = AddClip Clip
      | UpdateClip String ClipUpdates
      | SetPlayhead Float

  update : Msg -> Model -> (Model, Cmd Msg)
  update msg model =
      case msg of
          AddClip clip ->
              ({ model | clips = clip :: model.clips }, Cmd.none)

          UpdateClip id updates ->
              ({ model | clips = List.map (updateClip id updates) model.clips }, Cmd.none)

          SetPlayhead time ->
              ({ model | playhead = time }, Cmd.none)
  ```
- **Import UI**:
  ```elm
  import Html exposing (button, text, div)
  import Html.Attributes exposing (class)
  import Html.Events exposing (onClick)

  viewImport : Model -> Html Msg
  viewImport model =
      div [ class "flex items-center justify-center p-4" ]
          [ button
              [ class "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              , onClick RequestImport
              ]
              [ text "Import Video" ]
          ]

  -- Port for file picker
  port requestImport : () -> Cmd msg
  ```
- **Timeline**:
  ```elm
  import Canvas exposing (Shape, rect, line)
  import Color

  viewTimeline : Model -> Html Msg
  viewTimeline model =
      Canvas.toHtml (800, 200) []
          [ Canvas.shapes []
              (List.map viewClip model.clips ++ [viewPlayhead model.playhead])
          ]

  viewClip : Clip -> Shape
  viewClip clip =
      rect (clip.start * 10, 50) (clip.end * 10, 90)
          |> Canvas.fill Color.blue
          |> Canvas.onDrag (UpdateClip clip.id)

  viewPlayhead : Float -> Shape
  viewPlayhead time =
      line (time * 10, 0) (time * 10, 200)
          |> Canvas.stroke Color.red 2
  ```
- **Preview**:
  ```elm
  -- Port to JavaScript video element
  port setVideoTime : Float -> Cmd msg

  viewPreview : Model -> Html Msg
  viewPreview model =
      Html.video
          [ Html.Attributes.src (Maybe.withDefault "" (List.head model.clips |> Maybe.map .path))
          , Html.Attributes.controls True
          ]
          []

  updatePreview : Model -> Cmd Msg
  updatePreview model =
      setVideoTime model.playhead
  ```
- **Trim**:
  ```elm
  viewTrimHandles : Clip -> List Shape
  viewTrimHandles clip =
      [ rect (clip.start * 10, 50) (clip.start * 10 + 10, 90)
          |> Canvas.fill Color.green
          |> Canvas.onDrag (UpdateClip clip.id << SetStart)
      , rect (clip.end * 10 - 10, 50) (clip.end * 10, 90)
          |> Canvas.fill Color.green
          |> Canvas.onDrag (UpdateClip clip.id << SetEnd)
      ]

  -- Port to invoke backend
  port trimClip : { input : String, output : String, start : Float, end : Float } -> Cmd msg
  ```
- **Export**:
  ```elm
  viewExport : Model -> Html Msg
  viewExport model =
      button [ onClick (ExportVideo model.clips) ] [ text "Export" ]

  -- Port to invoke backend
  port exportVideo : { inputs : List String, output : String, resolution : String } -> Cmd msg
  ```
- **Recording**:
  ```elm
  viewRecording : Html Msg
  viewRecording =
      Html.div []
          [ button [ onClick RecordWebcam ] [ text "Record Webcam" ]
          , button [ onClick RecordScreen ] [ text "Record Screen" ]
          ]

  -- Ports for recording
  port recordWebcam : { output : String, duration : Int } -> Cmd msg
  port saveRecording : { path : String, data : List Int } -> Cmd msg
  ```

### Deliverables
- Elm frontend code in `src-tauri/frontend/`.
- Demo video showing import, timeline, trim, export, and recording.
- UI styled with Tailwind CSS utility classes.