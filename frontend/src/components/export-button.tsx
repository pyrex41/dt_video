"use client"

import { useState } from "react"
import { save } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "./ui/button"
import { Download } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import { Progress } from "./ui/progress"

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false)
  const { clips, setError, exportProgress, setExportProgress } = useClipStore()

  const handleExport = async () => {
    if (clips.length === 0) {
      setError("No clips to export")
      return
    }

    try {
      setIsExporting(true)
      setError(null)
      setExportProgress(0)

      const outputPath = await save({
        defaultPath: "output.mp4",
        filters: [
          {
            name: "Video",
            extensions: ["mp4"],
          },
        ],
      })

      if (!outputPath) {
        setIsExporting(false)
        return
      }

      const clipPaths = clips.map((c) => c.path)

      await invoke("export_video", {
        inputs: clipPaths,
        output: outputPath,
        resolution: "1280x720",
      })

      setExportProgress(100)
      console.log("[v0] Export completed:", outputPath)
    } catch (err) {
      setError(`Failed to export video: ${err}`)
      console.error("[v0] Export error:", err)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(0), 2000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleExport} disabled={isExporting || clips.length === 0} size="sm">
        <Download className="mr-2 h-4 w-4" />
        {isExporting ? "Exporting..." : "Export"}
      </Button>
      {isExporting && exportProgress > 0 && <Progress value={exportProgress} className="w-24" />}
    </div>
  )
}
