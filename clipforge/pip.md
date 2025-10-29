# Picture-in-Picture Screen Recording + Webcam Feature Plan

## 🎯 Feature Overview

**Name**: PiP Screen Recording with Webcam Overlay  
**Purpose**: Enable simultaneous screen capture and webcam recording with picture-in-picture overlay for tutorials, presentations, and reaction videos  
**Core Technology**: Dual-stream capture (screen + webcam) with FFmpeg overlay filter for real-time PiP composition  
**Target Users**: Content creators, educators, tutorial makers, streamers  

---

## 📋 Functional Requirements

### Primary Features
1. **Dual Capture**: Record screen content and webcam simultaneously
2. **PiP Overlay**: Position webcam feed as picture-in-picture over screen recording
3. **Position Controls**: Adjustable PiP position (corners, custom coordinates)
4. **Size Controls**: Resizable webcam overlay (small, medium, large)
5. **Real-time Preview**: Live preview of composition during recording

### Secondary Features
1. **Border Effects**: Optional rounded corners, drop shadow, or colored border for PiP
2. **Transparency**: Adjustable opacity for webcam overlay
3. **Audio Mixing**: Balance between system audio and microphone levels
4. **Recording Controls**: Start/stop, pause/resume, frame rate selection
5. **Export Options**: Direct MP4 output with embedded metadata

---

## 🏗️ Technical Architecture

### Frontend Components (React/TypeScript)
```
src/
├── components/
│   ├── pip-recording/
│   │   ├── PiPRecordingModal.tsx          # Recording setup and controls
│   │   ├── LivePreview.tsx                # Real-time composition preview
│   │   ├── PiPPositionControls.tsx        # Drag-and-drop PiP positioning
│   │   ├── AudioMixer.tsx                 # Audio level balancing
│   │   └── PiPSettings.ts                 # Type definitions and presets
│   ├── record-button/
│   │   ├── EnhancedRecordButton.tsx       # Extended with PiP toggle
│   │   └── RecordingModes.tsx             # Screen-only vs Screen+Webcam
├── store/
│   ├── use-pip-recording-store.ts         # Zustand store for PiP state
│   └── use-recording-store.ts             # Extended with PiP capabilities
└── types/
    └── pip-recording.ts                   # PiP-specific types
```

### Backend Commands (Tauri/Rust)
```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn start_pip_recording(
    config: PiPRecordingConfig,              // Screen + webcam settings
    app_handle: tauri::AppHandle
) -> Result<String, String>                // Returns recording session ID

#[tauri::command]
async fn stop_pip_recording(
    session_id: String,
    output_path: String,
    app_handle: tauri::AppHandle
) -> Result<String, String>                // Returns final output path

#[tauri::command]
async fn update_pip_position(
    session_id: String,
    position: PiPPosition,                   // x, y coordinates
    size: PiPSize,                           // width, height
    app_handle: tauri::AppHandle
) -> Result<(), String>

#[tauri::command]
async fn get_live_preview_frame(
    session_id: String,
    app_handle: tauri::AppHandle
) -> Result<Vec<u8>, String>               // Raw frame data for preview
```

### Capture Pipeline Structure
```
Screen Capture ──┐
                 ├─ [scale=1920x1080] ── [overlay with webcam] ── [encode] ── Output MP4
Webcam Feed ─────┘
                 └─ [scale=320x240] ─── [position: top-right] ──┘
```

---

## 🔧 Detailed Implementation Phases

### Phase 1: Core Capture Infrastructure (Week 1)

#### 1.1 Type Definitions & State Management
**Files**: `src/types/pip-recording.ts`, `src/store/use-pip-recording-store.ts`

**PiP Recording Types**:
```typescript
interface PiPPosition {
  x: number;           // Horizontal position (0-100% of screen width)
  y: number;           // Vertical position (0-100% of screen height)
  preset?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

interface PiPSize {
  width: number;       // Webcam width in pixels (default: 320)
  height: number;      // Webcam height in pixels (default: 240)
  scale?: number;      // Scale factor (0.5-2.0)
}

interface AudioMix {
  screenVolume: number;    // System audio level (0-1)
  micVolume: number;       // Microphone level (0-1)
  micSource?: string;      // Specific microphone device
}

interface PiPRecordingConfig {
  duration: number;        // Recording length in seconds
  screenResolution: string; // "1080p", "720p", "screen-native"
  frameRate: number;       // 30, 60 fps
  webcamResolution: string; // "720p", "480p"
  position: PiPPosition;
  size: PiPSize;
  audioMix: AudioMix;
  border?: {
    enabled: boolean;
    color: string;         // "#ffffff"
    thickness: number;     // 2px
    rounded: boolean;      // Rounded corners
  };
}

interface PiPRecordingState {
  isRecording: boolean;
  sessionId?: string;
  config: PiPRecordingConfig;
  previewFrame?: string;   // Base64 encoded preview
  recordingProgress: number;
  estimatedTimeRemaining: number;
  error?: string;
}
```

