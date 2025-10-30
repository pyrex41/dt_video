## FFmpeg Centralization & Code Improvement Plan

### Phase 1: Analysis & Design (Current - READ-ONLY)
**Status: In Progress**  
**Duration: 1-2 hours**

#### 1.1 Codebase Audit
- [ ] **Search for FFmpeg Usage Patterns**
  - Grep all `.rs` files for `Command::new("ffmpeg")` and `Command::new_sidecar("ffmpeg")`
  - Identify all unique argument combinations across functions:
    - `check_ffmpeg`: Simple version check
    - `generate_thumbnail`: Single frame extraction with scaling
    - `trim_clip`: Stream copy with time range
    - `save_recording`: WebM→MP4 conversion with encoding
    - `export_single_clip`: Trim + scale + encode
    - `export_multi_clips`: Multi-step (trim/scale per clip + concat)
    - `record_webcam_clip`: Raw RGB → MP4 encoding
  - Document common parameters: `-i`, `-ss`, `-t`, `-vf scale`, `-c:v libx264`, `-preset`, `-crf`, `-c:a aac`, `-y`, `-progress`

- [ ] **Identify Duplication Metrics**
  - Count repeated arg patterns (e.g., libx264 encoding appears 4x)
  - Map function-specific vs. shared logic:
    - Shared: Input/output paths, encoding presets, progress handling
    - Unique: Trimming (`-ss/-t`), scaling (`-vf`), concat demuxer, raw input
  - Estimate reduction: ~40-60 lines of duplicated args → builder methods

- [ ] **Dependency Review**
  - Check `Cargo.toml` for existing utils (none found for FFmpeg)
  - Verify tokio usage: All commands are async, but simple ops like `check_ffmpeg` could be sync
  - Assess testing deps: No `mockall` or `tempfile`; plan additions

#### 1.2 Architecture Design
- [ ] **FFmpeg Builder Module Structure**
  - Create `src-tauri/src/utils/ffmpeg.rs`
  - Core Components:
    ```rust
    // Builder pattern for fluent API
    pub struct FfmpegBuilder {
        input: Option<String>,
        output: Option<String>,
        trim_start: Option<f64>,
        trim_duration: Option<f64>,
        scale_width: Option<u32>,
        scale_height: Option<u32>,
        video_codec: Option<String>,  // Default: "libx264"
        audio_codec: Option<String>,  // Default: "aac"
        preset: Option<String>,       // Default: "medium"
        crf: Option<u32>,            // Default: 23
        progress_enabled: bool,
        // ... additional fields (bitrate, pixel format, etc.)
    }

    impl FfmpegBuilder {
        pub fn new() -> Self { ... }
        
        // Core methods
        pub fn input(mut self, path: &str) -> Self { ... }
        pub fn output(mut self, path: &str) -> Self { ... }
        pub fn trim(mut self, start: f64, end: f64) -> Self { ... }
        pub fn scale(mut self, width: u32, height: Option<u32>) -> Self { ... }
        pub fn encode(mut self) -> Self { ... }  // Sets default libx264 + aac
        pub fn stream_copy(mut self) -> Self { ... }  // For fast trims
        pub fn thumbnail(mut self, time: f64) -> Self { ... }
        
        // Execution
        pub async fn run(&self, app_handle: &tauri::AppHandle) -> Result<String, String> { ... }
        pub async fn run_with_progress(&self, app_handle: &tauri::AppHandle, total_duration: f64) -> Result<String, String> { ... }
    }

    // Helper for multi-clip concat
    pub struct ConcatBuilder {
        clips: Vec<FfmpegBuilder>,
        // ... concat-specific fields
    }
    ```
  - Error Handling: Centralized `FFmpegError` enum with variants for spawn, execution, output validation
  - Progress: Extract `run_ffmpeg_with_progress` into builder, using regex for time parsing

- [ ] **Async/Sync Optimization Plan**
  - Convert short commands to sync (`std::process::Command`):
    - `check_ffmpeg`: No I/O blocking needed
    - `generate_thumbnail`: Single quick frame extract
  - Keep async for long-running:
    - `export_video`, `record_webcam_clip` (user-facing progress)
  - Migration: Update function signatures gradually (async → sync where possible)

- [ ] **Testing Strategy Design**
  - Unit Tests: Mock `Command` output with `mockall` for each builder method
    - Test arg construction: Assert exact `args()` vec matches expected
    - Test error paths: Simulate FFmpeg failures (non-zero exit, stderr)
  - Integration Tests: Use `tempfile` for real temp files, mock sidecar binaries
    - `tests/integration/ffmpeg.rs`: End-to-end trim/export with fixture videos
  - Coverage Goals: 80%+ for builder methods; focus on common paths (trim, encode)

### Phase 2: Implementation (After READ-ONLY)
**Duration: 4-6 hours**  
**Dependencies: Phase 1 complete**

#### 2.1 Core Builder Implementation
- [ ] **Create `src-tauri/src/utils/ffmpeg.rs`**
  - Implement `FfmpegBuilder` with fluent methods
  - Add `build_args(&self) -> Vec<&str>` for arg generation
  - Integrate progress parsing from existing `run_ffmpeg_with_progress`
  - Handle sidecar vs. system FFmpeg detection

