Start the ClipForge Tauri development server

Steps:
1. Kill any existing ClipForge processes
2. Start the development server with `pnpm run tauri dev` in background
3. Wait 8 seconds for the server to fully start
4. Check the server output to confirm it's running
5. Report the server status to the user

Important:
- The server runs Vite on http://localhost:1420/
- The Rust backend auto-compiles when files change
- Look for "Camera permission granted" and "Nokhwa initialized successfully" in logs
- The ClipForge window should open automatically