**Store Methods**:
- `startPiPRecording(config: PiPRecordingConfig)`
- `stopPiPRecording(outputPath: string)`
- `updatePiPPosition(position: PiPPosition)`
- `updatePiPSize(size: PiPSize)`
- `setAudioMix(mix: AudioMix)`
- `toggleBorder(enabled: boolean)`
- `getPreviewFrame()`

#### 1.2 Tauri Commands: Dual Capture Setup
**File**: `src-tauri/src/lib.rs`

**Core Commands**:
```rust
use std::sync::Mutex;
use std::collections::HashMap;
use once_cell::sync::Lazy;

static RECORDING_SESSIONS: Lazy<Mutex<HashMap<String, RecordingSession>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
struct RecordingSession {
    screen_capture: Option<ScreenCaptureHandle>,
    webcam_capture: Option<WebcamCaptureHandle>,
    composition_pipe: Option<CompositionPipe>,
    start_time: Instant,
    config: PiPRecordingConfig,
}

#[derive(serde::Deserialize)]
struct PiPRecordingConfig {
    duration: f64,
    screen_resolution: String,
    frame_rate: u32,
    webcam_resolution: String,
    position: PiPPosition,
    size: PiPSize,
    audio_mix: AudioMix,
}

#[tauri::command]
async fn start_pip_recording(
    config: PiPRecordingConfig,
    app_handle: tauri::AppHandle
) -> Result<String, String> {
    // Generate unique session ID
    let session_id = uuid::Uuid::new_v4().to_string();
    
    // Validate camera permission
    if !CAMERA_PERMISSION.load(Ordering::SeqCst) {
        return Err("Camera permission required for PiP recording".to_string());
    }
    
    // Initialize screen capture (platform-specific)
    #[cfg(target_os = "macos")]
    let screen_capture = initialize_screen_capture(&config.screen_resolution)?;
    
    #[cfg(target_os = "windows")]
    let screen_capture = initialize_dshow_screen_capture(&config.screen_resolution)?;
    
    // Initialize webcam capture
    let webcam_index = CameraIndex::Index(0);
    let webcam_format = RequestedFormat::new::<RgbFormat>(
        RequestedFormatType::Absolute {
            size: config.size.width as u32, 
            fps: config.frame_rate as u32
        }
    );
    
    let mut webcam = Camera::new(webcam_index, webcam_format)
        .map_err(|e| format!("Failed to initialize webcam: {}", e))?;
    webcam.open_stream()
        .map_err(|e| format!("Failed to open webcam stream: {}", e))?;
    
    // Create composition pipeline
    let composition_pipe = create_composition_pipeline(
        &screen_capture,
        &webcam,
        &config.position,
        &config.size,
        &app_handle
    )?;
    
    // Store session
    let mut sessions = RECORDING_SESSIONS.lock().unwrap();
    sessions.insert(session_id.clone(), RecordingSession {
        screen_capture: Some(screen_capture),
        webcam_capture: Some(webcam),
        composition_pipe: Some(composition_pipe),
        start_time: Instant::now(),
        config,
    });
    
    // Start background recording task
    tokio::spawn(record_session_background(session_id.clone(), app_handle.clone()));
    
    Ok(session_id)
}

#[tauri::command]
async fn stop_pip_recording(
    session_id: String,
    output_path: String,
    app_handle: tauri::AppHandle
) -> Result<String, String> {
    let mut sessions = RECORDING_SESSIONS.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
        // Stop capture streams
        if let Some(ref mut webcam) = session.webcam_capture {
            drop(webcam);  // Close stream
        }
        
        // Finalize composition and encode
        let final_output = finalize_composition(
            &session.composition_pipe,
            &output_path,
            &session.config,
            &app_handle
        ).await?;
        
        // Cleanup session
        sessions.remove(&session_id);
        
        Ok(final_output)
    } else {
        Err("Recording session not found".to_string())
    }
}
```

### Phase 2: Real-time Composition Engine (Week 2)

#### 2.1 FFmpeg Overlay Pipeline
**File**: `src-tauri/src/utils/pip_composition.rs`

