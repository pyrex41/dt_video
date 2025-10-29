#!/bin/bash
# Fix Cargo.toml before every build
cd "$(dirname "$0")/src-tauri"
sed -i '' 's/features = \[\]/features = ["protocol-asset"]/' Cargo.toml
