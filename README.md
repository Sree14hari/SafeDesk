# Secure Electron App (Phase 0)

A secure Windows desktop application foundation using Electron and Next.js.

## Architecture

- **Main Process**: Electron (Secure, Node Integration Disabled)
- **Renderer**: Next.js (Static Export, Offline Support)
- **IPC**: Context Isolation used for secure communication.

## Setup

1. `npm install`
2. `npm run dev` (Starts Next.js and Electron concurrently)

## Structure

- `/electron`: Main process and Preload scripts.
- `/renderer/next-app`: Next.js source code.

## Security

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
