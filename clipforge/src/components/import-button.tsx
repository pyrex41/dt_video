"use client"

import { useState } from "react"
import { open } from "@tauri-apps/api/dialog"
import { invoke } from "@tauri-apps/api/tauri"
import { Button } from "./ui/button"
import { Upload } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import type { Clip, VideoMetadata } from "../types/clip"

export function ImportButton() {
  const [isImporting, setIsImporting] = useState(false)
  const { addClip, setError, clips } = useClipStore()

  const handleImport = async () => {
    try {
      setIsImporting(true)
      setError(null)

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "mov", "webm", "avi"],
          },
        ],
      })

      if (!selected || Array.isArray(selected)) return

      const fileName = selected.split("/").pop() || selected.split("\\").pop() || "video.mp4"

      const metadata = await invoke<VideoMetadata>("import_file", {
        filePath: selected,
      })

      const newClip: Clip = {
        id: `clip_${Date.now()}`,
        path: metadata.file_path,
        name: fileName,
        start: clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0,
        end: (clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0) + metadata.duration,
        duration: metadata.duration,
        track: 0,
        trimStart: 0,
        trimEnd: metadata.duration,
        resolution: `${metadata.width}x${metadata.height}`,
      }

      addClip(newClip)
      console.log("[v0] Imported clip:", newClip)
    } catch (err) {
      setError(`Failed to import video: ${err}`)
      console.error("[v0] Import error:", err)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="relative group">
      <Button 
        onClick={handleImport} 
        disabled={isImporting}
        variant="ghost"
        size="icon"
        className="h-12 w-12 hover:bg-blue-600 text-white border-2 border-blue-500 hover:border-blue-400 transition-all duration-200 shadow-lg"
      >
        {isImporting ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
        ) : (
          <Upload className="h-6 w-6" />
        )}
      </Button>
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
        Import Video
      </div>
    </div>
  )
}
