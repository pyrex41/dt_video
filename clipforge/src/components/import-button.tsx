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
        multiple: true,
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "mov", "webm", "avi"],
          },
        ],
      })

      if (!selected) return

      // Handle both single file (string) and multiple files (array) for backwards compatibility
      const files = Array.isArray(selected) ? selected : [selected]
      if (files.length === 0) return

      // Import each file sequentially
      let importedCount = 0
      let failedCount = 0
      const errors: string[] = []
      let currentEnd = clips.length > 0 ? Math.max(...clips.map((c) => c.end)) : 0

      for (const filePath of files) {
        try {
          const fileName = filePath.split("/").pop() || filePath.split("\\").pop() || "video.mp4"

          const metadata = await invoke<VideoMetadata>("import_file", {
            filePath: filePath,
          })

          const newClip: Clip = {
            id: `clip_${Date.now()}_${importedCount}`,
            path: metadata.file_path,
            name: fileName,
            start: currentEnd,
            end: currentEnd + metadata.duration,
            duration: metadata.duration,
            track: 0,
            trimStart: 0,
            trimEnd: metadata.duration,
            resolution: `${metadata.width}x${metadata.height}`,
            thumbnail_path: metadata.thumbnail_path,
          }

          addClip(newClip)
          currentEnd += metadata.duration // Update for next clip
          importedCount++
          console.log("[v0] Imported clip:", newClip)
        } catch (fileError) {
          failedCount++
          const fileName = filePath.split("/").pop() || filePath.split("\\").pop() || filePath
          errors.push(`${fileName}: ${fileError}`)
          console.error(`[v0] Import error for ${fileName}:`, fileError)
        }
      }

      // Provide user feedback
      if (importedCount > 0 && failedCount === 0) {
        console.log(`[v0] Successfully imported ${importedCount} file(s)`)
      } else if (importedCount > 0 && failedCount > 0) {
        setError(`Imported ${importedCount} file(s), but ${failedCount} failed: ${errors.join(", ")}`)
      } else if (failedCount > 0) {
        setError(`Failed to import all files: ${errors.join(", ")}`)
      }
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
