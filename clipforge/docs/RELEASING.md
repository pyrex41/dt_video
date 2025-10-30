# ClipForge Release Process

This guide explains how to create and publish releases of ClipForge with downloadable installers on GitHub.

## Table of Contents

- [Overview](#overview)
- [One-Time Setup](#one-time-setup)
- [Creating a Release](#creating-a-release)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)

## Overview

ClipForge uses GitHub Actions to automatically build installers for macOS, Windows, and Linux when you push a version tag. The workflow creates a GitHub Release with downloadable installers for all platforms.

### What Gets Built

- **macOS**: `.dmg` installer (Apple Silicon and Intel)
- **Windows**: `.msi` and `.exe` installers
- **Linux**: `.AppImage` and `.deb` packages

## One-Time Setup

### 1. Generate Updater Keys

The Tauri updater requires cryptographic keys to verify updates are authentic.

```bash
# Generate the key pair
./scripts/generate-updater-key.sh
```

This will:
- Create a private key at `~/.tauri/clipforge.key`
- Display a public key (long string starting with "dW50cnVzdGVkIGNvbW1lbnQ...")

### 2. Configure the Public Key

Copy the public key and update `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [...],
      "dialog": true,
      "pubkey": "PASTE_YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### 3. Add GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add these secrets:

   **TAURI_PRIVATE_KEY**
   - Click "New repository secret"
   - Name: `TAURI_PRIVATE_KEY`
   - Value: Copy the entire content of `~/.tauri/clipforge.key`

   **TAURI_KEY_PASSWORD** (if you set a password)
   - Click "New repository secret"
   - Name: `TAURI_KEY_PASSWORD`
   - Value: Your key password

### 4. Update Repository Information

In `src-tauri/Cargo.toml`, update the repository URL:

```toml
[package]
name = "clipforge"
version = "0.1.0"
description = "A Tauri video editor application"
authors = ["Your Name <your.email@example.com>"]
repository = "https://github.com/yourusername/clipforge"
```

Also update `src-tauri/tauri.conf.json` if needed:

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/yourusername/clipforge/releases/latest/download/latest.json"
      ]
    }
  }
}
```

## Creating a Release

### Quick Release (Recommended)

Use the automated script to bump version and create a release:

```bash
# Patch version (0.1.0 -> 0.1.1)
./scripts/prepare-release.sh patch

# Minor version (0.1.0 -> 0.2.0)
./scripts/prepare-release.sh minor

# Major version (0.1.0 -> 1.0.0)
./scripts/prepare-release.sh major
```

The script will:
1. ✅ Check git status is clean
2. ⬆️  Bump version in `package.json`, `Cargo.toml`, and `tauri.conf.json`
3. 🔒 Update `Cargo.lock`
4. 💾 Create a version bump commit
5. 🏷️  Create a git tag

Then push the changes:

```bash
# Push commit and tag
git push && git push --tags
```

GitHub Actions will automatically:
- Build installers for all platforms
- Create a draft release
- Upload all installers
- Publish the release

### Manual Release Process

If you prefer to do it manually:

1. **Update version** in three places:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. **Update Cargo.lock**:
   ```bash
   cd src-tauri && cargo check && cd ..
   ```

3. **Commit changes**:
   ```bash
   git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
   git commit -m "chore: bump version to v0.1.1"
   ```

4. **Create tag**:
   ```bash
   git tag -a v0.1.1 -m "Release v0.1.1"
   ```

5. **Push**:
   ```bash
   git push && git push --tags
   ```

## How It Works

### GitHub Actions Workflow

The release process uses `.github/workflows/release.yml`:

1. **Triggered by**: Pushing a tag like `v0.1.0`
2. **Creates Release**: Makes a draft GitHub Release
3. **Builds on Multiple Platforms**:
   - macOS (Apple Silicon + Intel)
   - Windows (x64)
   - Linux (x64)
4. **Downloads FFmpeg**: Automatically downloads platform-specific FFmpeg binaries
5. **Builds Installers**: Creates signed installers for each platform
6. **Uploads to Release**: Attaches all installers to the GitHub Release
7. **Publishes**: Makes the release public

### Automatic Updates

Once a user installs ClipForge:
- The app checks for updates on startup
- If a new version is available, shows an update dialog
- Downloads and verifies the update (using the public key)
- Prompts user to install

## Download Links

After a release is published, users can download installers from:

```
https://github.com/yourusername/clipforge/releases/latest
```

Direct download links:
- **macOS (Apple Silicon)**: `ClipForge_0.1.0_aarch64.dmg`
- **macOS (Intel)**: `ClipForge_0.1.0_x64.dmg`
- **Windows**: `ClipForge_0.1.0_x64_en-US.msi`
- **Linux (AppImage)**: `clipforge_0.1.0_amd64.AppImage`
- **Linux (Debian)**: `clipforge_0.1.0_amd64.deb`

## Troubleshooting

### Build Fails on GitHub Actions

**FFmpeg Download Issues**:
- Check if FFmpeg download URLs are still valid
- macOS: https://evermeet.cx/ffmpeg/
- Windows: https://www.gyan.dev/ffmpeg/builds/
- Linux: https://johnvansickle.com/ffmpeg/

**Signing Issues (macOS)**:
- For development releases, `signingIdentity: null` is fine
- For production, you'll need Apple Developer certificates

**Missing Dependencies (Linux)**:
- The workflow installs required system libraries
- Check `.github/workflows/release.yml` if errors occur

### Tag Already Exists

If you need to recreate a release:

```bash
# Delete local tag
git tag -d v0.1.0

# Delete remote tag
git push origin :refs/tags/v0.1.0

# Delete the GitHub Release (from GitHub web UI)

# Create tag again
git tag -a v0.1.0 -m "Release v0.1.0"
git push --tags
```

### Updater Not Working

1. **Check public key** in `tauri.conf.json` matches the private key
2. **Verify GitHub Secrets** are set correctly:
   - `TAURI_PRIVATE_KEY`
   - `TAURI_KEY_PASSWORD` (if used)
3. **Check release URL** in `tauri.conf.json`:
   ```json
   "endpoints": [
     "https://github.com/OWNER/REPO/releases/latest/download/latest.json"
   ]
   ```

### Testing Locally

To test the build process locally (without releasing):

```bash
# macOS
pnpm run build:mac

# Windows (on Windows)
pnpm run build:win

# Check the output in:
# src-tauri/target/release/bundle/
```

## Best Practices

1. **Always test** builds locally before creating a release
2. **Use semantic versioning**:
   - PATCH (0.0.X) for bug fixes
   - MINOR (0.X.0) for new features
   - MAJOR (X.0.0) for breaking changes
3. **Write release notes** on GitHub after publishing
4. **Keep private key safe**:
   - Never commit to git
   - Back up securely
   - Store in password manager
5. **Test updates** by installing an old version and updating to the new one

## Additional Resources

- [Tauri GitHub Actions Guide](https://tauri.app/v1/guides/building/github-actions)
- [Tauri Updater Documentation](https://tauri.app/v1/guides/distribution/updater)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