**Composition Engine**:
```rust
use tokio::process::Command;
use std::sync::mpsc;

pub struct CompositionPipe {
    ffmpeg_process: tokio::process::Child,
    frame_receiver: mpsc::Receiver<FrameData>,
    preview_channel: Option<mpsc::Sender<Vec<u8>>>,
}

pub enum FrameData {
    Screen(Vec<u8>),           // Raw screen frame (RGB)
    Webcam(Vec<u8>),          // Raw webcam frame (RGB)
    Both(Vec<u8>, Vec<u8>),    // Combined for immediate processing
}

impl CompositionPipe {
    pub fn new(
        screen_source: ScreenSource,
        webcam_source: WebcamSource,
        pip_config: &PiPConfig,
        app_handle: &tauri::AppHandle
    ) -> Result<Self, String> {
        // Create named pipes for frame streaming
        let screen_pipe = create_named_pipe("screen_pipe")?;
        let webcam_pipe = create_named_pipe("webcam_pipe")?;
        let output_pipe = create_named_pipe("output_pipe")?;
        
        // Build FFmpeg filter_complex for PiP overlay
        let filter_complex = build_pip_filter_complex(
            &pip_config.position,
            &pip_config.size,
            pip_config.border.as_ref()
        );
        
        // Start FFmpeg composition process
        let mut ffmpeg = Command::new("ffmpeg");
        ffmpeg.args(&[
            "-f", "rawvideo",
            "-pixel_format", "rgb24",
            "-video_size", &format!("{}x{}", pip_config.screen_width, pip_config.screen_height),
            "-framerate", &pip_config.frame_rate.to_string(),
            "-i", &screen_pipe,
            "-f", "rawvideo",
            "-pixel_format", "rgb24",
            "-video_size", &format!("{}x{}", pip_config.webcam_width, pip_config.webcam_height),
            "-framerate", &pip_config.frame_rate.to_string(),
            "-i", &webcam_pipe,
            "-filter_complex", &filter_complex,
            "-map", "[pip_output]",
            "-c:v", "libx264",
            "-preset", "ultrafast",  // Real-time encoding
            "-tune", "zerolatency",
            "-pix_fmt", "yuv420p",
            "-f", "mp4",
            &output_path,
        ]);
        
        let mut child = ffmpeg.spawn()
            .map_err(|e| format!("Failed to start FFmpeg: {}", e))?;
        
        Ok(CompositionPipe {
            ffmpeg_process: child,
            frame_receiver: mpsc::channel(),
            preview_channel: None,
        })
    }
    
    pub fn build_pip_filter_complex(
        position: &PiPPosition,
        size: &PiPSize,
        border: Option<&PiPBorder>
    ) -> String {
        let x_pos = match position.preset {
            Some("top-left") => "10",
            Some("top-right") => "main_w-overlay_w-10",
            Some("bottom-left") => "10",
            Some("bottom-right") => "main_w-overlay_w-10",
            Some("center") => "(main_w-overlay_w)/2",
            None => &format!("{}*main_w/100", position.x),
        };
        
        let y_pos = match position.preset {
            Some("top-left") => "10",
            Some("top-right") => "10",
            Some("bottom-left") => "main_h-overlay_h-10",
            Some("bottom-right") => "main_h-overlay_h-10",
            Some("center") => "(main_h-overlay_h)/2",
            None => &format!("{}*main_h/100", position.y),
        };
        
        let mut filter_parts = vec![
            format!("[1:v]scale={}:{},format=yuva420p[webcam]", size.width, size.height),
            format!("[0:v][webcam]overlay={}:{}:format=auto", x_pos, y_pos),
        ];
        
        // Add border effects if enabled
        if let Some(b) = border {
            if b.rounded {
                filter_parts.push("[pip]geq=lum='lum(X,Y)':cb=128:cr=128[rgb]");
                filter_parts.push("[rgb]scale=iw+4:ih+4,setsar=1,format=rgba,geq='if(gt(X,2)*lt(X,iw-2)*gt(Y,2)*lt(Y,ih-2),255,if(eq(mod(X,2),0)*eq(mod(Y,2),0),0,if(lt(X,2)+gt(X,iw-2)+lt(Y,2)+gt(Y,ih-2),255,if(eq(mod(X,2),0)+eq(mod(Y,2),0),128,128))),lum):alpha='if(gt(X,2)*lt(X,iw-2)*gt(Y,2)*lt(Y,ih-2),255,if(eq(mod(X,2),0)*eq(mod(Y,2),0),0,if(lt(X,2)+gt(X,iw-2)+lt(Y,2)+gt(Y,ih-2),255,if(eq(mod(X,2),0)+eq(mod(Y,2),0),128,128))),255)'[bordered]");
                filter_parts.push("[bordered]scale=iw-4:ih-4[final]");
            }
        }
        
        filter_parts.join(";")
    }
}
```

