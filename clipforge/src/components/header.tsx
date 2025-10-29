import { ImportButton } from "./import-button"
import { ExportButton } from "./export-button"
import { RecordButton } from "./record-button"
import { SaveButton } from "./save-button"
import { ResetButton } from "./reset-button"
import Logo from "../logo.svg"

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-700 bg-zinc-900 px-6 py-4 shadow-lg">
      <div className="flex items-center gap-4">
        <Logo className="h-8 w-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ClipForge</h1>
          <p className="text-xs text-zinc-400">Video Editor</p>
        </div>
        <ResetButton />
      </div>

      <div className="flex items-center gap-3">
        <ImportButton />
        <RecordButton />
        <SaveButton />
        <ExportButton />
      </div>
    </header>
  )
}
