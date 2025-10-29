"use client"

import { useClipStore } from "../store/use-clip-store"
import { Volume2, VolumeX } from "lucide-react"
import { Slider } from "./ui/slider"

export function AudioControls() {
  const { clips, selectedClipId, updateClip } = useClipStore()

  const selectedClip = clips.find(c => c.id === selectedClipId)

  if (!selectedClip) {
    return (
      <div className="bg-zinc-900 border-t border-zinc-800 p-4">
        <div className="text-sm text-zinc-500 text-center">
          Select a clip to adjust audio settings
        </div>
      </div>
    )
  }

  const volume = selectedClip.volume ?? 1
  const muted = selectedClip.muted ?? false

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0]
    updateClip(selectedClip.id, { volume: newVolume })
  }

  const handleMuteToggle = () => {
    updateClip(selectedClip.id, { muted: !muted })
  }

  const displayVolume = Math.round(volume * 100)

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Audio Controls</h3>
          <div className="text-xs text-zinc-500">{selectedClip.name}</div>
        </div>

        {/* Volume Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Volume</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 font-mono w-12 text-right">
                {muted ? "Muted" : `${displayVolume}%`}
              </span>
              <button
                onClick={handleMuteToggle}
                className={`p-2 rounded-md transition-colors ${
                  muted
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Slider
            value={[volume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.01}
            disabled={muted}
            className={muted ? "opacity-50" : ""}
          />
        </div>

        {/* Waveform Placeholder */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Waveform</label>
          <div className="h-16 bg-zinc-800 rounded-md border border-zinc-700 flex items-center justify-center overflow-hidden relative">
            {/* Simple waveform visualization */}
            <div className="absolute inset-0 flex items-center justify-around px-1">
              {Array.from({ length: 60 }).map((_, i) => {
                // Generate pseudo-random heights for waveform bars
                const seed = selectedClip.id.charCodeAt(i % selectedClip.id.length) * (i + 1)
                const height = (Math.sin(seed) * 0.5 + 0.5) * 80 + 10
                const opacity = muted ? 0.3 : 0.7

                return (
                  <div
                    key={i}
                    className="bg-blue-500 w-0.5 rounded-full transition-opacity"
                    style={{
                      height: `${height}%`,
                      opacity,
                    }}
                  />
                )
              })}
            </div>
            {muted && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <VolumeX className="h-8 w-8 text-red-400" />
              </div>
            )}
          </div>
        </div>

        {/* Audio Info */}
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800">
          <div>
            Duration: {selectedClip.duration.toFixed(2)}s
          </div>
          {selectedClip.bit_rate && (
            <div>
              Bit Rate: {(selectedClip.bit_rate / 1000).toFixed(0)} kbps
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