#### 2.2 Screen Capture Implementation
**File**: `src-tauri/src/utils/screen_capture.rs`

**Platform-Specific Screen Capture**:
```rust
#[cfg(target_os = "macos")]
pub fn initialize_screen_capture(resolution: &str) -> Result<ScreenCaptureHandle, String> {
    use avfoundation::AVCaptureSession;
    use avfoundation::AVCaptureScreenInput;
    
    let session = AVCaptureSession::new();
    session.set_session_preset(AVCaptureSessionPreset::hd1920x1080)?;
    
    let screen_input = AVCaptureScreenInput::new_from_screen(0)?;
    screen_input.set_captures_cursor(true)?;
    screen_input.set_captures_mouse_clicks(true)?;
    
    if let Err(e) = session.add_input(&screen_input) {
        return Err(format!("Failed to add screen input: {}", e));
    }
    
    let video_output = AVCaptureVideoDataOutput::new()?;
    if let Err(e) = session.add_output(&video_output) {
        return Err(format!("Failed to add video output: {}", e));
    }
    
    session.start_running();
    
    Ok(ScreenCaptureHandle {
        session,
        video_output,
        frame_receiver: mpsc::channel(),
    })
}

#[cfg(target_os = "windows")]
pub fn initialize_dshow_screen_capture(resolution: &str) -> Result<ScreenCaptureHandle, String> {
    use windows::Win32::Media::Foundation::*;
    use windows::Win32::Graphics::Direct3D11::*;
    
    // Use Desktop Duplication API for Windows 10+
    let factory = MFCreateMediaFactory()?;
    let attributes = MfPutWorkQueueAttributes()?;
    
    // Create desktop duplication source
    let duplication = DesktopDuplicationManager::new()?;
    
    Ok(ScreenCaptureHandle {
        duplication,
        frame_receiver: mpsc::channel(),
        // Windows-specific cleanup
    })
}

pub struct ScreenCaptureHandle {
    #[cfg(target_os = "macos")]
    session: AVCaptureSession,
    #[cfg(target_os = "macos")]
    video_output: AVCaptureVideoDataOutput,
    
    #[cfg(target_os = "windows")]
    duplication: DesktopDuplicationManager,
    
    frame_receiver: mpsc::Receiver<FrameData>,
    is_active: AtomicBool,
}
```

### Phase 3: User Interface & Controls (Week 3)

#### 3.1 PiP Recording Modal
**File**: `src/components/pip-recording/PiPRecordingModal.tsx`

