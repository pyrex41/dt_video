## React Frontend PRD

### Objective
Build a fast, responsive Preact (React-compatible) frontend for ClipForge, using `react-konva` for a canvas-based timeline, `Zustand` for state management, and `Plyr` for video preview. Integrate with the Tauri Rust backend to deliver a trim-only editor MVP and add recording and multi-track features for the final submission.

### Scope
- **MVP**: Video import (drag-and-drop/file picker), single-track Konva.js timeline (draggable clips, playhead), trim functionality, MP4 export, basic UI with `shadcn/ui`.
- **Final Submission**: Webcam capture (`nokhwa` via backend), screen recording (`getDisplayMedia`), two-track timeline, clip splitting, zoom, snap-to-grid.
- **Out of Scope**: Real-time effects, transitions, text overlays, audio waveforms, undo/redo.

### Requirements
#### MVP
1. **App UI**:
   - Basic layout with import button, timeline, and preview pane.
   - Responsive design (800x600 minimum) using `shadcn/ui`.
2. **Video Import**:
   - Support drag-and-drop and file picker for MP4/MOV.
   - Display clip metadata (duration, resolution).
3. **Timeline**:
   - Konva.js canvas with draggable `Rect` for clips, `Line` for playhead.
   - Single track, basic drag (no snap-to-grid).
   - Virtualized rendering (only visible clips).
4. **Preview**:
   - Plyr player for video playback, synced with timeline playhead.
   - Play/pause controls, scrubbing via playhead drag.
5. **Trim**:
   - Drag handles (`Rect`) on clips for in/out points.
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
   - Zoom in/out (stage scaling).
   - Snap-to-grid for clip drags.
3. **Performance**:
   - 30fps timeline with 10+ clips.
   - No memory leaks in 15-minute sessions.
   - Responsive UI during export.

### Technical Stack
- **Preact**: v10 for component-based UI (React-compatible).
- **react-konva**: v18 for canvas-based timeline.
- **Zustand**: v4 for lightweight state management.
- **Plyr**: v3 for video preview (15KB, keyboard shortcuts).
- **shadcn/ui**: For UI components (buttons, dialogs).
- **@tauri-apps/api**: v1.7 for backend commands.
- **V0.dev**: Generate initial timeline component.

### Implementation Details
- **Setup**:
  ```bash
  cd clipforge/src-tauri/frontend
  npm install react-konva konva zustand plyr @tauri-apps/api
  npx create-tauri-ui --template shadcn
  ```
- **State Management (Zustand)**:
  ```jsx
  import { create } from 'zustand';

  const useClipStore = create((set) => ({
    clips: [],
    addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
    updateClip: (id, updates) => set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
    playhead: 0,
    setPlayhead: (time) => set({ playhead: time }),
  }));
  ```
- **Import UI**:
  ```jsx
  import { open } from '@tauri-apps/api/dialog';
  import { invoke } from '@tauri-apps/api/tauri';
  import { useClipStore } from './store';

  const ImportButton = () => {
    const addClip = useClipStore((state) => state.addClip);
    const handleImport = async () => {
      const file = await open({ filters: [{ name: 'Video', extensions: ['mp4', 'mov'] }] });
      if (file) {
        const metadata = await invoke('import_file', { path: file, dest: `clips/${file.split('/').pop()}` });
        addClip({ id: Date.now(), path: file, ...JSON.parse(metadata) });
      }
    };
    return <button onClick={handleImport}>Import Video</button>;
  };
  ```
- **Timeline**:
  ```jsx
  import { Stage, Layer, Rect, Line } from 'react-konva';
  import { useClipStore } from './store';

  const Timeline = () => {
    const { clips, updateClip, playhead, setPlayhead } = useClipStore();
    return (
      <Stage width={800} height={200}>
        <Layer>
          {clips.map((clip) => (
            <Rect
              key={clip.id}
              x={clip.start * 10}
              y={50}
              width={(clip.end - clip.start) * 10}
              height={40}
              fill="blue"
              draggable
              onDragEnd={(e) => updateClip(clip.id, { start: e.target.x() / 10, end: e.target.x() / 10 + (clip.end - clip.start) })}
            />
          ))}
          <Line points={[playhead * 10, 0, playhead * 10, 200]} stroke="red" strokeWidth={2} />
        </Layer>
      </Stage>
    );
  };
  ```
- **Preview**:
  ```jsx
  import Plyr from 'plyr';
  import { useEffect, useRef } from 'react';
  import { useClipStore } from './store';

  const Preview = () => {
    const { clips, playhead } = useClipStore();
    const videoRef = useRef(null);
    useEffect(() => {
      const player = new Plyr(videoRef.current);
      player.currentTime = playhead;
      return () => player.destroy();
    }, [playhead]);
    return <video ref={videoRef} src={clips[0]?.path} controls />;
  };
  ```
- **Trim**:
  ```jsx
  const TrimHandle = ({ clip }) => {
    const updateClip = useClipStore((state) => state.updateClip);
    return (
      <>
        <Rect
          x={clip.start * 10}
          y={50}
          width={10}
          height={40}
          fill="green"
          draggable
          onDragEnd={(e) => {
            updateClip(clip.id, { start: e.target.x() / 10 });
            invoke('trim_clip', { input: clip.path, output: `clips/trimmed_${clip.id}.mp4`, start: e.target.x() / 10, end: clip.end });
          }}
        />
        <Rect
          x={clip.end * 10 - 10}
          y={50}
          width={10}
          height={40}
          fill="green"
          draggable
          onDragEnd={(e) => {
            updateClip(clip.id, { end: e.target.x() / 10 + 10 });
            invoke('trim_clip', { input: clip.path, output: `clips/trimmed_${clip.id}.mp4`, start: clip.start, end: e.target.x() / 10 + 10 });
          }}
        />
      </>
    );
  };
  ```
- **Export**:
  ```jsx
  const ExportButton = () => {
    const clips = useClipStore((state) => state.clips);
    const handleExport = async () => {
      await invoke('export_video', { inputs: clips.map(c => c.path), output: 'output.mp4', resolution: '1280x720' });
    };
    return <button onClick={handleExport}>Export</button>;
  };
  ```
- **Recording**:
  ```jsx
  import { invoke } from '@tauri-apps/api/tauri';
  import { useClipStore } from './store';

  const RecordButton = () => {
    const addClip = useClipStore((state) => state.addClip);
    const handleWebcam = async () => {
      const output = await invoke('record_webcam_clip', { output: 'clips/webcam.mp4', duration: 10 });
      addClip({ id: Date.now(), path: output, start: 0, end: 10 });
    };
    const handleScreen = async () => {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        await invoke('save_recording', { path: 'clips/screen.webm', data });
        addClip({ id: Date.now(), path: 'clips/screen.webm', start: 0, end: 10 });
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 10000);
    };
    return (
      <>
        <button onClick={handleWebcam}>Record Webcam</button>
        <button onClick={handleScreen}>Record Screen</button>
      </>
    );
  };
  ```

### Deliverables
- Preact frontend code in `clipforge/src/`.
- Demo video showing import, timeline, trim, export, and recording.
- UI built with `shadcn/ui` components.