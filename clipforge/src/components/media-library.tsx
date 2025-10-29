"use client"

import { useState } from "react"
import { convertFileSrc } from "@tauri-apps/api/tauri"
import { Button } from "./ui/button"
import { ChevronLeft, ChevronRight, Film, ChevronDown, ChevronUp } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"

export function MediaLibrary() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null)
  const { clips } = useClipStore()

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
          <div className="flex items-center justify-between p-4 border-b border-zinc-700">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Media Library</h2>
            </div>
            <div className="text-xs text-zinc-500">
              {clips.length} {clips.length === 1 ? "clip" : "clips"}
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
            ) : (
              clips.map((clip) => (
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

                    {/* Expand/Collapse Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedClipId(expandedClipId === clip.id ? null : clip.id)
                      }}
                      className="w-full mt-1 pt-1 flex items-center justify-center text-xs text-zinc-500 hover:text-blue-400 transition-colors border-t border-zinc-700"
                    >
                      {expandedClipId === clip.id ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          More
                        </>
                      )}
                    </button>
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
