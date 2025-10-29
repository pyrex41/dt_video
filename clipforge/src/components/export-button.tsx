"use client"

import { useState } from "react"
import { invoke } from "@tauri-apps/api/tauri"
import { save } from "@tauri-apps/api/dialog"
import { Button } from "./ui/button"
import { Download, Settings } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import { Progress } from "./ui/progress"
import { Alert, AlertDescription } from "./ui/alert"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu"
import { CheckCircle } from "lucide-react"

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false)
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p")
  const [estimatedProgress, setEstimatedProgress] = useState(0)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [exportedFileName, setExportedFileName] = useState<string | null>(null)

  const { clips, setError, exportProgress, setExportProgress } = useClipStore()

  const handleExport = async () => {
    // Validate clips
    if (clips.length === 0) {
      setError("No clips to export")
      return
    }

    // Filter and validate clips
    const validClips = clips.filter(c => c.path && c.path.trim() !== '')
    if (validClips.length === 0) {
      setError("No valid clips found")
      return
    }

    try {
      setIsExporting(true)
      setError(null)
      setExportProgress(0)
      setEstimatedProgress(0)
      setExportSuccess(false)

      // Show save dialog with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const outputPath = await save({
        defaultPath: `clipforge-export-${timestamp}.mp4`,
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

      // Ensure .mp4 extension
      const finalPath = outputPath.toLowerCase().endsWith('.mp4')
        ? outputPath
        : `${outputPath}.mp4`

      // Sort clips by timeline position (start time)
      const sortedClips = [...validClips].sort((a, b) => a.start - b.start)

      // Prepare clips with trim information
      const clipsWithTrim = sortedClips.map(c => ({
        path: c.path,
        trim_start: c.trimStart,
        trim_end: c.trimEnd
      }))

      console.log("[ClipForge] Exporting clips:", clipsWithTrim)
      console.log("[ClipForge] Output path:", finalPath)
      console.log("[ClipForge] Resolution:", resolution)
      console.log("[ClipForge] Total clips:", clipsWithTrim.length)

      // Start progress estimation
      let progressValue = 0
      const progressInterval = setInterval(() => {
        progressValue += 5
        if (progressValue <= 90) {
          setEstimatedProgress(progressValue)
          setExportProgress(progressValue)
        }
      }, 500)

      // Invoke backend export
      const result = await invoke<string>("export_video", {
        clips: clipsWithTrim,
        outputPath: finalPath,
        resolution,
      })

      // Clear interval and complete
      clearInterval(progressInterval)
      setExportProgress(100)
      setEstimatedProgress(100)

      // Show success message
      setExportSuccess(true)
      setExportedFileName(finalPath.split('/').pop() || finalPath.split('\\').pop() || 'video.mp4')

      console.log("[ClipForge] Export completed successfully:", result)

    } catch (err) {
      setError(`Export failed: ${err}`)
      console.error("[ClipForge] Export error:", err)
    } finally {
      setIsExporting(false)

      // Reset progress after delay
      setTimeout(() => {
        setExportProgress(0)
        setEstimatedProgress(0)
      }, 2000)

      // Hide success message after delay
      setTimeout(() => {
        setExportSuccess(false)
        setExportedFileName(null)
      }, 5000)
    }
  }

  return (
    <>
      {exportSuccess && exportedFileName && (
        <Alert className="fixed top-4 right-4 z-50 w-96 bg-green-900/20 border-green-700">
          <CheckCircle className="h-4 w-4 text-green-400 mr-2" />
          <AlertDescription className="flex items-center">
            Export successful: {exportedFileName}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <div className="relative group">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 hover:bg-zinc-700 text-white border-2 border-zinc-500 hover:border-zinc-400 transition-all duration-200 shadow-lg"
                disabled={isExporting}
              >
                <Settings className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-zinc-800 border-zinc-700 p-2 rounded-lg shadow-xl">
              <DropdownMenuItem 
                onClick={() => setResolution("720p")}
                className="cursor-pointer hover:bg-zinc-700 rounded-md p-2 flex items-center gap-3 text-white"
              >
                <span className="w-6 text-center">📱</span>
                <span className="text-sm">720p (1280×720)</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setResolution("1080p")}
                className="cursor-pointer hover:bg-zinc-700 rounded-md p-2 flex items-center gap-3 text-white"
              >
                <span className="w-6 text-center">🖥️</span>
                <span className="text-sm">1080p (1920×1080)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
            Export Settings
          </div>
        </div>

        <div className="relative group">
          <Button
            onClick={handleExport}
            disabled={isExporting || clips.length === 0}
            size="icon"
            className="h-12 w-12 bg-green-600 hover:bg-green-500 text-white border-2 border-green-500 shadow-lg transition-all duration-200"
          >
            <Download className="h-6 w-6" />
          </Button>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-lg">
            Export Video
          </div>
        </div>

        {isExporting && estimatedProgress > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${estimatedProgress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 font-mono">{Math.round(estimatedProgress)}%</span>
          </div>
        )}
      </div>
    </>
  )
}
