"use client"

import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "./ui/button"
import { Save, Check } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"

export function SaveButton() {
  const [isSaving, setIsSaving] = useState(false)
  const { clips, playhead, isPlaying, zoom, selectedClipId, exportProgress, setError } = useClipStore()

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const stateToSave = {
        clips: clips.map((c) => ({
          id: c.id,
          name: c.name,
          path: c.path,
          start: c.start,
          end: c.end,
          duration: c.duration,
        })),
        playhead,
        is_playing: isPlaying,
        zoom,
        selected_clip_id: selectedClipId,
        export_progress: exportProgress,
      }

      await invoke("save_workspace", { stateJson: JSON.stringify(stateToSave) })
      console.log("Workspace saved manually")
      // Show success indicator briefly
      setTimeout(() => {
        // Could add a small success animation here
      }, 100)
    } catch (err) {
      setError(`Failed to save workspace: ${err}`)
      console.error("Save error:", err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="relative group">
      <Button 
        onClick={handleSave} 
        disabled={isSaving}
        variant="ghost"
        size="icon"
        className="h-12 w-12 hover:bg-zinc-700 text-white border-2 border-zinc-500 hover:border-zinc-400 transition-all duration-200 shadow-lg"
      >
        {isSaving ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
        ) : (
          <Save className="h-6 w-6" />
        )}
      </Button>
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
        Save Project
      </div>
    </div>
  )
}