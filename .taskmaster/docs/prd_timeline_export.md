# PRD: Timeline & Export Features
**Version**: 1.2 | **Updated**: Oct 29, 2025 | **Status**: Active

---

## Current State & Goals

**What Works**: Timeline with trim handles, zoom controls, basic export (simulated progress)
**What's Missing**: Multi-track UI, clip split/delete, multi-clip preview, real FFmpeg progress, keyboard shortcuts

**Goal**: Professional timeline editor with multi-track support and seamless export.

**Overall Completion**: ~18%

| Phase | Status | % | Key Gaps |
|-------|--------|---|----------|
| Multi-Track | ❌ | 0% | UI doesn't render tracks (data model ready) |
| Clip Ops | ❌ | 0% | No split/delete UI or shortcuts |
| Multi-Clip Preview | ❌ | 0% | Only shows single clip at playhead |
| Timeline Polish | ⚠️ | 60% | Missing: snap, multi-select |
| Export | ⚠️ | 50% | Simulated progress, no cancel |
| Transitions | ❌ | 0% | Stretch goal |

---

## 🐛 Critical Bugs (Fix First!)

### BUG-1: Jumpy Drag Performance
- **Issue**: Clips/playhead/trim handles jump during drag
- **Files**: timeline.tsx (drag handlers lines 199-327)
- **Fix**: Check isDraggingRef, prevent re-renders during drag

### BUG-2: Playhead Seek During Playback
- **Issue**: Clicking timeline doesn't seek when video playing
- **Files**: timeline.tsx:334-340, preview.tsx:144-168
- **Fix**: Allow seek regardless of isPlaying state

### BUG-3: Play/Pause Sync Issues
- **Issue**: External controls don't consistently pause video
- **Files**: controls.tsx:31-33, preview.tsx:79-80, 163-167
- **Fix**: Sync isPlaying state with Plyr reliably

### Missing Keyboard Shortcuts (Required)
- `Space` → Play/Pause
- `Delete`/`Backspace` → Delete selected clip
- `Escape` → Deselect
- `Cmd+A`/`Ctrl+A` → Select all

**Implementation**: Global keyboard listener in App.tsx, check activeElement

---

## Requirements

### 1. Multi-Track Timeline
**Priority**: Critical | **Status**: ❌ Data model ready, UI not implemented

**What's Needed**:
- [ ] 2+ visual track lanes (separate lines like Premiere Pro)
- [ ] Drag clips between tracks
- [ ] Track labels, adjustable height
- [ ] Preview composites multiple tracks (top overlays bottom)
- [ ] **Auto-handle overlaps**: Prompt user when clips overlap on same track
- [ ] **Overlap visualization**: Show when clips on different tracks overlap

**Technical**:
- ✅ Clip has `track` field (types/clip.ts:8)
- ❌ Timeline.tsx only renders one lane (lines 72-81)
- Need: Loop over tracks, render lanes with Y-offset per track

---

### 2. Clip Operations
**Priority**: High | **Status**: ❌ Methods exist, no UI

**What's Needed**:
- [ ] Split clip at playhead
- [ ] Delete with keyboard shortcuts
- [ ] Context menu (right-click)
- [ ] Undo support

**Technical**:
- Store has `deleteClip()`, `removeClip()` (use-clip-store.ts:20,62)
- Need: UI buttons, keyboard handler, split logic

---

### 3. Multi-Clip Preview
**Priority**: Critical | **Status**: ❌ Single clip only

**What's Needed**:
- [ ] Seamless playback across clip boundaries
- [ ] Pre-load adjacent clips
- [ ] No loading delays between clips
- [ ] Handle different resolutions

**Technical**:
- Current: `clips.find(clip => playhead >= start && < end)` (preview.tsx:18)
- Need: Detect next clip, buffer switching, maintain playback

---

### 4. Timeline Enhancements
**Priority**: Medium | **Status**: ⚠️ Partial (60%)

**What's Needed**:
- [ ] **Snap-to-grid** (configurable intervals)
- [ ] **Snap-to-clip edges** (align clips)
- [ ] **Snap-to-trim boundaries** (snap to other clips' trim points)
- [ ] Multi-select clips
- [x] Zoom controls ✅
- [x] Time ruler ✅

**Implementation**:
- Snap threshold: ~0.1s in timeline units
- Detect nearby snap points in drag handlers
- Show visual snap guides

---

### 5. Export Enhancements
**Priority**: High | **Status**: ⚠️ Partial (50%)

**What's Needed**:
- [ ] **Real FFmpeg progress** (parse stderr, not simulated)
- [ ] Cancel export functionality
- [ ] More resolutions (source, 480p, 4K - not just 720p/1080p)
- [ ] Quality presets (fast/balanced/high)
- [ ] Time remaining estimate
- [x] Progress bar ✅ (simulated)
- [x] Success notification ✅

**Technical**:
- Parse FFmpeg stderr: `frame=123 fps=30 time=00:00:05`
- Emit Tauri events for progress updates
- Add process termination for cancel

---

### 6. Transitions (Stretch Goal)
**Priority**: Low | **Status**: ❌

- [ ] Fade, crossfade, slide, wipe
- [ ] Duration controls
- [ ] FFmpeg xfade filter

*See prd_stretch_goals.md for details*

---

## Implementation Plan

### Phase 1: Fix Bugs (2-3 hours) ← START HERE
1. Fix jumpy drag performance
2. Fix playhead seek during playback
3. Fix play/pause sync issues
4. Add keyboard shortcuts (Space, Delete, Escape, Cmd+A)

### Phase 2: Multi-Track UI (4-5 hours)
1. Render multiple track lanes in timeline
2. Drag clips between tracks
3. Track controls (labels, height)
4. Overlap detection/handling

### Phase 3: Clip Operations (3-4 hours)
1. Split at playhead
2. Delete with UI/shortcuts
3. Context menu
4. Undo middleware

### Phase 4: Multi-Clip Preview (4-5 hours)
1. Detect clip transitions
2. Pre-load adjacent clips
3. Seamless playback switching
4. Multi-track compositing

### Phase 5: Timeline Polish (2-3 hours)
1. Snap-to-grid/edges/trim
2. Multi-select
3. Visual feedback

### Phase 6: Export Polish (3-4 hours)
1. Real FFmpeg progress parsing
2. Cancel functionality
3. More resolution/quality options

---

## Success Criteria

**Core (Must Have)**:
- [ ] All critical bugs fixed (smooth drag, playhead seek, play/pause sync)
- [ ] Keyboard shortcuts working
- [ ] Multi-track timeline with 2+ lanes
- [ ] Clip split/delete operations
- [ ] Multi-clip preview playback
- [ ] Real export progress (not simulated)

**Polish (Should Have)**:
- [ ] Snap-to-grid/edges/trim
- [ ] Cancel export
- [ ] Multi-select clips
- [ ] More export options

---

## Key Files

- `clipforge/src/components/timeline.tsx` - Timeline canvas & interactions
- `clipforge/src/components/preview.tsx` - Video preview & playback
- `clipforge/src/components/controls.tsx` - Play/pause/zoom controls
- `clipforge/src/components/export-button.tsx` - Export UI & progress
- `clipforge/src/store/use-clip-store.ts` - State management
- `clipforge/src/types/clip.ts` - Data model

---

**End of PRD**
