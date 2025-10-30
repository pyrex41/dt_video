#!/bin/bash
# Generate Tauri updater key pair
# This creates the public/private key pair needed for app updates

set -e

echo "🔐 Generating Tauri updater key pair..."
echo ""

# Check if tauri-cli is available
if ! command -v pnpm tauri &> /dev/null; then
  echo "❌ Error: Tauri CLI not found. Make sure you've installed dependencies."
  exit 1
fi

# Generate the key
pnpm tauri signer generate -w ~/.tauri/clipforge.key

echo ""
echo "✅ Key pair generated!"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo ""
echo "1. Your PRIVATE key is stored at: ~/.tauri/clipforge.key"
echo "   - Keep this file SECRET and SECURE"
echo "   - NEVER commit this to git"
echo "   - Back it up securely (you'll need it for every release)"
echo ""
echo "2. Your PUBLIC key has been displayed above"
echo "   - Copy the public key (the long string)"
echo "   - Update src-tauri/tauri.conf.json:"
echo "     Replace 'UPDATE_WITH_YOUR_PUBLIC_KEY' with your public key"
echo "   - Add to GitHub Secrets as TAURI_PRIVATE_KEY:"
echo "     Go to: Settings > Secrets and variables > Actions > New repository secret"
echo "     Name: TAURI_PRIVATE_KEY"
echo "     Value: (paste the content of ~/.tauri/clipforge.key)"
echo ""
echo "3. Set the TAURI_KEY_PASSWORD in GitHub Secrets if you set a password"
echo ""
