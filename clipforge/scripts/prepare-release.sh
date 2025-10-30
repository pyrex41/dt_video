#!/bin/bash
# ClipForge Release Preparation Script
# Usage: ./scripts/prepare-release.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}

echo "🚀 Preparing ClipForge release..."

# Check if we're on a clean git state
if [[ -n $(git status -s) ]]; then
  echo "❌ Error: Working directory is not clean. Please commit or stash your changes."
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Bump version in package.json
echo "⬆️  Bumping version ($VERSION_TYPE)..."
pnpm version $VERSION_TYPE --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✨ New version: $NEW_VERSION"

# Update Cargo.toml version
echo "📝 Updating Cargo.toml..."
sed -i.bak "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
rm src-tauri/Cargo.toml.bak

# Update tauri.conf.json version
echo "📝 Updating tauri.conf.json..."
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
rm src-tauri/tauri.conf.json.bak

# Update Cargo.lock
echo "🔒 Updating Cargo.lock..."
cd src-tauri
cargo check
cd ..

# Stage changes
echo "📋 Staging changes..."
git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json

# Create commit
echo "💾 Creating version bump commit..."
git commit -m "chore: bump version to v$NEW_VERSION"

# Create tag
echo "🏷️  Creating git tag..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo ""
echo "✅ Release prepared successfully!"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git show"
echo "  2. Push the commit and tag: git push && git push --tags"
echo "  3. GitHub Actions will automatically build and create the release"
echo ""
echo "Or to undo:"
echo "  git tag -d v$NEW_VERSION"
echo "  git reset --hard HEAD~1"
