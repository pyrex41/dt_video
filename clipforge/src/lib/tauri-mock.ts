// Mock Tauri API for browser preview environment
// Detects if running in Tauri or browser and provides appropriate implementations

// Check if we're running in Tauri environment
export const isTauri = typeof window !== "undefined" && "__TAURI__" in window

// Mock invoke function for browser
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    // Dynamic import to avoid loading Tauri in browser
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core")
    return tauriInvoke<T>(cmd, args)
  }

  // Mock implementations for browser preview
  console.log(`[v0] Mock Tauri command: ${cmd}`, args)

  switch (cmd) {
    case "check_ffmpeg":
      return "FFmpeg 6.0 (mock)" as T

    case "import_file":
      return JSON.stringify({
        duration: 10.5,
        resolution: "1920x1080",
        fps: 30,
      }) as T

    case "record_webcam_clip":
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return "Recording started (mock)" as T

    case "save_recording":
      return "Recording saved (mock)" as T

    case "trim_clip":
      return "Clip trimmed (mock)" as T

    case "export_video":
      return "Export completed (mock)" as T

    default:
      throw new Error(`Mock command not implemented: ${cmd}`)
  }
}

// Mock dialog functions
export async function open(options?: {
  multiple?: boolean
  filters?: Array<{ name: string; extensions: string[] }>
}): Promise<string | string[] | null> {
  if (isTauri) {
    const { open: tauriOpen } = await import("@tauri-apps/plugin-dialog")
    return tauriOpen(options)
  }

  console.log("[v0] Mock file dialog opened", options)
  // Return a mock file path for preview
  return "/mock/video.mp4"
}

export async function save(options?: {
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}): Promise<string | null> {
  if (isTauri) {
    const { save: tauriSave } = await import("@tauri-apps/plugin-dialog")
    return tauriSave(options)
  }

  console.log("[v0] Mock save dialog opened", options)
  // Return a mock output path for preview
  return "/mock/output.mp4"
}
