"use client"

import { useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/tauri"
import { Header } from "./components/header"
import { Timeline } from "./components/timeline"
import { Preview } from "./components/preview"
import { Controls } from "./components/controls"
import { MediaLibrary } from "./components/media-library"
import { AudioControls } from "./components/audio-controls"
import { useClipStore } from "./store/use-clip-store"
import { Alert, AlertDescription } from "./components/ui/alert"
import { AlertCircle, Info } from "lucide-react"

function App() {
  const { error, setError, hydrateFromWorkspace, isHydrated } = useClipStore()

  useEffect(() => {
    const initialize = async () => {
      // First, hydrate from saved workspace with validation
      await hydrateFromWorkspace()

      // Then check FFmpeg
      try {
        const version = await invoke<string>("check_ffmpeg")
        console.log("FFmpeg version:", version)
      } catch (err) {
        setError("FFmpeg not found. Please install FFmpeg to use ClipForge.")
        console.error("FFmpeg check failed:", err)
      }
    }

    initialize()
  }, [setError, hydrateFromWorkspace])

  // Show loading state while hydrating
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mb-4 text-lg text-zinc-300">Loading workspace...</div>
          <div className="text-sm text-zinc-500">Validating saved clips and settings</div>
        </div>
      </div>
    )
  }

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
          {/* Media Library Sidebar */}
          <MediaLibrary />

          {/* Main Content Area */}
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

        <AudioControls />
      </div>
    </div>
  )
}

export default App
