# Thumbnail Aspect Ratio Fix

## Problem
Thumbnails were being stretched to fit 320x180 (16:9) dimensions, causing distortion for videos with different aspect ratios (like vertical phone videos).

## Solution
Implemented a **scale and crop** approach instead of stretching:

1. Scale the video to **cover** the target dimensions (320x180)
2. Crop the excess from the center to achieve exact dimensions
3. Result: No stretching, proper aspect ratio maintained with zoom-in effect

## Implementation

### New Method: `scale_crop()`
Added to `src-tauri/src/utils/ffmpeg.rs`:

```rust
/// Scale and crop to fill target dimensions (zoom in, no black bars)
/// This maintains aspect ratio by cropping excess content from center
pub fn scale_crop(mut self, width: u32, height: u32) -> Self
```

**FFmpeg filter chain generated:**
```
scale=320:180:force_original_aspect_ratio=increase,crop=320:180
```

This ensures:
- Video is scaled so its **smallest dimension** matches or exceeds the target
- Excess is cropped from the center
- No black bars, no stretching

### Updated Filter Logic
Modified `build_args()` in `ffmpeg.rs` to detect scale+crop mode:

```rust
let is_scale_crop = self.scale_width.is_some()
    && self.scale_height.is_some()
    && self.crop_width == self.scale_width
    && self.crop_height == self.scale_height
    && self.crop_x.is_none()
    && self.crop_y.is_none()
    && !self.scale_pad;
```

When detected, uses `force_original_aspect_ratio=increase` followed by center crop.

### Updated Thumbnail Generation
In `src-tauri/src/lib.rs`, changed from:
```rust
.scale_with_pad(target_width, target_height)  // Old: adds black bars
```

To:
```rust
.scale_crop(target_width, target_height)  // New: zoom and crop
```

## Examples

### Landscape Video (16:9 source)
- Source: 1920x1080
- Target: 320x180
- Result: Scales down to 320x180 (no crop needed, same aspect ratio)

### Vertical Video (9:16 source, like phone video)
- Source: 1080x1920
- Target: 320x180
- Process:
  1. Scale to 320x569 (maintains aspect ratio, width fits)
  2. Crop center 320x180 (removes top/bottom 194px each)
- Result: Properly zoomed vertical video thumbnail

### Ultra-wide Video (21:9 source)
- Source: 2560x1080
- Target: 320x180
- Process:
  1. Scale to 427x180 (maintains aspect ratio, height fits)
  2. Crop center 320x180 (removes left/right 53px each)
- Result: Centered crop of ultra-wide content

## Testing

Build verification:
```bash
$ cargo check
Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.47s
```

To test with real videos:
1. Import videos with various aspect ratios (vertical, horizontal, square)
2. Check Media Library thumbnails
3. Verify no stretching, proper zoom-in crop

## Benefits

✅ **No distortion** - Videos maintain proper aspect ratio
✅ **No black bars** - Thumbnails fill the entire 16:9 space
✅ **Intelligent cropping** - Center crop ensures important content is visible
✅ **Consistent size** - All thumbnails are exactly 320x180
✅ **Professional appearance** - Looks like YouTube/Vimeo thumbnails

## Related Code

- `src-tauri/src/utils/ffmpeg.rs` - FFmpeg builder and filter logic
- `src-tauri/src/lib.rs` - `generate_thumbnail()` function
- FFmpeg documentation: https://ffmpeg.org/ffmpeg-filters.html#scale
