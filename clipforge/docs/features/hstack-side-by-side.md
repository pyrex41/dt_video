# Side-by-Side Video Comparison Feature - Detailed Implementation Plan

## 🎯 Feature Overview

**Name**: Video Comparison Tool (Side-by-Side Preview)  
**Purpose**: Enable users to compare two video clips simultaneously for editing decisions, sync verification, and quality assessment  
**Core Technology**: FFmpeg `hstack` filter_complex for fluid, frame-accurate side-by-side rendering  
**Target Users**: Video editors, content creators, filmmakers comparing takes/versions  

---

## 📋 Functional Requirements

### Primary Features
1. **Clip Selection**: Select 2 clips from timeline or media library
2. **Side-by-Side Preview**: Real-time horizontal video comparison
3. **Sync Controls**: Audio/video synchronization adjustment
4. **Export Capability**: Save comparison as final video
5. **Layout Options**: Horizontal (hstack), vertical (vstack), or split-screen modes

### Secondary Features
1. **Frame-accurate Navigation**: Step through frames side-by-side
2. **Individual Controls**: Per-video zoom, pan, and playback speed
3. **Comparison Markers**: Visual indicators for differences (motion, color, etc.)
4. **Audio Mixing**: Adjustable volume balance between clips
5. **Temporary Previews**: Generate short comparison clips for quick review

---

## 🏗️ Technical Architecture

### Frontend Components (React/TypeScript)
```
src/
├── components/
│   ├── video-compare/
│   │   ├── VideoCompareModal.tsx          # Clip selection interface
│   │   ├── ComparisonPreview.tsx          # Side-by-side video player
│   │   ├── SyncControls.tsx               # Audio sync and timing controls
│   │   ├── ComparisonToolbar.tsx          # Export, layout, and settings
│   │   └── ComparisonTypes.ts             # Type definitions
│   ├── timeline/
│   │   ├── ComparisonButton.tsx           # Trigger comparison from timeline
│   │   └── MultiSelectClips.tsx           # Enhanced clip selection
├── store/
│   ├── use-comparison-store.ts            # Zustand store for comparison state
│   └── use-clip-store.ts                  # Extended with comparison methods
└── types/
    └── comparison.ts                      # Comparison-specific types
```

### Backend Commands (Tauri/Rust)
```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn create_comparison_video(
    clips: Vec<ComparisonClipInfo>,           // Multiple clip support
    settings: ComparisonSettings,             // Layout, sync, quality options
    output_path: String,
    app_handle: tauri::AppHandle
) -> Result<ComparisonResult, String>

#[tauri::command] 
async fn generate_preview_comparison(     // For real-time previews
    clips: Vec<PreviewClipInfo>,
    duration: f64,                          // Short preview duration
    settings: PreviewSettings,
    app_handle: tauri::AppHandle
) -> Result<String, String>               // Returns temp preview path
```

### FFmpeg Pipeline Structure
```
Input 1 (Clip A) ──┐
                   ├─ [scale=width/2] ── [hstack=inputs=2] ── [encode] ── Output
Input 2 (Clip B) ──┘
                   └─ [scale=width/2] ──┘
```

---

## 🔧 Detailed Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Type Definitions & State Management
**Files**: `src/types/comparison.ts`, `src/store/use-comparison-store.ts`

**Comparison Types**:
```typescript
interface ComparisonClip {
  id: string;
  path: string;
  name: string;
  duration: number;
  thumbnail?: string;
  selected: boolean;
}

interface ComparisonSettings {
  layout: 'hstack' | 'vstack' | 'pip';      // Horizontal, vertical, picture-in-picture
  syncOffset: number;                       // Audio sync adjustment (seconds)
  resolution: 'preview' | '720p' | '1080p'; // Output quality
  audioMix: { left: number; right: number }; // Volume balance (0-1)
  frameRate: number;                        // Output FPS
}

interface ComparisonState {
  clips: ComparisonClip[];
  settings: ComparisonSettings;
  isActive: boolean;
  previewPath?: string;
  isGenerating: boolean;
  error?: string;
}
```

