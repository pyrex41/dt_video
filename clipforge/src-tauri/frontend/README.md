# ClipForge Elm Frontend

Elm + Vite + Tailwind CSS frontend for ClipForge video editor.

## Setup Complete ✓

### Dependencies Installed

**Node.js packages:**
- `vite` v7.1.12 - Fast development server and build tool
- `vite-plugin-elm` v3.0.1 - Elm integration for Vite
- `tailwindcss` v4.1.16 - Utility-first CSS framework
- `postcss` v8.5.6 - CSS transformation
- `autoprefixer` v10.4.21 - Automatic vendor prefixes
- `@tauri-apps/api` v2.9.0 - Tauri API bindings

**Elm packages:**
- `elm/browser` v1.0.2
- `elm/core` v1.0.5
- `elm/html` v1.0.0
- `joakin/elm-canvas` v5.0.0 - Canvas rendering library
- `avh4/elm-color` v1.0.0 (dependency)

### Project Structure

```
frontend/
├── src/
│   ├── Main.elm           # Main Elm application with Elm Architecture
│   ├── main.js            # JavaScript entry point, initializes Elm
│   └── index.css          # Tailwind CSS directives
├── index.html             # HTML entry point
├── vite.config.js         # Vite configuration with elm plugin
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── elm.json               # Elm dependencies
└── package.json           # npm dependencies and scripts
```

### Configuration Files

**vite.config.js:**
- Configured with `vite-plugin-elm`
- Tauri-specific settings (port 1420, build targets)

**tailwind.config.js:**
- Scans `./src/**/*.elm` and `./index.html` for classes
- Ready for Tailwind utility classes in Elm

**elm.json:**
- Application type
- Source directory: `src`
- Elm v0.19.1

### Scripts

```bash
# Development server (recommended)
pnpm run dev

# Production build
pnpm run build

# Preview production build
pnpm run preview
```

### Current Status

✅ **Working:**
- All dependencies installed
- Elm compiles successfully
- Dev server runs at http://localhost:1420
- Tailwind CSS integrated
- Basic Main.elm with Elm Architecture scaffold

⚠️ **Known Issue:**
- `pnpm run build` fails due to spaces in directory path (`dt_video worktrees`)
- vite-plugin-elm has issues with URL-encoded paths (%20)
- **Workaround:** Use dev server, or rename parent directory without spaces

### Main.elm Features

Current implementation demonstrates:
- Elm Architecture (Model-View-Update)
- Browser.element program
- Tailwind CSS utility classes
- Responsive layout with flexbox
- Basic component structure

### Next Steps

Proceed to **Task #3**: Implement basic app UI layout with Tailwind CSS
- Create import button, timeline pane, and preview pane
- Use Tailwind utility classes for responsive design (800x600 minimum)
- Follow Elm Architecture patterns

## Development

1. Start dev server:
   ```bash
   cd clipforge/src-tauri/frontend
   pnpm run dev
   ```

2. Open http://localhost:1420 in browser

3. Edit `src/Main.elm` - changes hot-reload automatically

## Resources

- [Elm Guide](https://guide.elm-lang.org/)
- [elm-canvas documentation](https://package.elm-lang.org/packages/joakin/elm-canvas/latest/)
- [Tailwind CSS docs](https://tailwindcss.com/docs)
- [Vite docs](https://vite.dev/)
