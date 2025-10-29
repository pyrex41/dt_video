"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { useClipStore } from "../store/use-clip-store"

export function ResetButton() {
  const [isResetting, setIsResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const resetWorkspace = useClipStore((state) => state.resetWorkspace)

  const handleReset = async () => {
    try {
      setIsResetting(true)
      await resetWorkspace()
      setShowConfirm(false)

      // Reload the page to ensure clean state
      window.location.reload()
    } catch (error) {
      console.error("Failed to reset workspace:", error)
      setIsResetting(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-300">Delete all clips?</span>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResetting ? "Resetting..." : "Confirm"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="flex items-center gap-2 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-zinc-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-zinc-700 hover:shadow-lg"
      title="Reset workspace (delete all clips)"
    >
      <RotateCcw className="h-4 w-4" />
      Reset
    </button>
  )
}