**Store Methods**:
- `selectClipsForComparison(clips: Clip[])`
- `setComparisonSettings(settings: Partial<ComparisonSettings>)`
- `generatePreview()`
- `exportComparison()`
- `clearComparison()`

#### 1.2 Tauri Command: Basic Comparison Generation
**File**: `src-tauri/src/lib.rs`

**Command Structure**:
```rust
#[derive(serde::Deserialize)]
struct ComparisonClipInfo {
    path: String,
    trim_start: f64,
    trim_end: f64,
    volume: f64,
}

#[derive(serde::Deserialize)]
struct ComparisonSettings {
    layout: String,           // "hstack", "vstack"
    resolution: String,       // "preview", "720p", "1080p"
    sync_offset: f64,         // Audio delay for clip B
    duration: Option<f64>,    // For preview generation
}

#[tauri::command]
async fn create_comparison_video(
    clips: Vec<ComparisonClipInfo>,
    settings: ComparisonSettings,
    output_path: String,
    app_handle: tauri::AppHandle
) -> Result<String, String> {
    // Validate exactly 2 clips for basic implementation
    if clips.len() != 2 {
        return Err("Exactly 2 clips required for comparison".to_string());
    }
    
    let clip1 = &clips[0];
    let clip2 = &clips[1];
    
    // Create temporary app data directory for processing
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let temp_dir = app_data_dir.join("comparison_temp");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;
    
    // Phase 1: Pre-process clips (trim + scale)
    let temp_clip1 = temp_dir.join("clip1_processed.mp4");
    let temp_clip2 = temp_dir.join("clip2_processed.mp4");
    
    // Process clip 1
    let duration1 = clip1.trim_end - clip1.trim_start;
    utils::ffmpeg::FfmpegBuilder::new()
        .with_app_handle(app_handle.clone())
        .input(&clip1.path)
        .trim(clip1.trim_start, duration1)
        .scale(960, None)  // Half width for side-by-side
        .encode()
        .preset("fast")    // Quick processing for preview
        .output(temp_clip1.to_str().unwrap())
        .run(&app_handle)?;
    
    // Process clip 2 with sync offset
    let duration2 = clip2.trim_end - clip2.trim_start;
    let sync_adjusted_start = clip2.trim_start + settings.sync_offset;
    utils::ffmpeg::FfmpegBuilder::new()
        .with_app_handle(app_handle.clone())
        .input(&clip2.path)
        .trim(sync_adjusted_start, duration2)
        .scale(960, None)
        .volume(clip2.volume)  // Apply volume adjustment
        .encode()
        .preset("fast")
        .output(temp_clip2.to_str().unwrap())
        .run(&app_handle)?;
    
    // Phase 2: Combine using hstack filter_complex
    let result = utils::ffmpeg::FfmpegBuilder::new()
        .with_app_handle(app_handle.clone())
        .input(temp_clip1.to_str().unwrap())
        .input(temp_clip2.to_str().unwrap())
        .filter_complex(format!(
            "[0:v]scale=960:ih[left];[1:v]scale=960:ih[right];[left][right]hstack=inputs=2[v]",
            settings.layout
        ))
        .map("[v]", |output| format!("[v]{}[outv]", output))  // Map video output
        .encode()
        .preset("medium")  // Better quality for final output
        .output(&output_path)
        .run(&app_handle)?;
    
    // Cleanup temporary files
    let _ = fs::remove_file(&temp_clip1);
    let _ = fs::remove_file(&temp_clip2);
    let _ = fs::remove_dir_all(&temp_dir);
    
    Ok(output_path)
}
```

### Phase 2: User Interface (Week 2)

#### 2.1 Comparison Modal & Selection
**File**: `src/components/video-compare/VideoCompareModal.tsx`

