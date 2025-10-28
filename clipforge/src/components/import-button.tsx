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
    <Button onClick={handleImport} disabled={isImporting} variant="outline" size="sm">
      <Upload className="mr-2 h-4 w-4" />
      {isImporting ? "Importing..." : "Import"}
    </Button>
  )
}
