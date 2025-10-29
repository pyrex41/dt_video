# Merge Plan: Add Elm Frontend from reconnect Branch

## Goal
Bring only the Elm frontend and frontend switching system from `reconnect` branch into `master`. Keep all backend files from master unchanged.

## What to Copy from reconnect

### 1. Elm Frontend Directory
- `clipforge/src-tauri/frontend/` (entire directory)
  - Contains complete Elm app
  - Has its own package.json, vite config, tailwind config
  - Compiled elm-stuff (can regenerate)

### 2. Frontend Switching System

**Files:**
- `clipforge/src-tauri/tauri.conf.react.json` - React config template
- `clipforge/src-tauri/tauri.conf.elm.json` - Elm config template
- `FRONTEND_SWITCHING_GUIDE.md` - Documentation

**Package.json additions:**
```json
"scripts": {
  "use-react": "cp src-tauri/tauri.conf.react.json src-tauri/tauri.conf.json && echo 'Switched to React frontend (port 1420)'",
  "use-elm": "cp src-tauri/tauri.conf.elm.json src-tauri/tauri.conf.json && echo 'Switched to Elm frontend (port 5173)'",
  "dev:elm": "cd src-tauri/frontend && pnpm run dev",
  "tauri:elm": "pnpm run use-elm && pnpm run tauri dev",
  "tauri:react": "pnpm run use-react && pnpm run tauri dev"
}
```

### 3. Optional Documentation
- `IMPLEMENTATION_LOG_A.md` - Elm implementation notes
- `IMPLEMENTATION_LOG_B.md` - Continuation notes
- `TAURI_INTEGRATION_GUIDE.md` - Integration documentation
- `.taskmaster/docs/prd-frontend-elm.md` - Elm PRD
- `.taskmaster/tasks/task_*_elm.txt` - Elm tasks

### 4. Tailwind v4 Upgrade (Optional)
- Update `tailwindcss` to v4.0.0 in package.json
- Add `@tailwindcss/postcss` plugin
- Update `postcss.config.js`
- Update `clipforge/src/index.css` if needed

## What NOT to Copy

- ❌ `clipforge/src-tauri/src/lib.rs` - Keep master's version (has FFmpeg optimizations)
- ❌ `clipforge/src-tauri/Cargo.toml` - Keep master's version
- ❌ Any other backend Rust files
- ❌ React component changes from reconnect (master has latest)

## Step-by-Step Commands

```bash
# 1. Ensure we're on master with clean state
git status
git stash  # if needed

# 2. Copy Elm frontend directory
git checkout reconnect -- clipforge/src-tauri/frontend

# 3. Copy config templates
git checkout reconnect -- clipforge/src-tauri/tauri.conf.react.json
git checkout reconnect -- clipforge/src-tauri/tauri.conf.elm.json

# 4. Copy documentation
git checkout reconnect -- FRONTEND_SWITCHING_GUIDE.md
git checkout reconnect -- IMPLEMENTATION_LOG_A.md
git checkout reconnect -- IMPLEMENTATION_LOG_B.md
git checkout reconnect -- TAURI_INTEGRATION_GUIDE.md

# 5. Copy Elm taskmaster files (optional)
git checkout reconnect -- .taskmaster/docs/prd-frontend-elm.md
git checkout reconnect -- .taskmaster/tasks/task_001_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_002_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_003_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_004_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_005_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_006_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_007_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_008_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_009_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_010_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_011_elm.txt
git checkout reconnect -- .taskmaster/tasks/task_012_elm.txt

# 6. Manually update clipforge/package.json
# Add the 5 new scripts to "scripts" section (see below)

# 7. Create React config template from current config
cp clipforge/src-tauri/tauri.conf.json clipforge/src-tauri/tauri.conf.react.json

# 8. Set default to React
cd clipforge
pnpm run use-react

# 9. Install dependencies
pnpm install
cd src-tauri/frontend
pnpm install
cd ../..

# 10. Test React frontend
pnpm run tauri:react

# 11. Test Elm frontend
# Terminal 1: pnpm run dev:elm
# Terminal 2: pnpm run tauri:elm

# 12. Commit
git add .
git commit -m "feat: add Elm frontend and frontend switching system"
```

## Manual package.json Update

Open `clipforge/package.json` and add these scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "use-react": "cp src-tauri/tauri.conf.react.json src-tauri/tauri.conf.json && echo 'Switched to React frontend (port 1420)'",
    "use-elm": "cp src-tauri/tauri.conf.elm.json src-tauri/tauri.conf.json && echo 'Switched to Elm frontend (port 5173)'",
    "dev:elm": "cd src-tauri/frontend && pnpm run dev",
    "tauri:elm": "pnpm run use-elm && pnpm run tauri dev",
    "tauri:react": "pnpm run use-react && pnpm run tauri dev"
  }
}
```

## Optional: Tailwind v4 Upgrade

If you want to also upgrade Tailwind CSS to v4:

```bash
# Update package.json dependencies
# Change: "tailwindcss": "3.4.17" -> "tailwindcss": "^4.0.0"
# Add: "@tailwindcss/postcss": "^4.0.0"
# Remove: "autoprefixer": "^10.4.21" (not needed in v4)

# Update postcss.config.js
git checkout reconnect -- clipforge/postcss.config.js

# Update main CSS if needed
git checkout reconnect -- clipforge/src/index.css

# Reinstall
cd clipforge
pnpm install
```

## Verification Checklist

After merge:

- [ ] Elm frontend directory exists at `clipforge/src-tauri/frontend/`
- [ ] Two config templates exist: `tauri.conf.react.json` and `tauri.conf.elm.json`
- [ ] Package.json has all 5 new scripts
- [ ] `pnpm run use-react` works (switches config)
- [ ] `pnpm run use-elm` works (switches config)
- [ ] React frontend runs: `pnpm run tauri:react`
- [ ] Elm frontend runs: `pnpm run dev:elm` + `pnpm run tauri:elm`
- [ ] Backend unchanged (lib.rs still has FFmpeg optimizations)
- [ ] No backend files copied from reconnect

## Directory Structure After Merge

```
clipforge/
├── src/                          # React frontend (existing)
│   ├── components/
│   ├── store/
│   └── main.jsx
├── src-tauri/
│   ├── frontend/                 # NEW: Elm frontend
│   │   ├── src/
│   │   │   ├── Main.elm
│   │   │   └── main.js
│   │   ├── elm.json
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── tailwind.config.js
│   ├── src/
│   │   └── lib.rs                # UNCHANGED: Master's version
│   ├── tauri.conf.json           # Active config
│   ├── tauri.conf.react.json     # NEW: React template
│   └── tauri.conf.elm.json       # NEW: Elm template
└── package.json                  # Updated with new scripts
```

## Estimated Time
- File copying: 5 minutes
- Manual package.json edit: 2 minutes
- Dependency installation: 3-5 minutes
- Testing both frontends: 10 minutes

**Total: ~20 minutes**

## Success Criteria

✅ Both frontends coexist in the project
✅ Can switch between them with npm scripts
✅ React frontend works with master's backend
✅ Elm frontend works with master's backend
✅ Backend code unchanged from master
✅ Both frontends share same Tauri Rust backend
