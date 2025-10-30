import OpenAI from 'openai';
import { invoke } from '@tauri-apps/api/core';

export interface TranscriptionProgress {
  stage: 'extracting' | 'transcribing' | 'cleaning' | 'complete';
  message: string;
  progress: number;
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

  async transcribeVideo(videoPath: string): Promise<string> {
    try {
      // Step 1: Extract audio (0-20%)
      this.updateProgress('extracting', 'Extracting audio from video...', 0);
      const audioPath = await this.extractAudio(videoPath);
      this.updateProgress('extracting', 'Audio extracted successfully', 20);

      // Step 2: Transcribe with Whisper (20-70%)
      this.updateProgress('transcribing', 'Transcribing audio with Whisper V3...', 20);
      const rawTranscription = await this.transcribeAudio(audioPath);
      this.updateProgress('transcribing', 'Transcription complete', 70);

      // Step 3: Clean up with Llama (70-100%)
      this.updateProgress('cleaning', 'Cleaning up transcription with Llama...', 70);
      const cleanedTranscription = await this.cleanTranscription(rawTranscription);
      this.updateProgress('complete', 'Transcription complete!', 100);

      return cleanedTranscription;
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

  private async transcribeAudio(audioPath: string): Promise<string> {
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
      return transcription.text;
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
}
