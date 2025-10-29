import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { invoke } from "@tauri-apps/api/tauri"
import type { Clip } from "../types/clip"
import { debouncedSaveWorkspace, loadWorkspace } from "../lib/workspace-persistence"

interface ClipStore {
  clips: Clip[]
  playhead: number
  isPlaying: boolean
  zoom: number
  selectedClipId: string | null
  error: string | null
  exportProgress: number
  isHydrated: boolean

  addClip: (clip: Clip) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  removeClip: (id: string) => void
  deleteClip: (id: string) => Promise<void>
  setPlayhead: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  autoFitZoom: (timelineWidth: number) => void
  setSelectedClip: (id: string | null) => void
  setError: (error: string | null) => void
  setExportProgress: (progress: number) => void
  clearClips: () => void
  resetWorkspace: () => Promise<void>
  loadState: (state: Partial<ClipStore>) => void
  trimClip: (id: string, start: number, end: number) => Promise<void>
  hydrateFromWorkspace: () => Promise<void>
}

export const useClipStore = create<ClipStore>()(
  subscribeWithSelector((set, get) => ({
  clips: [],
  playhead: 0,
  isPlaying: false,
  zoom: 10,
  selectedClipId: null,
  error: null,
  exportProgress: 0,
  isHydrated: false,

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

  deleteClip: async (id) => {
    const state = get()
    const clip = state.clips.find(c => c.id === id)
    if (!clip) return

    try {
      // Delete the file from disk
      await invoke('delete_clip', { filePath: clip.path })

      // Remove from state
      set((state) => ({
        clips: state.clips.filter((c) => c.id !== id),
        selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
      }))
    } catch (err) {
      console.error('[ClipForge] Delete clip failed:', err)
      throw err
    }
  },

  setPlayhead: (time) => set({ playhead: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom }),

  autoFitZoom: (timelineWidth) => {
    const state = get()
    if (state.clips.length === 0) {
      set({ zoom: 10 })
      return
    }

    // Get the longest clip end time
    const maxDuration = Math.max(...state.clips.map(c => c.end))

    // Calculate zoom to fit with 10% padding on the right
    const usableWidth = timelineWidth * 0.9
    const calculatedZoom = usableWidth / maxDuration

    // Clamp between reasonable values
    const zoom = Math.max(5, Math.min(50, calculatedZoom))

    console.log('[ClipForge] Auto-fit zoom:', { timelineWidth, maxDuration, zoom })
    set({ zoom })
  },

  setSelectedClip: (id) => set({ selectedClipId: id }),
  setError: (error) => set({ error }),
  setExportProgress: (progress) => set({ exportProgress: progress }),
  clearClips: () => set({ clips: [], selectedClipId: null }),

  resetWorkspace: async () => {
    try {
      // Delete all files and workspace state from disk
      await invoke('reset_workspace')

      // Reset all state to initial values
      set({
        clips: [],
        playhead: 0,
        isPlaying: false,
        zoom: 10,
        selectedClipId: null,
        error: null,
        exportProgress: 0,
      })
    } catch (err) {
      console.error('[ClipForge] Reset workspace failed:', err)
      throw err
    }
  },

  loadState: (state) => set(state),

  hydrateFromWorkspace: async () => {
    try {
      const workspace = await loadWorkspace()
      if (workspace) {
        set({
          clips: workspace.clips,
          playhead: workspace.playhead,
          isPlaying: workspace.is_playing,
          zoom: workspace.zoom,
          selectedClipId: workspace.selected_clip_id,
          exportProgress: workspace.export_progress,
          isHydrated: true,
        })
        console.log("[store] Hydrated from workspace")
      } else {
        set({ isHydrated: true })
        console.log("[store] No workspace to hydrate from")
      }
    } catch (error) {
      console.error("[store] Failed to hydrate from workspace:", error)
      set({ isHydrated: true }) // Mark as hydrated even on error
    }
  },

  trimClip: async (id, trimStart, trimEnd) => {
    const state = get()
    const clip = state.clips.find(c => c.id === id)
    if (!clip) return

    try {
      console.log("[ClipForge] Applying trim:", { id, trimStart, trimEnd, originalPath: clip.path })

      // Create trimmed file path
      const timestamp = Date.now()
      const outputPath = clip.path.replace('/clips/', '/clips/edited/').replace(/\.mp4$/, `_trimmed_${timestamp}.mp4`)

      // Call backend to create trimmed file
      await invoke('trim_clip', {
        inputPath: clip.path,
        outputPath,
        startTime: trimStart,
        endTime: trimEnd,
      })

      const newDuration = trimEnd - trimStart
      const clipTimelinePosition = clip.start

      // Update clip to use trimmed file and reset trim bounds
      set((state) => {
        const updatedClips = state.clips.map(c => c.id === id ? {
          ...c,
          path: outputPath,
          duration: newDuration,
          start: clipTimelinePosition,
          end: clipTimelinePosition + newDuration,
          trimStart: 0,
          trimEnd: newDuration,
        } : c)

        // Constrain playhead to new clip bounds
        const newClip = updatedClips.find(c => c.id === id)!
        let constrainedPlayhead = state.playhead

        if (state.playhead < newClip.start) {
          constrainedPlayhead = newClip.start
        } else if (state.playhead > newClip.end) {
          constrainedPlayhead = newClip.end
        }

        console.log("[ClipForge] Playhead constrained after trim:", {
          oldPlayhead: state.playhead,
          newPlayhead: constrainedPlayhead,
          clipBounds: { start: newClip.start, end: newClip.end }
        })

        return {
          clips: updatedClips,
          playhead: constrainedPlayhead,
        }
      })

      console.log("[ClipForge] Trim applied successfully, new path:", outputPath)
    } catch (err) {
      console.error('[ClipForge] Trim failed:', err)
      throw err
    }
  },
})))

// Auto-save workspace when relevant state changes
useClipStore.subscribe(
  (state) => ({
    clips: state.clips,
    playhead: state.playhead,
    is_playing: state.isPlaying,
    zoom: state.zoom,
    selected_clip_id: state.selectedClipId,
    export_progress: state.exportProgress,
  }),
  (workspace) => {
    // Only save if the store has been hydrated to avoid overwriting on initial load
    if (useClipStore.getState().isHydrated) {
      debouncedSaveWorkspace(workspace)
    }
  },
  {
    // Save on any change to these fields
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  }
)
