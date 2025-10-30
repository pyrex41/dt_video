# ClipForge Scripts

Utility scripts for development and release management.

## Release Scripts

### `prepare-release.sh`

Automates version bumping and release preparation.

**Usage:**
```bash
./scripts/prepare-release.sh [patch|minor|major]
```

**Examples:**
```bash
# Patch release: 0.1.0 -> 0.1.1
./scripts/prepare-release.sh patch

# Minor release: 0.1.0 -> 0.2.0
./scripts/prepare-release.sh minor

# Major release: 0.1.0 -> 1.0.0
./scripts/prepare-release.sh major
```

**What it does:**
1. Checks git status is clean
2. Bumps version in `package.json`, `Cargo.toml`, and `tauri.conf.json`
3. Updates `Cargo.lock`
4. Creates a commit with the version changes
5. Creates a git tag

**After running:**
```bash
git push && git push --tags
```

### `generate-updater-key.sh`

Generates cryptographic keys for the Tauri updater (one-time setup).

**Usage:**
```bash
./scripts/generate-updater-key.sh
```

**What it does:**
1. Generates a public/private key pair
2. Saves private key to `~/.tauri/clipforge.key`
3. Displays the public key to add to `tauri.conf.json`

**Important:**
- Run this ONCE during initial setup
- Keep the private key SECRET and SECURE
- Add the private key to GitHub Secrets as `TAURI_PRIVATE_KEY`
- Add the public key to `src-tauri/tauri.conf.json`

See [docs/RELEASING.md](../docs/RELEASING.md) for detailed setup instructions.

## Other Scripts

### `src-tauri/scripts/fix-cargo.sh`

Helper script for fixing Cargo build issues (moved from root).
