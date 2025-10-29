# Product Requirements Document: MVP Completion & Core Gaps
**Date**: October 28, 2025
**Version**: 1.0
**Status**: Active

---

## Overview

This PRD outlines the critical tasks required to achieve the MVP deadline (Tuesday, October 28th, 10:59 PM CT). The MVP requires a packaged desktop app with basic import, timeline, preview, trim, and export functionality. Current implementation is ~70% complete, with gaps primarily in packaging, testing, and minor UI polish.

**Goal**: Deliver a working, packaged video editor that passes all MVP requirements by the hard deadline.

**Scope**: Focus on finalizing existing features rather than adding new ones. Ensure the app builds, packages, and runs reliably on target platforms (Mac/Windows).

---

## Requirements

### 1. Packaging & Distribution
**Priority**: Critical
**Description**: Ensure the app can be built and distributed as a native desktop application, not just dev mode.

**Acceptance Criteria**:
- [ ] `pnpm tauri build` completes successfully on Mac
- [ ] `pnpm tauri build` completes successfully on Windows (if available)
- [ ] FFmpeg binaries downloaded and bundled (`binaries/download.sh`)
- [ ] Generated `.dmg` (Mac) or `.exe` (Windows) launches and functions
- [ ] App icon displays correctly in dock/taskbar
- [ ] No runtime errors on clean system (test on VM if possible)

**Technical Details**:
- Run `cd clipforge/src-tauri/binaries && ./download.sh` to get FFmpeg binaries
- Verify `tauri.conf.json` externalBin paths are correct
- Test launch time < 5 seconds
- Bundle size reasonable (< 200MB with FFmpeg)

### 2. MVP Feature Verification
**Priority**: Critical
**Description**: Confirm all MVP requirements are met and functional.

**Acceptance Criteria**:
- [ ] Desktop app launches (Tauri framework)
- [ ] Video import works (file picker for MP4/MOV)
- [ ] Timeline displays imported clips visually
- [ ] Preview player plays clips correctly
- [ ] Basic trim functionality (in/out points on single clip)
- [ ] Export to MP4 (single clip minimum)
- [ ] All features work in packaged app (not just dev mode)

**Technical Details**:
- Test import → timeline → preview → trim → export workflow
- Verify FFmpeg commands (`check_ffmpeg`, `import_file`, `trim_clip`, `export_video`)
- Check error handling (invalid files, missing FFmpeg)
- Confirm UI responsiveness with 3-5 clips

### 3. UI/UX Polish for MVP
**Priority**: High
**Description**: Address basic usability issues that could prevent MVP acceptance.

**Acceptance Criteria**:
- [ ] Clear error messages for failed operations
- [ ] Loading states during import/export
- [ ] Consistent styling across components
- [ ] Keyboard navigation basics (tab order)
- [ ] Tooltips for unclear UI elements
- [ ] Responsive layout (doesn't break on resize)

**Technical Details**:
- Add loading spinners to ImportButton/ExportButton
- Improve error display in Alert components
- Ensure timeline canvas resizes properly
- Add basic help text or onboarding

### 4. Performance & Stability Testing
**Priority**: High
**Description**: Verify the app meets basic performance targets and doesn't crash.

**Acceptance Criteria**:
- [ ] No crashes during 10-minute editing session
- [ ] Timeline remains responsive with 5+ clips
- [ ] Preview playback smooth (no stuttering)
- [ ] Memory usage stable (no obvious leaks)
- [ ] Export completes without hanging

**Technical Details**:
- Test with various video formats/sizes
- Monitor console for errors/warnings
- Check FFmpeg process cleanup
- Verify Tauri app lifecycle (minimize/restore)

---

## Technical Architecture

### Current Stack
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Tauri (Rust) + FFmpeg sidecar
- **Timeline**: Fabric.js canvas
- **Video Player**: Plyr
- **State**: Zustand

### Dependencies
- FFmpeg binaries (external, downloaded separately)
- Tauri CLI for building
- Node.js/npm for frontend build

### File Structure
```
clipforge/
├── src-tauri/
│   ├── binaries/          # FFmpeg binaries (download required)
│   ├── src/lib.rs         # Tauri commands
│   └── tauri.conf.json    # Build config
├── src/
│   ├── components/        # React components
│   ├── store/            # Zustand state
│   └── types/            # TypeScript interfaces
└── dist/                 # Built frontend
```

---

## Implementation Plan

### Phase 1: Packaging Setup (2-3 hours)
1. Download FFmpeg binaries for target platforms
2. Test build process on development machine
3. Verify bundle contents and executable
4. Test on clean environment if possible

### Phase 2: Feature Testing (2-3 hours)
1. End-to-end test of MVP workflow
2. Verify all Tauri commands work in packaged app
3. Test error scenarios (missing files, invalid formats)
4. Performance testing with multiple clips

### Phase 3: UI Polish (1-2 hours)
1. Add loading states and error handling
2. Improve visual consistency
3. Basic accessibility improvements
4. Responsive design fixes

### Phase 4: Final Validation (1 hour)
1. Complete build and package
2. Final testing on packaged app
3. Documentation updates
4. Submission preparation

---

## Success Criteria

- [ ] App packages successfully on target platforms
- [ ] All MVP requirements demonstrably working
- [ ] No critical bugs or crashes in basic usage
- [ ] Performance meets minimum targets
- [ ] Code is clean and documented
- [ ] Ready for submission by Tuesday 10:59 PM CT

---

## Risks & Mitigations

### Risk: Packaging Issues
**Impact**: Cannot submit MVP
**Mitigation**: Test build early, have fallback (dev mode demo)

### Risk: FFmpeg Binary Issues
**Impact**: Export/import fails
**Mitigation**: Verify download script works, test with system FFmpeg

### Risk: Platform Differences
**Impact**: Works on dev machine but not packaged
**Mitigation**: Test packaged version thoroughly

### Risk: Time Constraints
**Impact**: Incomplete by deadline
**Mitigation**: Focus on core MVP, defer nice-to-haves

---

## Dependencies

- FFmpeg binaries must be downloaded before packaging
- Tauri CLI must be installed and working
- Development environment must build successfully
- Test videos available for validation

---

**End of PRD** - MVP Completion & Core Gaps</content>
</xai:function_call