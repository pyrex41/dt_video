# Quick Release Guide

## First Time Setup (Do Once)

```bash
# 1. Generate updater keys
./scripts/generate-updater-key.sh

# 2. Update tauri.conf.json with the public key shown
# 3. Add TAURI_PRIVATE_KEY to GitHub Secrets
#    (Settings > Secrets and variables > Actions)
```

## Creating a Release

```bash
# Make sure all changes are committed
git status

# Bump version and create release (choose one):
./scripts/prepare-release.sh patch  # 0.1.0 -> 0.1.1
./scripts/prepare-release.sh minor  # 0.1.0 -> 0.2.0
./scripts/prepare-release.sh major  # 0.1.0 -> 1.0.0

# Push to trigger the build
git push && git push --tags
```

## What Happens Next

1. GitHub Actions builds installers for all platforms (⏱️ ~20-30 minutes)
2. Creates a GitHub Release with all installers attached
3. Users can download from: `https://github.com/yourusername/clipforge/releases/latest`

## Installers Created

- **macOS**: `.dmg` (Apple Silicon + Intel)
- **Windows**: `.msi` + `.exe`
- **Linux**: `.AppImage` + `.deb`

## Troubleshooting

**Build failed?**
- Check GitHub Actions tab for errors
- Most common: FFmpeg download issues or signing problems

**Need to redo a release?**
```bash
git tag -d v0.1.0                    # Delete local tag
git push origin :refs/tags/v0.1.0    # Delete remote tag
# Delete release on GitHub, then recreate tag and push
```

---

📖 For detailed documentation, see [docs/RELEASING.md](./RELEASING.md)
