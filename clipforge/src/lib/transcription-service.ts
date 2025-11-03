import OpenAI from 'openai';
import { invoke } from '@tauri-apps/api/core';

export interface TranscriptionProgress {
  stage: 'extracting' | 'transcribing' | 'cleaning' | 'complete';
  message: string;
  progress: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  vttPath?: string;
  language: string;
}

export class TranscriptionService {
  private openai: OpenAI;
  private progressCallback?: (progress: TranscriptionProgress) => void;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      dangerouslyAllowBrowser: true, // Required for browser usage
    });
  }

  setProgressCallback(callback: (progress: TranscriptionProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: TranscriptionProgress['stage'], message: string, progress: number) {
    if (this.progressCallback) {
      this.progressCallback({ stage, message, progress });
    }
  }

  async transcribeVideo(videoPath: string): Promise<TranscriptionResult> {
    try {
      // Step 1: Extract audio (0-20%)
      this.updateProgress('extracting', 'Extracting audio from video...', 0);
      const audioPath = await this.extractAudio(videoPath);
      this.updateProgress('extracting', 'Audio extracted successfully', 20);

      // Step 2: Transcribe with Whisper (20-70%)
      this.updateProgress('transcribing', 'Transcribing audio with Whisper V3...', 20);
      const whisperResult = await this.transcribeAudio(audioPath);
      this.updateProgress('transcribing', 'Transcription complete', 70);

      // Step 3: Clean up with Llama (70-90%)
      this.updateProgress('cleaning', 'Cleaning up transcription with Llama...', 70);
      const cleanedText = await this.cleanTranscription(whisperResult.text);
      this.updateProgress('cleaning', 'Generating captions...', 90);

      // Step 4: Generate WebVTT file (90-100%)
      const vttPath = await this.generateAndSaveVTT(videoPath, whisperResult.segments);
      this.updateProgress('complete', 'Transcription complete!', 100);

      return {
        text: cleanedText,
        segments: whisperResult.segments,
        vttPath,
        language: whisperResult.language || 'en',
      };
    } catch (error) {
      console.error('[Transcription] Error:', error);
      throw error;
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    try {
      console.log('[Transcription] Extracting audio from:', videoPath);
      const audioPath = await invoke<string>('extract_audio', { videoPath });
      console.log('[Transcription] Audio extracted to:', audioPath);
      return audioPath;
    } catch (error) {
      throw new Error(`Failed to extract audio: ${error}`);
    }
  }

  private async transcribeAudio(audioPath: string): Promise<{
    text: string;
    segments: TranscriptionSegment[];
    language?: string;
  }> {
    try {
      console.log('[Transcription] Starting Whisper transcription for:', audioPath);

      // Read the audio file
      const audioFile = await this.readAudioFile(audioPath);

      // Create transcription using Whisper V3 Turbo (faster and cheaper)
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3-turbo',
        language: 'en', // Change if needed
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      console.log('[Transcription] Whisper transcription complete');
      console.log('[Transcription] Segments found:', transcription.segments?.length || 0);

      // Extract segments with timestamps
      const segments: TranscriptionSegment[] = (transcription.segments || []).map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));

      return {
        text: transcription.text,
        segments,
        language: transcription.language,
      };
    } catch (error) {
      console.error('[Transcription] Whisper error:', error);
      throw new Error(`Whisper transcription failed: ${error}`);
    }
  }

  private async cleanTranscription(rawText: string): Promise<string> {
    try {
      console.log('[Transcription] Cleaning transcription with Llama...');

      const response = await this.openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // High-quality Llama model
        messages: [
          {
            role: 'system',
            content: `You are a professional transcription editor. Your job is to:
1. Fix grammatical errors
2. Add proper punctuation and capitalization
3. Remove filler words (um, uh, like, you know)
4. Format into proper paragraphs
5. Keep the original meaning intact
6. Do NOT add any content that wasn't in the original transcription
7. Return ONLY the cleaned text, no explanations or additional commentary`,
          },
          {
            role: 'user',
            content: `Clean up this transcription:\n\n${rawText}`,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent cleanup
        max_tokens: 8192,
      });

      const cleanedText = response.choices[0]?.message?.content || rawText;
      console.log('[Transcription] Cleaning complete');
      return cleanedText;
    } catch (error) {
      console.error('[Transcription] Llama cleanup error:', error);
      // If cleanup fails, return the raw transcription
      console.warn('[Transcription] Returning raw transcription due to cleanup failure');
      return rawText;
    }
  }

  private async readAudioFile(audioPath: string): Promise<File> {
    try {
      // Use fetch with Tauri's asset protocol to read the file
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      const assetUrl = convertFileSrc(audioPath);

      console.log('[Transcription] Reading audio file:', audioPath);
      console.log('[Transcription] Asset URL:', assetUrl);

      // Fetch the file as a blob
      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Get filename from path
      const filename = audioPath.split('/').pop()?.split('\\').pop() || 'audio.mp3';

      // Create a File object from the blob
      const file = new File([blob], filename, { type: 'audio/mpeg' });

      console.log('[Transcription] File created:', file.name, file.size, 'bytes');
      return file;
    } catch (error) {
      throw new Error(`Failed to read audio file: ${error}`);
    }
  }

  async downloadTranscription(text: string, filename: string): Promise<void> {
    try {
      // Use Tauri's save dialog
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');

      const filePath = await save({
        defaultPath: filename,
        filters: [{
          name: 'Text',
          extensions: ['txt']
        }]
      });

      if (filePath) {
        // Use our custom Tauri command to write the file
        await invoke('write_text_file', {
          filePath,
          content: text,
        });

        console.log('[Transcription] File saved to:', filePath);
      }
    } catch (error) {
      console.error('[Transcription] Download error:', error);
      throw new Error(`Failed to download transcription: ${error}`);
    }
  }

  /**
   * Generate WebVTT file from transcription segments and save it alongside the video
   */
  private async generateAndSaveVTT(
    videoPath: string,
    segments: TranscriptionSegment[]
  ): Promise<string> {
    try {
      console.log('[Transcription] Generating WebVTT file...');

      // Generate VTT content
      const vttContent = this.generateWebVTT(segments);

      // Determine VTT file path (same directory, same name, .vtt extension)
      const vttPath = videoPath.replace(/\.(mp4|mov|webm|avi|mkv)$/i, '.vtt');

      // Save VTT file using Tauri command
      await invoke('write_text_file', {
        filePath: vttPath,
        content: vttContent,
      });

      console.log('[Transcription] WebVTT file saved to:', vttPath);
      return vttPath;
    } catch (error) {
      console.error('[Transcription] VTT generation error:', error);
      throw new Error(`Failed to generate VTT file: ${error}`);
    }
  }

  /**
   * Convert transcription segments to WebVTT format
   */
  private generateWebVTT(segments: TranscriptionSegment[]): string {
    let vtt = 'WEBVTT\n\n';

    segments.forEach((segment, index) => {
      const startTime = this.formatVTTTime(segment.start);
      const endTime = this.formatVTTTime(segment.end);

      // Add cue with index, timestamps, and text
      vtt += `${index + 1}\n`;
      vtt += `${startTime} --> ${endTime}\n`;
      vtt += `${segment.text}\n\n`;
    });

    return vtt;
  }

  /**
   * Format seconds to WebVTT timestamp format (HH:MM:SS.mmm)
   */
  private formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
      .toString()
      .padStart(3, '0')}`;
  }
}
