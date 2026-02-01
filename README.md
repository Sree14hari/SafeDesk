# SafeDesk (SecureEngine for Internet Cafe and PrintShops)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Framework](https://img.shields.io/badge/framework-Electron-47848F)
![Frontend](https://img.shields.io/badge/frontend-Next.js-black)
![Language](https://img.shields.io/badge/language-TypeScript-blue)
![Security](https://img.shields.io/badge/security-Forensic--Grade%20Wipe-red)
![Architecture](https://img.shields.io/badge/architecture-Session--Based-orange)
![Deployment](https://img.shields.io/badge/deployment-Offline%20Ready-green)
![Build](https://img.shields.io/badge/build-EXE%20Installer-success)

## Overview

SafeDesk (SecureEngine) is a **forensically secure, session-based public workspace system** designed for shared computer environments such as internet cafés, service centers, libraries, and public kiosks.

The system enables users to perform sensitive tasks—such as document printing, file uploads, and web browsing—within a **fully isolated, ephemeral session** that leaves **zero residual data** on the host machine after completion. All user activity is confined to a temporary workspace that is **automatically and irreversibly destroyed** at the end of each session.

Unlike traditional public computer solutions that rely on trust-based cleanup mechanisms, SafeDesk introduces a **proof-based security model**. After every session, users receive **verifiable confirmation of data destruction** through a QR-based compliance report, ensuring transparency and trust.

SafeDesk operates entirely **offline**, without cloud services or persistent backends, and is packaged as a **standalone Windows application**, making it easy to deploy while maintaining strong security guarantees.

## Tech Stack

### Core Platform
- **Electron** – Desktop application framework for building cross-platform native applications using web technologies
- **Node.js** – Runtime environment for backend logic and system-level operations

### Frontend (Renderer Process)
- **Next.js** – UI framework used for building the interactive user interface (statically exported)
- **React** – Component-based UI development
- **TypeScript** – Type-safe development for improved reliability and maintainability

### Backend / System Layer (Main Process)
- **TypeScript** – Core language for session management, security logic, and system orchestration
- **Electron Main Process APIs** – File system access, process control, and OS-level integrations

### Security & Data Handling
- **Custom Secure Wipe Engine** – Multi-stage data sanitization (overwrite, rename obfuscation, unlink, force delete)
- **Ephemeral Session Directories** – Session-bound, temporary storage ensuring zero persistence
- **Memory-Only Browser Partition** – Prevents cache, cookies, and credential storage

### AI & Policy Engine
- **Google Gemini 2.5 Flash** (via OpenRouter) – AI-assisted policy advisor for dynamic security decisions
- **Policy Engine** – Rule-based enforcement combined with AI recommendations

### Mobile & Networking
- **Local HTTP Server** – Secure, ephemeral upload server for QR-based mobile file transfers
- **QR Code Integration** – Enables fast, contactless multi-device connectivity

### Build & Deployment
- **Electron Builder** – Packaging and distribution as a standalone Windows executable
- **NSIS** – Installer generation for Windows
- **npm** – Dependency management and build scripting

### Operating System
- **Windows** – Primary target platform for deployment


## File Structure

The project follows a modular structure separating the **Electron core**, **UI renderer**, and **assets**, ensuring maintainability and clear responsibility boundaries.

```markdown
SecureEngine/
├── assets/
│   └── icon.png                 # Application icon (used in build/installer)
│
├── electron/
│   ├── main.ts                  # Electron main process entry
│   ├── preload.ts               # Secure preload bridge
│   ├── sessionManager.ts        # Session lifecycle & FSM
│   ├── secureWipe.ts            # Forensic-grade secure wipe engine
│   ├── uploadServer.ts          # QR-based local upload server
│   └── policyEngine.ts          # Policy enforcement & AI integration
│
├── renderer/
│   ├── next-app/                # Next.js UI application
│   │   ├── app/                 # App Router pages (UI routes)
│   │   ├── .next/               # Next.js build cache
│   │   ├── next.config.js       # Next.js configuration (static export)
│   │   ├── tsconfig.json        # TypeScript config for UI
│   │   └── next-env.d.ts        # Next.js environment types
│   │
│   ├── package.json             # Renderer dependencies & scripts
│   └── package-lock.json
│
├── .gitignore                   # Git ignore rules
├── README.md                    # Project documentation
├── SECURITY.md                  # Security model & guarantees
├── AI_SETUP.md                  # AI policy engine setup guide
│
├── package.json                 # Root project config (Electron + Builder)
├── package-lock.json
└── tsconfig.json                # Global TypeScript configuration

```

### Structure Highlights

- **`electron/`**  
  Contains all privileged system logic including session control, secure wiping, upload server, and policy enforcement.

- **`renderer/`**  
  Houses the Next.js-based UI, exported as static files and loaded by Electron.

- **`assets/`**  
  Stores application branding assets such as icons.

- **Documentation Files (`README.md`, `SECURITY.md`, `AI_SETUP.md`)**  
  Clearly separate usage, security guarantees, and AI configuration details.

This structure ensures **clear separation of concerns**, improved security, and easier scalability.
```