**Component Structure**:
```tsx
interface VideoCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompare: (clips: ComparisonClip[]) => void;
  availableClips: Clip[];  // From clip store
}

export function VideoCompareModal({ isOpen, onClose, onCompare, availableClips }: VideoCompareModalProps) {
  const [selectedClips, setSelectedClips] = useState<ComparisonClip[]>([]);
  const [syncOffset, setSyncOffset] = useState(0);
  
  const handleClipToggle = (clip: Clip) => {
    // Toggle selection logic - max 2 clips
    if (selectedClips.length < 2 && !selectedClips.some(c => c.id === clip.id)) {
      setSelectedClips([...selectedClips, { ...clip, selected: true }]);
    } else if (selectedClips.some(c => c.id === clip.id)) {
      setSelectedClips(selectedClips.filter(c => c.id !== clip.id));
    }
  };
  
  const handleCompare = () => {
    if (selectedClips.length === 2) {
      onCompare(selectedClips);
      onClose();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Videos Side-by-Side</DialogTitle>
          <DialogDescription>
            Select two clips to compare. Adjust sync offset if needed.
          </DialogDescription>
        </DialogHeader>
        
        {/* Clip Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {availableClips.map(clip => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isSelected={selectedClips.some(c => c.id === clip.id)}
              onToggle={() => handleClipToggle(clip)}
              maxSelections={2}
            />
          ))}
        </div>
        
        {/* Sync Controls */}
        {selectedClips.length === 2 && (
          <div className="space-y-4 mb-6">
            <Label>Audio Sync Offset (seconds)</Label>
            <Slider
              value={[syncOffset]}
              onValueChange={([value]) => setSyncOffset(value)}
              min={-5}
              max={5}
              step={0.1}
              marks
            />
            <p className="text-sm text-muted-foreground">
              {syncOffset > 0 ? `Clip B delayed by ${syncOffset}s` : 
               syncOffset < 0 ? `Clip B advanced by ${Math.abs(syncOffset)}s` : 
               'Clips perfectly synced'}
            </p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleCompare} 
            disabled={selectedClips.length !== 2}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Compare Side-by-Side
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 2.2 Comparison Preview Interface
**File**: `src/components/video-compare/ComparisonPreview.tsx`

**Component Structure**:
```tsx
interface ComparisonPreviewProps {
  clips: ComparisonClip[];
  settings: ComparisonSettings;
  onExport: (settings: ComparisonSettings) => void;
  onClose: () => void;
}

