"use client"

import { useEffect } from "react"
import { invoke } from "@tauri-apps/api/tauri"
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
