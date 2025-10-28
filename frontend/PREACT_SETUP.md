# Switching to Preact for Production

This project is currently configured with React for v0 preview compatibility. To switch to Preact for your Tauri production build (reducing bundle size from 42KB to 3KB), follow these steps:

## 1. Install Preact Dependencies

\`\`\`bash
npm install preact
npm install -D @preact/preset-vite
\`\`\`

## 2. Update vite.config.ts

\`\`\`ts
import { defineConfig } from "vite"
import preact from "@preact/preset-vite"
import path from "path"

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime"
    },
  },
  // ... rest of config
})
\`\`\`

## 3. Update src/main.tsx

\`\`\`tsx
import { render } from "preact"
import App from "./App"
import "./index.css"

render(<App />, document.getElementById("root")!)
\`\`\`

## 4. Update tsconfig.json

Add to compilerOptions:
\`\`\`json
{
  "compilerOptions": {
    "jsxImportSource": "preact",
    "paths": {
      "@/*": ["./src/*"],
      "react": ["./node_modules/preact/compat/"],
      "react-dom": ["./node_modules/preact/compat/"]
    }
  }
}
\`\`\`

## 5. Optional: Remove React

\`\`\`bash
npm uninstall react react-dom @types/react @types/react-dom @vitejs/plugin-react
\`\`\`

All your components will work exactly the same with Preact thanks to the compatibility layer!
