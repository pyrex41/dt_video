import { ImportButton } from "./import-button"
import { ExportButton } from "./export-button"
import { RecordButton } from "./record-button"
import Logo from "../logo.svg"

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
      <div className="flex items-center gap-3">
        <Logo className="h-7 w-7 text-zinc-100" />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">ClipForge</h1>
      </div>

      <div className="flex items-center gap-3">
        <ImportButton />
        <RecordButton />
        <ExportButton />
      </div>
    </header>
  )
}
