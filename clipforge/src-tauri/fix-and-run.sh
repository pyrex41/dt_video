#!/bin/bash
# Fix Cargo.toml and immediately run cargo build
sed -i '' 's/tauri = { version = "2.9.2", features = \["api-all"\] }/tauri = { version = "2.9.2", features = ["protocol-asset"] }/' Cargo.toml
exec cargo build