**Setup Interface**:
```tsx
interface PiPRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRecording: (config: PiPRecordingConfig) => void;
}

export function PiPRecordingModal({ 
  isOpen, 
  onClose, 
  onStartRecording 
}: PiPRecordingModalProps) {
  const [config, setConfig] = useState<PiPRecordingConfig>(defaultConfig);
  const [previewVisible, setPreviewVisible] = useState(false);
  
  const updatePosition = (position: PiPPosition) => {
    setConfig(prev => ({ ...prev, position }));
  };
  
  const updateSize = (size: PiPSize) => {
    setConfig(prev => ({ ...prev, size }));
  };
  
  const togglePreview = async () => {
    if (!previewVisible) {
      // Start live preview
      const previewSession = await invoke('start_live_preview', { 
        config: { ...config, duration: 5 }  // 5 second preview
      });
      setPreviewVisible(true);
    } else {
      // Stop preview
      await invoke('stop_live_preview');
      setPreviewVisible(false);
    }
  };
  
  const handleStartRecording = () => {
    onStartRecording(config);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Picture-in-Picture Recording</DialogTitle>
          <DialogDescription>
            Record your screen with webcam overlay. Perfect for tutorials and presentations.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto">
          {/* Left Panel: Settings */}
          <div className="space-y-6">
            {/* Recording Duration */}
            <div>
              <Label>Recording Duration</Label>
              <div className="flex space-x-2 mt-2">
                <Input
                  type="number"
                  value={config.duration}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    duration: parseFloat(e.target.value) || 60 
                  }))}
                  placeholder="60"
                  className="w-24"
                />
                <span className="text-muted-foreground self-center">seconds</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setConfig(prev => ({ ...prev, duration: 300 }))}
                >
                  5 minutes
                </Button>
              </div>
            </div>
            
            {/* Screen Settings */}
            <div>
              <Label>Screen Capture</Label>
              <Select value={config.screenResolution} onValueChange={(val) => 
                setConfig(prev => ({ ...prev, screenResolution: val }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select screen resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="screen-native">Native Resolution</SelectItem>
                  <SelectItem value="1080p">1920x1080 (Full HD)</SelectItem>
                  <SelectItem value="720p">1280x720 (HD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Webcam Settings */}
            <div>
              <Label>Webcam Overlay</Label>
              <div className="space-y-2 mt-2">
                <Select value={config.webcamResolution} onValueChange={(val) => 
                  setConfig(prev => ({ ...prev, webcamResolution: val }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Webcam size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">320x240 (Small)</SelectItem>
                    <SelectItem value="medium">640x480 (Medium)</SelectItem>
                    <SelectItem value="large">960x720 (Large)</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Position Presets */}
                <div className="flex space-x-2 pt-2">
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].map(pos => (
                    <Button
                      key={pos}
                      variant={config.position.preset === pos ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updatePosition({
                        x: 0, y: 0, preset: pos as any
                      })}
                    >
                      {pos.replace('-', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Audio Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Screen Audio</Label>
                <Slider
                  value={[config.audioMix.screenVolume]}
                  onValueChange={([val]) => setConfig(prev => ({
                    ...prev, audioMix: { ...prev.audioMix, screenVolume: val }
                  }))}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
              <div>
                <Label>Microphone</Label>
                <Slider
                  value={[config.audioMix.micVolume]}
                  onValueChange={([val]) => setConfig(prev => ({
                    ...prev, audioMix: { ...prev.audioMix, micVolume: val }
                  }))}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
            </div>
            
            {/* Border Options */}
            <div className="space-y-2">
              <Label className="flex items-center space-x-2">
                <Checkbox
                  checked={config.border?.enabled || false}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    border: { 
                      ...prev.border, 
                      enabled: checked as boolean 
                    }
                  }))}
                />
                <span>Add PiP Border</span>
              </Label>
              {config.border?.enabled && (
                <div className="pl-6 space-y-2">
                  <Select defaultValue="white">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Border color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="black">Black</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="rounded-corners" />
                    <Label htmlFor="rounded-corners" className="text-sm">
                      Rounded Corners
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Panel: Live Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              {previewVisible ? 'Live Preview' : 'Preview Area'}
            </div>
            
            {previewVisible ? (
              <LivePreview 
                config={config}
                onPositionChange={updatePosition}
                onSizeChange={updateSize}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <Monitor className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg mb-2">Screen + Webcam Preview</p>
                <p className="text-sm text-gray-400 mb-6">
                  Click "Preview" to see live composition
                </p>
                <Button onClick={togglePreview} variant="outline" className="text-white">
                  Start Preview
                </Button>
              </div>
            )}
            
            {/* PiP Position Overlay (when editing) */}
            {previewVisible && (
              <PiPPositionOverlay 
                position={config.position}
                size={config.size}
                onDrag={updatePosition}
                onResize={updateSize}
              />
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleStartRecording}
            disabled={!previewVisible || config.duration <= 0}
            className="bg-red-600 hover:bg-red-700"
          >
            <Circle className="h-4 w-4 mr-2" />
            Start Recording
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3.2 Live Preview Component
**File**: `src/components/pip-recording/LivePreview.tsx`

**Real-time Composition Preview**:
```tsx
interface LivePreviewProps {
  config: PiPRecordingConfig;
  onPositionChange: (position: PiPPosition) => void;
  onSizeChange: (size: PiPSize) => void;
}

