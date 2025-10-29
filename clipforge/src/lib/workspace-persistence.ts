import { invoke } from "@tauri-apps/api/tauri"
import type { Clip } from "../types/clip"

interface WorkspaceState {
  clips: Clip[]
  playhead: number
  is_playing: boolean
  zoom: number
  selected_clip_id: string | null
  export_progress: number
}

// Maximum reasonable values to prevent corrupted data
const MAX_DURATION = 3600 * 24 // 24 hours in seconds
const MAX_ZOOM = 1000
const MIN_ZOOM = 1

/**
 * Validates a single clip to ensure all values are reasonable
 */
function validateClip(clip: Clip): Clip | null {
  try {
    // Check for required fields
    if (!clip.id || !clip.path || !clip.name) {
      console.warn("[workspace] Invalid clip: missing required fields", clip)
      return null
    }

    // Validate duration
    if (
      typeof clip.duration !== "number" ||
      isNaN(clip.duration) ||
      clip.duration <= 0 ||
      clip.duration > MAX_DURATION
    ) {
      console.warn("[workspace] Invalid clip duration:", clip.duration, "for clip", clip.id)
      return null
    }

    // Validate start/end times
    if (
      typeof clip.start !== "number" ||
      typeof clip.end !== "number" ||
      isNaN(clip.start) ||
      isNaN(clip.end) ||
      clip.start < 0 ||
      clip.end <= clip.start ||
      clip.end - clip.start > MAX_DURATION
    ) {
      console.warn("[workspace] Invalid clip times:", { start: clip.start, end: clip.end }, "for clip", clip.id)
      return null
    }

    // Validate trim values
    if (
      typeof clip.trimStart !== "number" ||
      typeof clip.trimEnd !== "number" ||
      isNaN(clip.trimStart) ||
      isNaN(clip.trimEnd) ||
      clip.trimStart < 0 ||
      clip.trimEnd <= clip.trimStart ||
      clip.trimEnd > clip.duration
    ) {
      console.warn("[workspace] Invalid trim values:", { trimStart: clip.trimStart, trimEnd: clip.trimEnd }, "for clip", clip.id)
      // Auto-fix trim values instead of rejecting the clip
      return {
        ...clip,
        trimStart: 0,
        trimEnd: clip.duration,
      }
    }

    // Validate track number
    if (typeof clip.track !== "number" || isNaN(clip.track) || clip.track < 0) {
      console.warn("[workspace] Invalid track number:", clip.track, "for clip", clip.id)
      return {
        ...clip,
        track: 0,
      }
    }

    return clip
  } catch (error) {
    console.error("[workspace] Error validating clip:", error, clip)
    return null
  }
}

/**
 * Validates the entire workspace state
 */
function validateWorkspaceState(state: any): WorkspaceState {
  const defaultState: WorkspaceState = {
    clips: [],
    playhead: 0,
    is_playing: false,
    zoom: 10,
    selected_clip_id: null,
    export_progress: 0,
  }

  try {
    if (!state || typeof state !== "object") {
      console.warn("[workspace] Invalid state object, using defaults")
      return defaultState
    }

    // Validate and filter clips
    const validClips: Clip[] = []
    if (Array.isArray(state.clips)) {
      for (const clip of state.clips) {
        const validatedClip = validateClip(clip)
        if (validatedClip) {
          validClips.push(validatedClip)
        }
      }
    }

    // Validate playhead
    let playhead = 0
    if (typeof state.playhead === "number" && !isNaN(state.playhead) && state.playhead >= 0) {
      playhead = state.playhead
    }

    // Validate zoom
    let zoom = 10
    if (typeof state.zoom === "number" && !isNaN(state.zoom) && state.zoom >= MIN_ZOOM && state.zoom <= MAX_ZOOM) {
      zoom = state.zoom
    }

    // Validate selected_clip_id
    let selected_clip_id: string | null = null
    if (state.selected_clip_id && typeof state.selected_clip_id === "string") {
      // Check if the selected clip actually exists in the valid clips
      if (validClips.some((c) => c.id === state.selected_clip_id)) {
        selected_clip_id = state.selected_clip_id
      }
    }

    // Validate export_progress
    let export_progress = 0
    if (typeof state.export_progress === "number" && !isNaN(state.export_progress) && state.export_progress >= 0 && state.export_progress <= 100) {
      export_progress = state.export_progress
    }

    const validatedState: WorkspaceState = {
      clips: validClips,
      playhead,
      is_playing: false, // Always start with playing = false
      zoom,
      selected_clip_id,
      export_progress,
    }

    if (validClips.length !== state.clips?.length) {
      console.warn(`[workspace] Filtered out ${(state.clips?.length || 0) - validClips.length} invalid clips`)
    }

    return validatedState
  } catch (error) {
    console.error("[workspace] Error validating workspace state:", error)
    return defaultState
  }
}

/**
 * Load workspace from persistent storage with validation
 */
export async function loadWorkspace(): Promise<WorkspaceState | null> {
  try {
    const stateJson = await invoke<string>("load_workspace")
    const rawState = JSON.parse(stateJson)
    const validatedState = validateWorkspaceState(rawState)

    console.log("[workspace] Loaded and validated workspace", {
      clipsCount: validatedState.clips.length,
      playhead: validatedState.playhead,
      zoom: validatedState.zoom,
    })

    return validatedState
  } catch (error) {
    console.warn("[workspace] No workspace to load or error loading:", error)
    return null
  }
}

/**
 * Save workspace to persistent storage
 */
export async function saveWorkspace(state: WorkspaceState): Promise<void> {
  try {
    // Validate state before saving to prevent saving corrupted data
    const validatedState = validateWorkspaceState(state)
    const stateJson = JSON.stringify(validatedState)

    await invoke("save_workspace", { stateJson })
    console.log("[workspace] Saved workspace successfully")
  } catch (error) {
    console.error("[workspace] Failed to save workspace:", error)
    throw error
  }
}

/**
 * Debounced save function to prevent excessive saves
 */
let saveTimeout: NodeJS.Timeout | null = null
const SAVE_DEBOUNCE_MS = 1000 // Save at most once per second

export function debouncedSaveWorkspace(state: WorkspaceState): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = setTimeout(() => {
    saveWorkspace(state).catch((error) => {
      console.error("[workspace] Debounced save failed:", error)
    })
  }, SAVE_DEBOUNCE_MS)
}
