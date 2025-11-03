import { useState } from 'react';
import { FileText, Download, Loader2, AlertCircle, Subtitles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { TranscriptionService, TranscriptionProgress } from '../lib/transcription-service';
import { useClipStore } from '../store/use-clip-store';

export function TranscribeButton() {
  const { clips, selectedClipId, updateClipTranscription } = useClipStore();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [hasCaptions, setHasCaptions] = useState(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiInput, setShowApiInput] = useState(false);

  const selectedClip = clips.find(c => c.id === selectedClipId);

  const handleTranscribe = async () => {
    if (!selectedClip) {
      setError('Please select a clip to transcribe');
      return;
    }

    if (!apiKey.trim()) {
      setShowApiInput(true);
      setError('Please enter your Groq API key');
      return;
    }

    setIsTranscribing(true);
    setError('');
    setTranscription('');
    setProgress(null);

    try {
      const service = new TranscriptionService(apiKey);

      // Set up progress callback
      service.setProgressCallback((p) => {
        setProgress(p);
        console.log('[TranscribeButton] Progress:', p);
      });

      // Start transcription
      const result = await service.transcribeVideo(selectedClip.path);
      setTranscription(result.text);
      setHasCaptions(!!result.vttPath);

      // Save transcription data to clip store
      updateClipTranscription(selectedClip.id, {
        text: result.text,
        segments: result.segments,
        vttPath: result.vttPath,
        language: result.language,
      });

      setProgress({
        stage: 'complete',
        message: 'Transcription complete! Captions added to video.',
        progress: 100,
      });

      console.log('[TranscribeButton] Transcription saved with', result.segments.length, 'segments');
    } catch (err) {
      console.error('[TranscribeButton] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to transcribe video');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleDownload = async () => {
    if (!transcription || !selectedClip) return;

    try {
      const service = new TranscriptionService(apiKey);
      const filename = `${selectedClip.name.replace(/\.[^/.]+$/, '')}_transcription.txt`;
      await service.downloadTranscription(transcription, filename);
    } catch (err) {
      console.error('[TranscribeButton] Download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download transcription');
    }
  };

  const getProgressMessage = () => {
    if (!progress) return 'Ready to transcribe';
    return progress.message;
  };

  const getProgressColor = () => {
    if (!progress) return 'bg-blue-600';
    switch (progress.stage) {
      case 'extracting':
        return 'bg-yellow-600';
      case 'transcribing':
        return 'bg-blue-600';
      case 'cleaning':
        return 'bg-purple-600';
      case 'complete':
        return 'bg-green-600';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-zinc-400" />
          <h3 className="text-sm font-medium text-zinc-200">AI Transcription</h3>
        </div>
        {transcription && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        )}
      </div>

      {/* API Key Input */}
      {showApiInput && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-zinc-400">
            Groq API Key
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-400 hover:text-blue-300 underline"
            >
              Get your free key
            </a>
          </label>
          <Input
            type="password"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
      )}

      {!showApiInput && !apiKey && (
        <Button
          onClick={() => setShowApiInput(true)}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          Add API Key
        </Button>
      )}

      {/* Transcribe Button */}
      <Button
        onClick={handleTranscribe}
        disabled={isTranscribing || !selectedClip || !apiKey}
        className="w-full"
      >
        {isTranscribing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {getProgressMessage()}
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Transcribe {selectedClip ? 'Selected Clip' : 'Clip'}
          </>
        )}
      </Button>

      {/* Progress Bar */}
      {isTranscribing && progress && (
        <div className="space-y-2">
          <Progress value={progress.progress} className={getProgressColor()} />
          <p className="text-xs text-zinc-400 text-center">{progress.message}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="bg-red-950/20 border-red-900">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Captions Success Message */}
      {hasCaptions && (
        <Alert className="bg-green-950/20 border-green-900">
          <Subtitles className="h-4 w-4 text-green-400" />
          <AlertDescription className="text-green-400">
            Captions generated! They will appear automatically when you play this clip.
          </AlertDescription>
        </Alert>
      )}

      {/* Transcription Preview */}
      {transcription && (
        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-zinc-400">Transcription:</label>
          <div className="max-h-96 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-md p-4">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {transcription}
            </p>
          </div>
        </div>
      )}

      {/* Info */}
      {!selectedClip && (
        <p className="text-xs text-zinc-500 text-center">
          Select a clip from the timeline to transcribe
        </p>
      )}
    </div>
  );
}
