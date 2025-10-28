"use client"

import { useEffect } from "react"
import { invoke, isTauri } from "./lib/tauri-mock"
import { Header } from "./components/header"
import { Timeline } from "./components/timeline"
import { Preview } from "./components/preview"
import { Controls } from "./components/controls"
import { useClipStore } from "./store/use-clip-store"
import { Alert, AlertDescription } from "./components/ui/alert"
import { AlertCircle, Info } from "lucide-react"

function App() {
  const { error, setError } = useClipStore()

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
    checkFFmpeg()
  }, [setError])

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />

      {!isTauri && (
        <Alert className="m-4 border-zinc-700 bg-zinc-800">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-zinc-300">
            Preview Mode: Running in browser with mock data. Build with Tauri for full functionality.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <Preview />
          <Controls />
        </div>
      </div>

      <Timeline />
    </div>
  )
}

export default App
