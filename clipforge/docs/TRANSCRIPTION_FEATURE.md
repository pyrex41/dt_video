# AI Transcription Feature

## Overview
ClipForge now includes an AI-powered transcription feature that converts video audio to text using Groq's Whisper V3 and Llama 3.3 models.

## Features

### 1. Audio Extraction
- Automatically extracts audio from video files using FFmpeg
- Converts to 16kHz mono MP3 (optimized for Whisper)
- Output stored in app data directory under `audio/`

### 2. AI Transcription Pipeline
- **Whisper V3 Turbo**: Fast, accurate speech-to-text transcription
- **Llama 3.3 70B**: Intelligent cleanup and formatting
  - Fixes grammar and punctuation
  - Removes filler words (um, uh, like, you know)
  - Adds proper paragraph formatting
  - Maintains original meaning

### 3. User Interface
- Located in Media Library sidebar
- Progress indicator with stage-by-stage updates:
  - Extracting audio (0-20%)
  - Transcribing with Whisper (20-70%)
  - Cleaning with Llama (70-100%)
- Real-time transcription preview
- Download transcription as .txt file

## How to Use

### 1. Get Groq API Key
1. Visit [Groq Console](https://console.groq.com/keys)
2. Sign up for a free account
3. Create an API key (starts with `gsk_`)

### 2. Transcribe a Video
1. Select a clip from the timeline
2. In Media Library sidebar, scroll to "AI Transcription" section
3. Click "Add API Key" and paste your Groq API key
4. Click "Transcribe Selected Clip"
5. Wait for the process to complete (progress bar shows status)
6. View the transcription in the preview area

### 3. Download Transcription
1. After transcription completes, click the "Download" button
2. Choose a save location
3. File is saved as `{video_name}_transcription.txt`

## Technical Implementation

### Backend (Rust)
**File**: `src-tauri/src/lib.rs`

```rust
#[tauri::command]
async fn extract_audio(
    video_path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String>
```

- Extracts audio from video using FFmpeg
- Parameters: `-ar 16000` (16kHz), `-ac 1` (mono), `-b:a 128k` (128kbps)
- Returns path to extracted MP3 file

### Frontend (TypeScript/React)

**Files**:
- `src/lib/transcription-service.ts` - Core transcription logic
- `src/components/transcribe-button.tsx` - UI component

**TranscriptionService Class**:
```typescript
class TranscriptionService {
  async transcribeVideo(videoPath: string): Promise<string>
  async downloadTranscription(text: string, filename: string): Promise<void>
}
```

### Groq API Integration

**Models Used**:
- `whisper-large-v3-turbo` - $0.04 per hour of audio
- `llama-3.3-70b-versatile` - $0.59 per 1M input tokens

**API Endpoint**: `https://api.groq.com/openai/v1`

**Configuration**:
```typescript
const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://api.groq.com/openai/v1',
  dangerouslyAllowBrowser: true,
});
```

## Progress Tracking

The transcription service provides real-time progress updates:

```typescript
interface TranscriptionProgress {
  stage: 'extracting' | 'transcribing' | 'cleaning' | 'complete';
  message: string;
  progress: number; // 0-100
}
```

**Progress Breakdown**:
- **Extracting** (0-20%): FFmpeg audio extraction
- **Transcribing** (20-70%): Whisper V3 speech-to-text
- **Cleaning** (70-100%): Llama text cleanup
- **Complete** (100%): Ready for download

## Error Handling

### Common Errors
1. **"No Groq API key"**: User must provide valid API key
2. **"No clip selected"**: User must select a clip from timeline
3. **"Failed to extract audio"**: FFmpeg error (check file format)
4. **"Whisper transcription failed"**: API error (check API key, network)
5. **"Llama cleanup error"**: Falls back to raw transcription

### Fallback Behavior
- If Llama cleanup fails, returns raw Whisper transcription
- User still gets usable output even if cleanup step fails

## File Structure

```
clipforge/
├── src-tauri/
│   ├── src/
│   │   └── lib.rs (extract_audio command)
│   ├── Cargo.toml (added tauri-plugin-fs)
│   └── tauri.conf.json (fs plugin config)
├── src/
│   ├── lib/
│   │   └── transcription-service.ts (core logic)
│   └── components/
│       ├── transcribe-button.tsx (UI)
│       └── media-library.tsx (integrated)
└── package.json (added openai dependency)
```

## Dependencies Added

### Frontend
```json
{
  "openai": "6.7.0",
  "@tauri-apps/plugin-fs": "2.4.4"
}
```

### Backend
```toml
[dependencies]
tauri-plugin-fs = "2.0"
```

## Security Considerations

1. **API Key Storage**: Stored in component state (not persisted)
   - User must re-enter key each session
   - **IMPORTANT**: Users must provide their own Groq API key
   - API key is not bundled with the application
   - Consider adding secure storage in future

2. **File System Access**: Uses Tauri fs plugin
   - App can read/write audio files and transcriptions
   - Files stored in app data directory

3. **Browser Usage**: OpenAI client runs in browser
   - `dangerouslyAllowBrowser: true` required
   - API key stored in memory only (not persisted to disk)

## Future Enhancements

1. **API Key Persistence**: Save encrypted key to secure storage
2. **Batch Transcription**: Transcribe multiple clips at once
3. **Language Support**: Auto-detect language or user selection
4. **Timestamp Markers**: Include timestamps in transcription
5. **Speaker Diarization**: Identify different speakers
6. **Custom Prompts**: Allow user to customize Llama cleanup instructions
7. **SRT/VTT Export**: Export as subtitle files for video
8. **Real-time Transcription**: Live transcription during recording

## Cost Estimation

**Whisper V3 Turbo**: $0.04 per hour of audio
- 5-minute video: $0.0033
- 30-minute video: $0.02
- 1-hour video: $0.04

**Llama 3.3 70B**: ~$0.01-0.02 per transcription (typical)
- Depends on transcription length
- 5-minute video (~750 words): ~$0.01

**Total**: ~$0.01-0.06 per video (depending on length)

## Testing

### Manual Testing Steps
1. Import a video with spoken audio
2. Select the clip
3. Enter Groq API key
4. Click "Transcribe Selected Clip"
5. Verify progress indicators update correctly
6. Check transcription accuracy
7. Download transcription file
8. Verify file contents match preview

### Edge Cases to Test
- Video with no audio
- Video with multiple languages
- Very long videos (>1 hour)
- Video with lots of background noise
- Invalid API key
- Network interruption during transcription

## Troubleshooting

### Transcription Quality Issues
- Ensure video has clear audio
- Check for background noise
- Verify correct language setting
- Try re-transcribing if first attempt is poor

### API Errors
- Verify API key is valid
- Check Groq account credits
- Ensure stable internet connection
- Review browser console for detailed errors

### File System Errors
- Ensure app has file system permissions
- Check available disk space
- Verify app data directory is accessible

## Credits

- **Whisper V3**: OpenAI's speech recognition model
- **Llama 3.3**: Meta's large language model
- **Groq**: Fast AI inference platform
- **FFmpeg**: Audio/video processing

## License Notes

This feature uses:
- Groq's API (requires user's own API key)
- OpenAI SDK (MIT License)
- FFmpeg (GPL/LGPL)

Users are responsible for compliance with Groq's terms of service and usage limits.
