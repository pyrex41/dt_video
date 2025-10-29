"use client"

import { useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/tauri"
import { Header } from "./components/header"
import { Timeline } from "./components/timeline"
import { Preview } from "./components/preview"
import { Controls } from "./components/controls"
import { useClipStore } from "./store/use-clip-store"
import { Alert, AlertDescription } from "./components/ui/alert"
import { AlertCircle, Info } from "lucide-react"

function App() {
  const { error, setError, loadState } = useClipStore()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const saveWorkspace = async (state: any) => {
    try {
      const stateToSave = {
        clips: state.clips.map((c: any) => ({
          id: c.id,
          name: c.name,
          path: c.path,
          start: c.start,
          end: c.end,
          duration: c.duration,
          trimStart: c.trimStart || 0,
          trimEnd: c.trimEnd || c.duration || 0,
        })),
        playhead: state.playhead,
        is_playing: state.isPlaying,
        zoom: state.zoom,
        selected_clip_id: state.selectedClipId,
        export_progress: state.exportProgress,
      }
      await invoke("save_workspace", { stateJson: JSON.stringify(stateToSave) })
      console.log("Workspace saved with", stateToSave.clips.length, "clips")
    } catch (err) {
      console.error("Failed to save workspace:", err)
    }
  }

  const debouncedSave = (state: any) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveWorkspace(state)
    }, 2000) // 2 second debounce
  }

  useEffect(() => {
    const checkFFmpeg = async () => {
      try {
        const version = await invoke<string>("check_ffmpeg")
        console.log("FFmpeg version:", version)
      } catch (err) {
        setError("FFmpeg not found. Please install FFmpeg to use ClipForge.")
        console.error("FFmpeg check failed:", err)
      }
    }

    const loadWorkspace = async () => {
      try {
        const workspaceJson = await invoke<string>("load_workspace")
        const state = JSON.parse(workspaceJson)
        // Add defaults for missing fields in clips
        const clipsWithDefaults = state.clips.map((clip: any) => ({
          ...clip,
          track: clip.track || 0,
          trimStart: clip.trimStart || 0,
          trimEnd: clip.trimEnd || clip.duration || 0,
          resolution: clip.resolution || undefined,
          fps: clip.fps || undefined,
        }))
        loadState({
          ...state,
          clips: clipsWithDefaults,
          isPlaying: state.is_playing || false, // match field name
        })
        console.log("Loaded workspace with", clipsWithDefaults.length, "clips")
      } catch (err) {
        console.log("No saved workspace found, starting fresh")
      }
    }

    checkFFmpeg()
    loadWorkspace()

    // Subscribe to store changes for auto-save
    const unsubscribe = useClipStore.subscribe((state) => {
      debouncedSave(state)
    })

    return () => {
      unsubscribe()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [setError, loadState])

  return (
    <div className="min-h-screen flex flex-col bg-black text-white p-8">
      <div className="flex flex-col h-full bg-zinc-900 rounded-lg overflow-hidden shadow-2xl border border-zinc-800">
        <Header />

        {error && (
          <Alert variant="destructive" className="mx-6 mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 flex items-center justify-center p-8 bg-zinc-800 rounded-lg mx-6 mt-4 mb-4">
              <Preview />
            </div>
            <Controls />
          </div>
        </div>

        <div className="border-t border-zinc-700">
          <Timeline />
        </div>
      </div>
    </div>
  )
}

export default App