- [ ] **Refactor Existing Functions**
  - `check_ffmpeg`: → `FfmpegBuilder::version_check().run_sync()`
  - `generate_thumbnail`: → `FfmpegBuilder::new().input(path).thumbnail(1.0).output(thumb_path).run()`
  - `trim_clip`: → `FfmpegBuilder::new().input(input).trim(start, end).stream_copy().output(output).run()`
  - `save_recording`: Split conversion logic → `FfmpegBuilder::new().input(webm).encode().output(mp4).run()`
  - `export_single_clip`: → Builder with trim + scale + encode chain
  - `export_multi_clips`: Use `ConcatBuilder` for temp clips + concat step
  - `record_webcam_clip`: Keep raw handling separate; use builder for final encode

- [ ] **Async/Sync Migration**
  - Update 2-3 short functions to sync `std::process::Command`
  - Add feature flag or config for async fallback if needed
  - Benchmark: Measure startup/runtime impact (expect <5% improvement for simple ops)

#### 2.2 Testing Suite
- [ ] **Add Dev Dependencies to `Cargo.toml`**
  ```toml
  [dev-dependencies]
  mockall = "0.13"
  tempfile = "3.10"
  assert_cmd = "2.0"  # For CLI-like testing
  ```

- [ ] **Unit Tests in `src-tauri/tests/utils/ffmpeg_tests.rs`**
  - Test builder construction: `assert_eq!(builder.build_args(), expected_vec)`
  - Mock execution: Use `mockall` to mock `Command` spawn/output
  - Edge cases: Invalid paths, zero duration, missing inputs

- [ ] **Integration Tests in `src-tauri/tests/integration/`**
  - Create fixture videos (small MP4 samples in `tests/fixtures/`)
  - Test full workflows: Import → trim → export → validate output metadata
  - Mock Tauri `AppHandle` for path resolution

### Phase 3: Binary Management & CI (Parallel to Phase 2)
**Duration: 2-3 hours**

#### 3.1 Automate Binary Downloads
- [ ] **Enhance `binaries/download.sh`**
  - Add checksum verification (SHA256 for downloaded zips)
  - Support more platforms: Linux x64/ARM via conditional branches
  - Version pinning: Use env var `FFMPEG_VERSION` (default: latest)
  - Output JSON manifest: `binaries/manifest.json` with paths/hashes

- [ ] **GitHub Actions Integration**
  - Update `.github/workflows/build.yml`:
    - On push/PR to main: Run `binaries/download.sh`
    - Cache binaries in `~/.cache/ffmpeg/` with key `platform-${{ runner.os }}`
    - Verify: Run `check_ffmpeg` post-download
    - Artifact: Upload `binaries/` to workflow artifacts for debugging
  - Cross-compile: Use `tauri-action` to bundle platform-specific sidecars

- [ ] **Runtime Detection Fallback**
  - In `lib.rs`: Check sidecar first, fallback to system FFmpeg
  - Add logging: `log::info!("Using FFmpeg from: {:?}", path)` for diagnostics

### Phase 4: Testing Gaps & Validation
**Duration: 3-4 hours**

#### 4.1 Unit/Integration Testing
- [ ] **FFmpeg Command Mocks**
  - Mock `tokio::process::Command` for async tests
  - Simulate stderr progress lines for `run_with_progress`
  - Test error propagation: Non-zero exit → `Err(FFmpegError::ExecutionFailed)`

- [ ] **Full Workflow Tests**
  - `tests/integration/export.rs`: Multi-clip export with temp cleanup
  - `tests/integration/trim.rs`: Edge cases (zero duration, invalid times)
  - Run with `cargo test -- --nocapture` to verify outputs

#### 4.2 Manual Validation
- [ ] **Local Testing**
  - Build/run Tauri app: Verify all FFmpeg ops work with new builder
  - Performance: Time exports before/after (expect similar; cleaner code)
  - Error Handling: Test invalid inputs, missing binaries

- [ ] **CI Testing**
  - Add test job to `build.yml`: `cargo test` + `cargo clippy`
  - Matrix: macOS/Windows/Linux runners
  - Fail on warnings: Enforce code quality

### Phase 5: Documentation & Cleanup
**Duration: 1 hour**

- [ ] **Update README & Docs**
  - Add section: "FFmpeg Integration" explaining builder usage
  - Binary setup: "Run `binaries/download.sh` or use CI auto-download"
  - Testing: "Run `cargo test` for unit/integration coverage"

- [ ] **Code Cleanup**
  - Remove duplicated arg arrays from refactored functions
  - Add doc comments to builder methods: `/// Sets trim parameters for fast stream copy`
  - Lint: `cargo fmt` + `cargo clippy --fix`

### Risks & Mitigations
- **FFmpeg Version Compatibility**: Pin to tested version (6.1); add upgrade path in CI
- **Platform Differences**: Test on macOS/Windows; use conditional compilation for paths
- **Performance Regression**: Benchmark async/sync changes; revert if >10% slowdown
- **Test Flakiness**: Use fixed fixtures; mock external deps (nokhwa, tauri)

### Success Metrics
- **Code**: 100% FFmpeg calls via builder; <10 LOC duplication
- **Tests**: 80%+ coverage on utils; all existing functions pass
- **CI**: Green builds on all platforms; auto-binary download
- **Runtime**: No regressions in export times; cleaner error messages

**Total Estimated Time: 11-16 hours**  
**Priority: High** (Addresses duplication, testability, maintainability)  
**Next Step: Complete Phase 1 audit, then implement builder prototype**