export function LivePreview({ 
  config, 
  onPositionChange, 
  onSizeChange 
}: LivePreviewProps) {
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Fetch preview frames
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const frameData = await invoke('get_live_preview_frame', { 
          sessionId: 'live-preview-session' 
        });
        setPreviewFrame(frameData as string);  // Base64 encoded frame
      } catch (error) {
        console.warn('Preview frame fetch failed:', error);
      }
    }, 100);  // 10fps preview
    
    return () => clearInterval(interval);
  }, []);
  
  // Render preview frame
  useEffect(() => {
    if (previewFrame && previewRef.current) {
      const canvas = previewRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Draw PiP overlay indicator
          drawPiPIndicator(ctx, config.position, config.size);
        };
        img.src = previewFrame;
      }
    }
  }, [previewFrame, config]);
  
  const drawPiPIndicator = (ctx: CanvasRenderingContext2D, position: PiPPosition, size: PiPSize) => {
    const pipX = (position.x / 100) * ctx.canvas.width - size.width / 2;
    const pipY = (position.y / 100) * ctx.canvas.height - size.height / 2;
    
    // Draw PiP border
    ctx.strokeStyle = config.border?.enabled ? config.border.color : '#ffffff';
    ctx.lineWidth = config.border?.thickness || 2;
    ctx.strokeRect(pipX, pipY, size.width, size.height);
    
    // Draw resize handles
    if (config.border?.enabled) {
      // Corner handles for resizing
      const handleSize = 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pipX + size.width - handleSize, pipY, handleSize, handleSize);
      ctx.fillRect(pipX + size.width - handleSize, pipY + size.height - handleSize, handleSize, handleSize);
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pipX = (config.position.x / 100) * rect.width;
    const pipY = (config.position.y / 100) * rect.height;
    const pipRight = pipX + config.size.width;
    const pipBottom = pipY + config.size.height;
    
    // Check if clicking on PiP area or resize handles
    if (x >= pipX && x <= pipRight && y >= pipY && y <= pipBottom) {
      setIsDragging(true);
      setDragOffset({
        x: x - pipX,
        y: y - pipY
      });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100));
    
    onPositionChange({ x, y, preset: undefined });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  return (
    <div 
      className="relative w-full h-full cursor-move"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={previewRef}
        width={1920}
        height={1080}
        className="w-full h-full object-contain"
      />
      
      {/* Position Info Overlay */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded">
        <div className="text-sm">PiP Position: {config.position.x.toFixed(0)}%, {config.position.y.toFixed(0)}%</div>
        <div className="text-xs text-gray-300">
          Size: {config.size.width}x{config.size.height} | 
          Drag to reposition, click corners to resize
        </div>
      </div>
      
      {/* Resize Controls */}
      {config.border?.enabled && (
        <div className="absolute top-2 right-2 space-y-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSizeChange({ width: 320, height: 240, scale: 1 })}
            className="text-white border-white"
          >
            Small
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSizeChange({ width: 640, height: 480, scale: 1 })}
            className="text-white border-white"
          >
            Medium
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSizeChange({ width: 960, height: 720, scale: 1 })}
            className="text-white border-white"
          >
            Large
          </Button>
        </div>
      )}
      
      {/* Status Indicator */}
      <div className="absolute top-4 right-4">
        <div className={`w-3 h-3 rounded-full ${
          previewFrame ? 'bg-green-500' : 'bg-red-500'
        }`} />
        <span className={`ml-2 text-sm ${
          previewFrame ? 'text-green-400' : 'text-red-400'
        }`}>
          {previewFrame ? 'Live' : 'No Signal'}
        </span>
      </div>
    </div>
  );
}
```

### Phase 4: Recording Controls & Integration (Week 4)

#### 4.1 Enhanced Recording Interface
**File**: `src/components/record-button/EnhancedRecordButton.tsx`

**Multi-Mode Recording**:
```tsx
export function EnhancedRecordButton() {
  const { isRecording, recordingMode, setRecordingMode } = useRecordingStore();
  const { openPiPModal } = usePiPRecordingStore();
  
  const modes = [
    { id: 'screen-only', label: 'Screen Only', icon: Monitor },
    { id: 'screen-pip', label: 'Screen + Webcam', icon: Video },
    { id: 'webcam-only', label: 'Webcam Only', icon: Camera },
  ];
  
  return (
    <div className="relative group">
      <Button
        onClick={() => {
          if (isRecording) {
            stopRecording();
          } else if (recordingMode === 'screen-pip') {
            openPiPModal();
          } else {
            startRecording(recordingMode);
          }
        }}
        disabled={isRecording && recordingMode === 'screen-pip'}
        variant={isRecording ? "destructive" : "default"}
        size="lg"
        className={`min-w-[140px] ${
          isRecording 
            ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
            : 'hover:shadow-lg transition-shadow'
        }`}
      >
        {isRecording ? (
          <>
            <Square className="h-4 w-4 mr-2" />
            Stop Recording
          </>
        ) : recordingMode === 'screen-pip' ? (
          <>
            <Video className="h-4 w-4 mr-2" />
            Setup PiP
          </>
        ) : (
          <>
            <Circle className="h-4 w-4 mr-2" />
            Start Recording
          </>
        )}
      </Button>
      
      {/* Mode Selector */}
      {!isRecording && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                       opacity-0 group-hover:opacity-100 transition-opacity space-y-1
                       bg-gray-800 rounded-lg p-2 shadow-lg z-10">
          {modes.map(mode => (
            <Button
              key={mode.id}
              variant={recordingMode === mode.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRecordingMode(mode.id)}
              className="justify-start w-full text-left bg-transparent 
                        hover:bg-gray-700 hover:text-white transition-colors
                        border-0 shadow-none h-8 px-3"
            >
              <mode.icon className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="text-sm">{mode.label}</span>
            </Button>
          ))}
        </div>
      )}
      
      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full 
                       border-2 border-background animate-ping" />
      )}
      
      {/* Mode Indicator */}
      {!isRecording && recordingMode === 'screen-pip' && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2
                       bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
          PiP Mode
        </div>
      )}
    </div>
  );
}
```

#### 4.2 Audio Mixer Component
**File**: `src/components/pip-recording/AudioMixer.tsx`

**Real-time Audio Controls**:
```tsx
export function AudioMixer({ 
  screenVolume, 
  micVolume, 
  onScreenVolumeChange, 
  onMicVolumeChange 
}: AudioMixerProps) {
  const [showDevices, setShowDevices] = useState(false);
  const [liveAudioLevels, setLiveAudioLevels] = useState({
    screen: 0,
    mic: 0
  });
  
  // Live audio level monitoring
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const levels = await invoke('get_audio_levels');
        setLiveAudioLevels(levels as { screen: number; mic: number });
      } catch (error) {
        console.warn('Audio level fetch failed:', error);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, []);
  
  const AudioLevelIndicator = ({ level, color }: { level: number; color: string }) => (
    <div className="relative">
      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-100 ease-out">
          <div 
            className={`h-full rounded-full transition-all duration-100 ease-out`}
            style={{ 
              width: `${Math.min(level * 100, 100)}%`,
              backgroundColor: color 
            }}
          />
        </div>
      </div>
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full 
                     opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
  
  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Audio Mixer</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDevices(!showDevices)}
          className="text-white hover:bg-gray-800 h-8 w-8 p-0"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Live Audio Levels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-white block mb-1">Screen Audio</Label>
            <p className="text-sm text-gray-400">System sound and application audio</p>
          </div>
          <div className="flex items-center space-x-4">
            <AudioLevelIndicator 
              level={liveAudioLevels.screen} 
              color="#3b82f6"  // Blue for screen audio
            />
            <Slider
              value={[screenVolume]}
              onValueChange={([val]) => onScreenVolumeChange(val)}
              min={0}
              max={1}
              step={0.05}
              className="w-32"
              orientation="vertical"
            />
            <span className="text-white text-sm min-w-[3ch] text-right">
              {Math.round(screenVolume * 100)}%
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-white block mb-1">Microphone</Label>
            <p className="text-sm text-gray-400">Your voice and ambient sound</p>
          </div>
          <div className="flex items-center space-x-4">
            <AudioLevelIndicator 
              level={liveAudioLevels.mic} 
              color="#10b981"  // Green for mic audio
            />
            <Slider
              value={[micVolume]}
              onValueChange={([val]) => onMicVolumeChange(val)}
              min={0}
              max={1}
              step={0.05}
              className="w-32"
              orientation="vertical"
            />
            <span className="text-white text-sm min-w-[3ch] text-right">
              {Math.round(micVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Device Selection (when expanded) */}
      {showDevices && (
        <div className="space-y-3 pt-4 border-t border-gray-700">
          <div>
            <Label className="text-white block mb-2">Audio Input Device</Label>
            <Select defaultValue="default">
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default System Mic</SelectItem>
                <SelectItem value="built-in">Built-in Microphone</SelectItem>
                <SelectItem value="external">External USB Mic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-white block mb-2">Audio Output Capture</Label>
            <Select defaultValue="system">
              <SelectTrigger>
                <SelectValue placeholder="Select screen audio source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System Audio (All Apps)</SelectItem>
                <SelectItem value="specific">Specific Application</SelectItem>
                <SelectItem value="none">No Screen Audio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Advanced Audio Settings */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="noise-reduction" />
              <Label htmlFor="noise-reduction" className="text-sm text-white">
                Noise Reduction
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="echo-cancellation" />
              <Label htmlFor="echo-cancellation" className="text-sm text-white">
                Echo Cancellation
              </Label>
            </div>
          </div>
        </div>
      )}
      
      {/* Audio Balance Visualization */}
      <div className="pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm">Audio Balance</span>
          <span className="text-gray-400 text-xs">
            Screen {Math.round(screenVolume * 100)}% | Mic {Math.round(micVolume * 100)}%
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="w-full bg-gradient-to-r from-blue-500 to-transparent h-2 rounded-full">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${screenVolume * 100}%` }}
              />
            </div>
          </div>
          <div className="w-12 text-center">
            <span className="text-white text-sm">Balance</span>
          </div>
          <div className="flex-1">
            <div className="w-full bg-gradient-to-l from-green-500 to-transparent h-2 rounded-full">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${micVolume * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 User Experience Flow

### 1. Setup & Configuration
```
Record Button → Select "Screen + Webcam" mode
               ↓
PiP Modal Opens → Configure duration, resolution, audio
               ↓
Position Webcam → Drag PiP overlay to desired location
               ↓
Audio Balance → Adjust screen vs microphone levels
               ↓
Live Preview → See real-time composition before recording
               ↓
"Start Recording" → Begin dual capture with PiP overlay
```

### 2. Recording Session
```
Recording Starts → Red indicator + live preview continues
                 ↓
Real-time Controls → Adjust PiP position/size during recording
                 ↓
Audio Monitoring → Live level meters for both sources
                 ↓
Progress Indicator → Time remaining + file size estimate
                 ↓
"Stop Recording" → Finalize composition and save to library
```

### 3. Post-Recording
```
Processing Complete → MP4 saved to clips library
                    ↓
Auto-import → PiP recording appears in timeline
                    ↓
Metadata → Recording info (duration, PiP position, audio levels)
                    ↓
Re-edit → Can trim, adjust, or export again
```

---

## 🧪 Testing Strategy

### Unit Tests
1. **Capture Initialization**: Verify screen + webcam streams start correctly
2. **PiP Positioning**: Test overlay coordinates across all presets
3. **Audio Mixing**: Validate volume levels and device selection
4. **Frame Synchronization**: Ensure screen and webcam frames stay in sync

### Integration Tests
1. **End-to-End Recording**: 60-second test with position changes mid-recording
2. **Multi-Format**: Test MP4, MOV, WebM inputs/outputs
3. **Performance**: Measure CPU/GPU usage during 1080p + 720p PiP recording
4. **Error Recovery**: Test camera disconnect, screen lock, audio device changes

### User Acceptance Testing
1. **Position Accuracy**: PiP stays exactly where user places it
2. **Audio Quality**: Clear microphone capture without echo or clipping
3. **Performance**: Smooth 60fps recording without dropped frames
4. **File Compatibility**: Exported MP4 plays correctly in all major players

---

## 🚀 Deployment & Rollout

### Version 1.0 (MVP)
- Basic screen + webcam PiP recording
- 4 preset positions (corners)
- Fixed webcam size (320x240)
- Basic audio mixing (50/50 balance)

### Version 1.1 (Enhanced)
- Drag-and-drop PiP positioning
- Resizable webcam overlay
- Advanced audio controls (noise reduction, device selection)
- Border and transparency effects

### Version 1.2 (Professional)
- Multiple PiP windows (up to 4 webcams)
- Animated transitions (fade in/out)
- Green screen chroma key for webcam
- Integration with screen sharing apps

---

## 📊 Success Metrics

### Technical Metrics
- **Frame Sync**: <1% frame drift between screen and webcam streams
- **Recording Success**: 98%+ successful recordings without crashes
- **Performance**: <30% CPU usage for 1080p + 720p PiP at 30fps
- **File Size**: <1GB per hour of 1080p PiP recording

### User Metrics
- **Adoption Rate**: 40% of screen recordings use PiP mode
- **Average Duration**: 15+ minutes per PiP recording session
- **Export Rate**: 80% of PiP recordings exported to final format
- **Satisfaction**: 4.7+ rating for PiP recording experience

---

## 🔒 Security & Privacy Considerations

1. **Camera Permission**: Explicit user consent before webcam access
2. **Screen Content**: Warn users about sensitive content capture
3. **Audio Privacy**: Clear indicators when microphone is active
4. **File Security**: Encrypt temporary recording files
5. **Device Access**: Graceful handling of permission revocation

---

This PiP screen recording feature builds on the existing webcam and screen capture infrastructure while adding sophisticated real-time composition capabilities. The FFmpeg overlay approach ensures smooth, professional-quality output suitable for content creation workflows.</content>
</xai:function_call">The detailed implementation plan for the Picture-in-Picture screen recording feature has been saved to `pip.md`. This comprehensive plan covers everything from technical architecture and implementation phases to testing strategy and deployment considerations.

The plan focuses on using FFmpeg's overlay filter for real-time PiP composition, which provides smooth, frame-accurate video output. The implementation is broken down into 4 phases over 4 weeks, starting with core capture infrastructure and building up to advanced features like drag-and-drop positioning and audio mixing.

Key highlights of the plan:
- **Phase 1**: Core capture infrastructure with dual-stream setup and FFmpeg composition pipeline
- **Phase 2**: Real-time composition engine with overlay filters and platform-specific screen capture
- **Phase 3**: User interface with PiP recording modal, live preview, and position controls
- **Phase 4**: Recording controls, audio mixer, and integration with existing recording system

The plan includes detailed code examples, user experience flows, testing strategies, and success metrics to ensure a robust implementation. Would you like me to start implementing any specific part of this plan?