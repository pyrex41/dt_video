import { create } from "zustand"
import type { Clip } from "../types/clip"

interface ClipStore {
  clips: Clip[]
  playhead: number
  isPlaying: boolean
  zoom: number
  selectedClipId: string | null
  error: string | null
  exportProgress: number

  addClip: (clip: Clip) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  removeClip: (id: string) => void
  setPlayhead: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  setSelectedClip: (id: string | null) => void
  setError: (error: string | null) => void
  setExportProgress: (progress: number) => void
  clearClips: () => void
}

export const useClipStore = create<ClipStore>((set) => ({
  clips: [],
  playhead: 0,
  isPlaying: false,
  zoom: 10,
  selectedClipId: null,
  error: null,
  exportProgress: 0,

  addClip: (clip) =>
    set((state) => ({
      clips: [...state.clips, clip],
    })),

  updateClip: (id, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  removeClip: (id) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== id),
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
    })),

  setPlayhead: (time) => set({ playhead: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom }),
  setSelectedClip: (id) => set({ selectedClipId: id }),
  setError: (error) => set({ error }),
  setExportProgress: (progress) => set({ exportProgress: progress }),
  clearClips: () => set({ clips: [], selectedClipId: null }),
}))
