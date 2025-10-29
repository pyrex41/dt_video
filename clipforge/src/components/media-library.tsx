"use client"

import { useState, useMemo } from "react"
import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { Button } from "./ui/button"
import { ChevronLeft, ChevronRight, Film, ChevronDown, ChevronUp, Search, Trash2, X, RefreshCw } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"
import { Input } from "./ui/input"

export function MediaLibrary() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = useState(false)
  const { clips, deleteClip } = useClipStore()

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const formatBitRate = (bps: number): string => {
    if (bps < 1000) return `${bps} bps`
    if (bps < 1000000) return `${(bps / 1000).toFixed(0)} kbps`
    return `${(bps / 1000000).toFixed(1)} Mbps`
  }

  // Filter and search logic
  const filteredClips = useMemo(() => {
    if (!searchQuery) return clips

    const query = searchQuery.toLowerCase()
    return clips.filter((clip) => {
      // Search by name
      if (clip.name.toLowerCase().includes(query)) return true

      // Search by codec
      if (clip.codec && clip.codec.toLowerCase().includes(query)) return true

      // Search by resolution
      if (clip.resolution && clip.resolution.toLowerCase().includes(query)) return true

      // Search by file size (e.g., "5MB", "100KB")
      if (clip.file_size) {
        const sizeStr = formatFileSize(clip.file_size).toLowerCase()
        if (sizeStr.includes(query)) return true
      }

      // Search by FPS
      if (clip.fps && clip.fps.toString().includes(query)) return true

      return false
    })
  }, [clips, searchQuery])

  const handleDelete = async (clipId: string) => {
    try {
      await deleteClip(clipId)
      setDeleteConfirmId(null)
      setExpandedClipId(null)
    } catch (err) {
      console.error('[MediaLibrary] Delete failed:', err)
      alert('Failed to delete clip. Please try again.')
    }
  }

  const handleRegenerateThumbnails = async () => {
    try {
      setIsRegeneratingThumbnails(true)
      await invoke('regenerate_thumbnails')
      alert('Thumbnails regenerated successfully!')
      // Force a re-render by triggering a state update
      window.location.reload()
    } catch (err) {
      console.error('[MediaLibrary] Thumbnail regeneration failed:', err)
      alert('Failed to regenerate thumbnails. Please check the console for details.')
    } finally {
      setIsRegeneratingThumbnails(false)
    }
  }

  return (
    <div
      className={`relative flex flex-col bg-zinc-900 border-r border-zinc-700 transition-all duration-300 ${
        isCollapsed ? "w-12" : "w-80"
      }`}
    >
      {/* Toggle Button */}
      <Button
        onClick={() => setIsCollapsed(!isCollapsed)}
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Collapsed State */}
      {isCollapsed ? (
        <div className="flex flex-col items-center py-4 gap-2">
          <Film className="h-6 w-6 text-zinc-500" />
          <div className="text-xs text-zinc-500 [writing-mode:vertical-lr] rotate-180">
            Media Library
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="p-4 border-b border-zinc-700 space-y-3">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Film className="h-5 w-5 text-blue-500" />
                 <h2 className="text-lg font-semibold">Media Library</h2>
               </div>
               <div className="flex items-center gap-2">
                 <button
                   onClick={handleRegenerateThumbnails}
                   disabled={isRegeneratingThumbnails}
                   className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
                   title="Regenerate thumbnails for clips without them"
                 >
                   <RefreshCw className={`h-3 w-3 ${isRegeneratingThumbnails ? 'animate-spin' : ''}`} />
                   {isRegeneratingThumbnails ? 'Generating...' : 'Thumbnails'}
                 </button>
                 <div className="text-xs text-zinc-500">
                   {filteredClips.length} of {clips.length}
                 </div>
               </div>
             </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="text"
                placeholder="Search by name, codec, resolution..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-zinc-800 border-zinc-700 text-sm h-9 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Clips List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {clips.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">
                <Film className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No clips yet</p>
                <p className="text-xs mt-1">Import videos to get started</p>
              </div>
            ) : filteredClips.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No results found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              filteredClips.map((clip) => (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/json", JSON.stringify(clip))
                    e.dataTransfer.effectAllowed = "copy"
                    // Add visual feedback
                    if (e.currentTarget instanceof HTMLElement) {
                      e.currentTarget.style.opacity = "0.5"
                    }
                  }}
                  onDragEnd={(e) => {
                    // Reset visual feedback
                    if (e.currentTarget instanceof HTMLElement) {
                      e.currentTarget.style.opacity = "1"
                    }
                  }}
                  className="bg-zinc-800 rounded-lg p-3 border border-zinc-700 hover:border-blue-500 transition-colors cursor-grab active:cursor-grabbing group"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-zinc-700 rounded mb-2 overflow-hidden group-hover:ring-2 group-hover:ring-blue-500 transition-all">
                    {clip.thumbnail_path ? (
                      <img
                        src={convertFileSrc(clip.thumbnail_path)}
                        alt={clip.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-8 w-8 text-zinc-500" />
                      </div>
                    )}
                  </div>

                  {/* Clip Info */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium truncate" title={clip.name}>
                      {clip.name}
                    </p>

                    {/* Basic Metadata Row */}
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{formatDuration(clip.duration)}</span>
                      <span className="text-zinc-600">•</span>
                      <span>{clip.resolution || "Unknown"}</span>
                      {clip.file_size && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span>{formatFileSize(clip.file_size)}</span>
                        </>
                      )}
                    </div>

                    {/* Expandable Details */}
                    {expandedClipId === clip.id && (
                      <div className="mt-2 pt-2 border-t border-zinc-700 space-y-1 text-xs">
                        {clip.codec && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Codec:</span>
                            <span className="text-zinc-300 font-mono">{clip.codec.toUpperCase()}</span>
                          </div>
                        )}
                        {clip.fps && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Frame Rate:</span>
                            <span className="text-zinc-300">{clip.fps.toFixed(2)} fps</span>
                          </div>
                        )}
                        {clip.bit_rate && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Bit Rate:</span>
                            <span className="text-zinc-300">{formatBitRate(clip.bit_rate)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Trim Range:</span>
                          <span className="text-zinc-300">
                            {formatDuration(clip.trimStart)} - {formatDuration(clip.trimEnd)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-1 mt-2 border-t border-zinc-700 pt-2">
                      {deleteConfirmId === clip.id ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(clip.id)
                            }}
                            className="flex-1 py-1.5 px-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Confirm Delete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(null)
                            }}
                            className="flex-1 py-1.5 px-2 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedClipId(expandedClipId === clip.id ? null : clip.id)
                            }}
                            className="flex-1 py-1.5 px-2 text-xs text-zinc-500 hover:text-blue-400 hover:bg-zinc-700 rounded transition-colors flex items-center justify-center gap-1"
                          >
                            {expandedClipId === clip.id ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                More
                              </>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(clip.id)
                            }}
                            className="py-1.5 px-3 text-xs text-red-400 hover:text-red-300 hover:bg-zinc-700 rounded transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