export function ComparisonPreview({ clips, settings, onExport, onClose }: ComparisonPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  
  const generatePreview = async () => {
    setIsGenerating(true);
    try {
      const previewResult = await invoke('generate_preview_comparison', {
        clips: clips.map(c => ({
          path: c.path,
          trim_start: 0,  // Start from beginning for preview
          trim_end: Math.min(10, c.duration),  // 10 second preview
          volume: settings.audioMix.left
        })),
        settings: {
          layout: settings.layout,
          resolution: 'preview',
          sync_offset: settings.syncOffset,
          duration: 10  // Fixed preview length
        }
      });
      
      setPreviewPath(previewResult as string);
    } catch (error) {
      console.error('Preview generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <div className="space-x-2">
          <h2 className="text-lg font-semibold">Video Comparison</h2>
          <span className="text-sm text-gray-400">
            {clips[0]?.name} vs {clips[1]?.name}
          </span>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            onClick={() => onExport(settings)}
            disabled={isGenerating}
            variant="outline"
            className="text-white border-white hover:bg-white hover:text-black"
          >
            Export Full Comparison
          </Button>
          <Button 
            onClick={onClose}
            variant="ghost"
            className="text-white hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Main Preview Area */}
      <div className="flex-1 relative overflow-hidden">
        {previewPath && !isGenerating ? (
          // Full comparison video player
          <div className="w-full h-full">
            <video
              src={`data:video/mp4;base64,${previewPath}`}  // Or use blob URL
              controls
              className="w-full h-full object-contain"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
            
            {/* Comparison Overlay */}
            <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              Time: {currentTime.toFixed(2)}s | Sync: {settings.syncOffset.toFixed(2)}s
            </div>
          </div>
        ) : (
          // Loading state with progress
          <div className="flex items-center justify-center h-full">
            {isGenerating ? (
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="text-white">Generating comparison preview...</p>
                <Progress value={0} className="w-64" />  {/* Connect to progress event */}
              </div>
            ) : (
              <Button onClick={generatePreview} className="text-white">
                Generate Preview
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-gray-900 p-4 space-y-4">
        {/* Layout Controls */}
        <div className="flex space-x-2">
          <Button 
            variant={settings.layout === 'hstack' ? 'default' : 'outline'}
            onClick={() => updateSettings({ layout: 'hstack' })}
            size="sm"
          >
            Side-by-Side
          </Button>
          <Button 
            variant={settings.layout === 'vstack' ? 'default' : 'outline'}
            onClick={() => updateSettings({ layout: 'vstack' })}
            size="sm"
          >
            Top/Bottom
          </Button>
        </div>
        
        {/* Sync Controls */}
        <div className="space-y-2">
          <Label className="text-white">Audio Sync</Label>
          <Slider
            value={[settings.syncOffset]}
            onValueChange={([value]) => updateSettings({ syncOffset: value })}
            min={-2}
            max={2}
            step={0.05}
            className="w-full"
          />
          <p className="text-sm text-gray-300">
            {settings.syncOffset > 0 ? `Clip B delayed by ${settings.syncOffset}s` : 
             settings.syncOffset < 0 ? `Clip B advanced by ${Math.abs(syncOffset)}s` : 
             'Perfectly synced'}
          </p>
        </div>
        
        {/* Audio Mix */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-white block mb-1">Clip A Volume</Label>
            <Slider
              value={[settings.audioMix.left]}
              onValueChange={([value]) => updateSettings({ 
                audioMix: { ...settings.audioMix, left: value } 
              })}
              min={0}
              max={1}
              step={0.1}
            />
          </div>
          <div>
            <Label className="text-white block mb-1">Clip B Volume</Label>
            <Slider
              value={[settings.audioMix.right]}
              onValueChange={([value]) => updateSettings({ 
                audioMix: { ...settings.audioMix, right: value } 
              })}
              min={0}
              max={1}
              step={0.1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Phase 3: Advanced Features (Week 3)

#### 3.1 Enhanced FFmpeg Pipeline
**File**: `src-tauri/src/utils/ffmpeg.rs`

**Extended FfmpegBuilder Methods**:
```rust
impl FfmpegBuilder {
    /// Add multiple inputs for complex filters
    pub fn multi_input(mut self, inputs: Vec<String>) -> Self {
        self.multi_inputs = Some(inputs);
        self
    }
    
    /// Set complex filter graph (hstack, vstack, overlay, etc.)
    pub fn filter_complex(mut self, filter: &str) -> Self {
        self.filter_complex = Some(filter.to_string());
        self
    }
    
    /// Audio delay filter for sync adjustment
    pub fn audio_delay(mut self, delay: f64, stream_index: usize) -> Self {
        if let Some(ref mut filters) = self.audio_filters {
            filters.push(format!("adelay=delays={}:duration={}", 
                (delay * 1000.0) as i64,  // Convert to milliseconds
                if delay > 0.0 { "first" } else { "last" }
            ));
        }
        self
    }
    
    /// Volume adjustment per stream
    pub fn volume(mut self, volume: f64, stream_index: usize) -> Self {
        if let Some(ref mut filters) = self.audio_filters {
            filters.push(format!("volume={}", volume));
        }
        self
    }
    
    /// Build complex filter graph for comparison
    pub fn build_comparison_args(&self, layout: &str, resolution: &str) -> Vec<String> {
        let mut args = Vec::new();
        
        // Input streams (assuming 2 clips)
        if let Some(ref inputs) = self.multi_inputs {
            for (i, input) in inputs.iter().enumerate() {
                args.extend([
                    "-i".to_string(),
                    input.clone()
                ]);
            }
        }
        
        // Complex filter based on layout
        let filter_graph = match layout {
            "hstack" => {
                // Scale each input to half width, then stack horizontally
                "[0:v]scale=w=iw/2:h=ih[left];[1:v]scale=w=iw/2:h=ih[right];[left][right]hstack=inputs=2[outv]"
            },
            "vstack" => {
                // Scale each input to half height, then stack vertically
                "[0:v]scale=w=iw:h=ih/2[top];[1:v]scale=w=iw:h=ih/2[bottom];[top][bottom]vstack=inputs=2[outv]"
            },
            "pip" => {
                // Picture-in-picture: main video + inset
                "[0:v]scale=1280:720[main];[1:v]scale=320:240[pi];[main][pi]overlay=W-w-10:H-h-10[outv]"
            },
            _ => "[0:v][1:v]hstack=inputs=2[outv]"
        };
        
        args.extend([
            "-filter_complex".to_string(),
            filter_graph.to_string()
        ]);
        
        // Map output video stream
        args.extend(["-map".to_string(), "[outv]".to_string()]);
        
        // Audio mixing with sync
        if let Some(delay) = self.sync_delay {
            args.extend(["-af".to_string(), format!("adelay=1000*{}:all=1", delay.abs() as i64)]);
        }
        
        // Resolution scaling
        match resolution {
            "720p" => args.extend(["-vf".to_string(), "scale=1280:720".to_string()]),
            "1080p" => args.extend(["-vf".to_string(), "scale=1920:1080".to_string()]),
            "preview" => args.extend(["-vf".to_string(), "scale=960:540".to_string()]),
            _ => {}
        }
        
        // Encoding settings
        args.extend([
            "-c:v".to_string(), "libx264".to_string(),
            "-preset".to_string(), "medium".to_string(),
            "-crf".to_string(), "23".to_string(),
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "128k".to_string(),
        ]);
        
        args
    }
}
```

#### 3.2 Frame-Accurate Comparison
**File**: `src/components/video-compare/FrameStepper.tsx`

**Component Features**:
- Frame-by-frame navigation with keyboard shortcuts
- Visual diff highlighting (motion detection)
- Timestamp synchronization display
- Zoom controls for detailed inspection

```tsx
export function FrameStepper({ 
  currentTime, 
  duration, 
  onFrameChange, 
  isFrameMode 
}: FrameStepperProps) {
  const [frameNumber, setFrameNumber] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Frame calculation (assuming 30fps)
  const totalFrames = Math.floor(duration * 30);
  const currentFrame = Math.floor(currentTime * 30);
  
  const goToFrame = (targetFrame: number) => {
    const time = targetFrame / 30;  // Convert back to seconds
    onFrameChange(time);
    setFrameNumber(targetFrame);
  };
  
  useEffect(() => {
    if (isFrameMode) {
      setFrameNumber(currentFrame);
    }
  }, [currentFrame, isFrameMode]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFrameMode) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToFrame(Math.max(0, frameNumber - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToFrame(Math.min(totalFrames, frameNumber + 1));
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [frameNumber, isPlaying, isFrameMode]);
  
  return (
    <div className="flex items-center space-x-4 p-4 bg-gray-900">
      {/* Frame Counter */}
      <div className="text-white">
        <div className="text-sm text-gray-400">Frame</div>
        <div className="font-mono text-lg">{frameNumber.toString().padStart(5, '0')}</div>
        <div className="text-xs text-gray-500">/{totalFrames.toString().padStart(5, '0')}</div>
      </div>
      
      {/* Frame Navigation */}
      <div className="flex space-x-2">
        <Button 
          size="sm" 
          onClick={() => goToFrame(0)}
          disabled={frameNumber === 0}
          variant="outline"
        >
          <Rewind className="h-3 w-3" />
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => goToFrame(Math.max(0, frameNumber - 1))}
          disabled={frameNumber === 0}
          variant="outline"
        >
          ←
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => setIsPlaying(!isPlaying)}
          variant={isPlaying ? "default" : "outline"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => goToFrame(Math.min(totalFrames, frameNumber + 1))}
          disabled={frameNumber === totalFrames}
          variant="outline"
        >
          →
        </Button>
        
        <Button 
          size="sm" 
          onClick={() => goToFrame(totalFrames)}
          disabled={frameNumber === totalFrames}
          variant="outline"
        >
          <FastForward className="h-3 w-3" />
        </Button>
      </div>
      
      {/* Zoom Controls */}
      <div className="flex items-center space-x-2">
        <Label className="text-white text-sm">Zoom</Label>
        <Slider
          value={[zoomLevel]}
          onValueChange={([value]) => setZoomLevel(value)}
          min={0.25}
          max={4}
          step={0.25}
          className="w-24"
        />
        <span className="text-white text-sm">{(zoomLevel * 100).toFixed(0)}%</span>
      </div>
      
      {/* Frame Mode Toggle */}
      <Button 
        variant={isFrameMode ? "default" : "outline"}
        onClick={() => setIsFrameMode(!isFrameMode)}
        size="sm"
      >
        Frame Mode
      </Button>
    </div>
  );
}
```

### Phase 4: Integration & Polish (Week 4)

#### 4.1 Timeline Integration
**File**: `src/components/timeline/ComparisonButton.tsx`

**Enhanced Timeline Controls**:
```tsx
export function ComparisonButton({ selectedClips }: { selectedClips: Clip[] }) {
  const { setComparisonClips, openComparisonModal } = useComparisonStore();
  
  const handleQuickCompare = () => {
    if (selectedClips.length === 2) {
      setComparisonClips(selectedClips);
      openComparisonModal();
    }
  };
  
  return (
    <Tooltip content="Compare selected clips side-by-side">
      <Button
        onClick={handleQuickCompare}
        disabled={selectedClips.length !== 2}
        variant="outline"
        size="sm"
        className="flex items-center space-x-2"
      >
        <SplitScreen className="h-4 w-4" />
        <span>Compare</span>
        {selectedClips.length === 2 && (
          <Badge variant="secondary" className="ml-1">
            Ready
          </Badge>
        )}
      </Button>
    </Tooltip>
  );
}
```

#### 4.2 Export & Save Functionality
**Export Options Dialog**:
- Full comparison export (entire duration)
- Range export (specific time range)
- Quality presets (Preview, Web, Archive)
- Format options (MP4, MOV, WebM)
- Metadata embedding (comparison info, timestamps)

#### 4.3 Performance Optimizations
1. **Preview Caching**: Store generated previews with expiration
2. **Progressive Loading**: Generate low-res preview first, then HD
3. **GPU Acceleration**: Use hardware encoding where available
4. **Memory Management**: Clean up temp files automatically
5. **Batch Processing**: Queue multiple comparisons

---

## 🎨 User Experience Flow

### 1. Discovery & Selection
```
Timeline → Select 2 clips → "Compare" button highlights
          ↓
Click Compare → Modal opens with selected clips pre-loaded
          ↓
Adjust sync offset → Preview sync visualization
          ↓
"Generate Preview" → 3-5 second wait → Side-by-side playback
```

### 2. Comparison Session
```
Preview Window → Side-by-side videos playing in sync
                ↓
Frame stepper → Navigate frame-by-frame for detailed comparison
                ↓
Sync adjustment → Real-time audio sync preview
                ↓
Layout toggle → Switch between hstack/vstack/PIP
                ↓
Export dialog → Choose quality, format, and range
```

### 3. Export & Integration
```
Export Options → Quality/Format selection
                ↓
Processing → Progress bar with estimated time
                ↓
Save to Library → Comparison video added to clips
                ↓
Timeline Integration → Import comparison as new clip
```

---

## 🧪 Testing Strategy

### Unit Tests
1. **FFmpeg Command Generation**: Verify correct filter_complex syntax
2. **Clip Processing**: Test individual clip preprocessing (trim, scale, volume)
3. **Sync Logic**: Validate audio delay calculations
4. **Error Handling**: Test invalid inputs, missing files, permission issues

### Integration Tests
1. **End-to-End Workflow**: Selection → Preview → Export
2. **Multi-Format Support**: Test MP4, MOV, WebM inputs/outputs
3. **Performance Benchmarks**: Measure generation times for different resolutions
4. **Memory Usage**: Monitor temp file cleanup and memory leaks

### User Acceptance Testing
1. **Frame Accuracy**: Verify no dropped frames in hstack output
2. **Sync Precision**: Test audio sync adjustments (0.1s accuracy)
3. **UI Responsiveness**: Ensure smooth preview generation under load
4. **Cross-Platform**: Test on macOS, Windows, Linux

---

## 🚀 Deployment & Rollout

### Version 1.0 (MVP)
- Basic hstack comparison (2 clips)
- 10-second preview generation
- MP4 export only
- Timeline integration

### Version 1.1 (Enhanced)
- VStack and PIP layouts
- Frame-accurate navigation
- Audio mixing controls
- Multiple format support

### Version 1.2 (Advanced)
- Multi-clip comparison (3+ videos)
- AI-assisted diff detection
- Batch comparison mode
- Cloud export integration

---

## 📊 Success Metrics

### Technical Metrics
- **Frame Accuracy**: 100% frame preservation (no dropped frames)
- **Generation Speed**: <10s for 10-second preview, <2min for full HD export
- **Memory Usage**: <500MB peak during processing
- **Success Rate**: 95%+ successful comparisons without errors

### User Metrics
- **Adoption Rate**: 30% of active users try comparison within first week
- **Session Time**: 20% increase in average editing session duration
- **Export Rate**: 50% of comparisons result in exported videos
- **Satisfaction**: 4.5+ star rating for comparison feature

---

## 🔒 Security & Privacy Considerations

1. **File Path Validation**: Sanitize all input paths to prevent directory traversal
2. **Temporary File Cleanup**: Ensure all temp files are deleted after use
3. **Permission Scoping**: Only access files within app data directory and user-selected clips
4. **Metadata Stripping**: Option to remove sensitive metadata from exported comparisons
5. **Progress Reporting**: Secure event emission to frontend without exposing file paths

---

This comprehensive plan provides a solid foundation for implementing the side-by-side video comparison feature using the proven `hstack` approach. The modular architecture allows for iterative development while ensuring a smooth user experience from selection through export.</content>
</xai:function_call">The detailed implementation plan for the side-by-side video comparison feature has been saved to `hstack.md`. This comprehensive plan covers everything from technical architecture and implementation phases to testing strategy and deployment considerations.

The plan focuses on using FFmpeg's `hstack` filter_complex approach for fluid, frame-accurate video comparison, which addresses the dropped frames issue you mentioned. The implementation is broken down into 4 phases over 4 weeks, starting with core infrastructure and building up to advanced features like frame-accurate navigation and multiple layout options.

Key highlights of the plan:
- **Phase 1**: Core infrastructure with type definitions, state management, and basic Tauri commands
- **Phase 2**: User interface components including clip selection modal and comparison preview
- **Phase 3**: Advanced features like enhanced FFmpeg pipelines and frame-accurate comparison
- **Phase 4**: Integration, polish, and performance optimizations

The plan includes detailed code examples, user experience flows, testing strategies, and success metrics to ensure a robust implementation. Would you like me to start implementing any specific part of this plan?