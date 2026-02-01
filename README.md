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


## Installation

Follow the steps below to clone, build, and run SafeDesk locally on your Windows machine.

### 1. Clone the Repository

```bash
git clone https://github.com/Sree14hari/SafeDesk.git
cd SafeDesk
````

---

### 2. Install Dependencies (Root)

Install all the required Node.js dependencies for the root project:

```bash
npm install
```

---

### 3. Install Dependencies for Renderer

Next, install the dependencies for the UI (Next.js) renderer:

```bash
cd renderer/next-app
npm install
```

---

### 4. Build the Next.js UI

Generate a production-ready static export of the UI:

```bash
npm run export
```

This will create a static `out/` folder containing the built UI.

---

### 5. Build the Electron Main Process

Return to the root directory and compile the Electron backend:

```bash
cd ../../
npm run electron:build
```

---

### 6. Package the Application

Package the app into a standalone Windows installer using Electron Builder:

```bash
npx electron-builder
```

After completion, the installer EXE will be available at:

```
dist/installers/safedesk Setup <version>.exe
```

---

### 7. Run the Installer

Double-click the generated `.exe` file to install SafeDesk on your Windows system.

---

## Notes

* Ensure you have **Node.js** installed (LTS recommended).
* If you encounter build issues, run `npm install` again at the appropriate directory.
* For production builds, always ensure the UI export runs successfully before packaging.

---

## Features

### 🔐 Secure Session Management
- Session-based isolated workspaces with strict lifecycle control  
- Enforced state transitions: **IDLE → ACTIVE → DESTRUCTION → CLEAN**  
- Automatic session termination on inactivity or timeout  

### 🗂️ Ephemeral Data Handling
- All user files are stored in temporary, session-bound directories  
- Zero data persistence after session completion  
- No access to host system folders during active sessions  

### 🧨 Forensic-Grade Secure Wipe
- Multi-stage data sanitization:
  - File overwrite
  - Rename obfuscation
  - Secure unlinking
  - Forced deletion fallback for locked files
- Designed to prevent forensic data recovery  

### 📱 QR-Based Secure File Upload
- Local, ephemeral upload server accessible via QR code  
- No cloud usage or third-party servers  
- Direct mobile-to-session file transfer  

### 🖨️ Rapid Multi-Device Printing
- Multiple devices can connect simultaneously using a single QR code  
- Parallel file uploads from different users  
- One-click **“Print All”** batch printing  
- Optimized for high-traffic public environments  

### 🌐 Ephemeral Web Browsing (Task Zone)
- Memory-only browser partition (no cookies, cache, or history)  
- All downloads are redirected to the secure session directory  
- Browser state destroyed at session end  

### 🤖 AI-Assisted Policy Enforcement
- Context-aware AI policy advisor (session duration, time, activity)  
- Dynamically adjusts security parameters such as auto-logout timing  
- AI recommendations enforced through rule-based policies  

### 🧹 Residue Guard
- Scans common host folders (Desktop, Downloads) for accidental leaks  
- Securely cleans detected files using the same wipe engine  
- Prevents human-error-based data exposure  

### 📄 User-Verifiable Wipe Report
- Post-session compliance certificate displayed via QR code  
- Includes session duration and number of files destroyed  
- Allows users to verify data destruction independently  

### 📴 Offline-First Design
- Operates entirely without internet connectivity  
- No cloud backend, no user accounts, no external dependencies  

### 📦 Production-Ready Deployment
- Packaged as a standalone Windows installer (`.exe`)  
- Runs without requiring Node.js or development tools  
- Designed for real-world public terminal deployment  

---
## Usage

SafeDesk is designed to be simple to use for both **end users** and **operators**, while maintaining strict security guarantees. The workflow below describes a complete session lifecycle.

---

### 1. Launching SafeDesk
- Start the SafeDesk application from the installed desktop shortcut or Start Menu.
- The system initializes in the **IDLE** state, indicating a clean and ready environment.

---

### 2. Selecting an Operational Zone
Users can choose one of the following modes:
- **Print Zone** – For secure document uploads and printing
- **Task Zone** – For temporary web browsing and downloads

Each session is fully isolated and bound to the selected zone.

---

### 3. Using the Print Zone
- A QR code is displayed on the screen.
- Users scan the QR code using their mobile devices.
- Multiple devices can connect **simultaneously** to the same session.
- Files uploaded from all devices appear in the secure session workspace.
- The operator clicks **“Print All”** to print all queued documents in one batch.

---

### 4. Using the Task Zone
- A sandboxed, memory-only browser is launched.
- Users can browse the web normally.
- Any downloaded files are redirected into the secure session directory.
- No cookies, cache, or credentials are stored on disk.

---

### 5. Monitoring the Session
- The dashboard displays:
  - Session timer
  - File count and total size
  - AI-based risk level (Low / Medium / High)
- Security policies may automatically adjust based on session activity.

---

### 6. Ending the Session
- The session can be ended manually by the operator or automatically via timeout.
- All active operations are stopped immediately.

---

### 7. Secure Data Destruction
- A final scan counts all session files.
- The Secure Wipe Engine permanently destroys all session data.
- Host system locations are optionally scanned using Residue Guard.

---

### 8. Viewing the Wipe Report
- The system displays a **Destruction Complete** message.
- A QR code appears on the final screen.
- Scanning the QR code shows a compliance report containing:
  - Session duration
  - Number of files destroyed
  - Confirmation of successful cleanup

---

### 9. Ready for Next User
- The system returns to the **IDLE** state.
- SafeDesk is ready for a new secure session with no residual data.

---
## Security Model

SafeDesk is built using a **secure-by-design** approach that enforces strict data isolation, controlled execution, and guaranteed data destruction. The security model is centered around minimizing the attack surface and eliminating data persistence in public computing environments.

### 1. Threat Model

SafeDesk is designed to protect against the following threats:

- Data leakage from previous user sessions
- Recovery of deleted files using forensic tools
- Accidental data storage in host system folders
- Credential theft via browser cache or cookies
- Unauthorized access from concurrently connected devices
- Misuse of public terminals after session termination

The system assumes the **host operating system is untrusted across sessions** and enforces cleanup regardless of user behavior.

---

### 2. Session Isolation

- Each session operates within a **unique, temporary directory**.
- All uploads, downloads, and generated files are confined to this directory.
- Session directories are inaccessible once the session ends.
- No data is shared between concurrent or sequential sessions.

---

### 3. Ephemeral Execution Environment

- Web browsing occurs in a **memory-only browser partition**.
- No disk-based cache, cookies, or history are created.
- Browser state is fully destroyed when the session ends.
- Downloads are redirected exclusively into the session directory.

---

### 4. Secure Data Destruction

SafeDesk uses a **forensic-grade secure wipe engine** to ensure irreversible data deletion:

- File contents are overwritten before deletion.
- Files are renamed multiple times to break recovery patterns.
- Secure unlinking removes filesystem references.
- Forced deletion mechanisms handle locked or busy files.
- Wipe operations are verified using post-deletion scans.

---

### 5. Residue Guard

- Common leakage-prone locations (Desktop, Downloads) are scanned.
- Any detected session-related files are securely destroyed.
- The same wipe engine is used to ensure consistent sanitization.

---

### 6. Controlled External Access

- Mobile devices can only upload files via a **session-bound QR code**.
- Devices cannot view or access files uploaded by other devices.
- Device identifiers are ephemeral and exist only in memory.
- Upload access is revoked immediately after session termination.

---

### 7. AI-Assisted Policy Enforcement

- An AI policy advisor evaluates session risk in real time.
- Security parameters (timeouts, restrictions) adapt dynamically.
- AI provides recommendations; enforcement remains deterministic.
- No user content is permanently stored or logged by the AI system.

---

### 8. Fail-Safe Cleanup

- Secure wipe is triggered on:
  - Manual session termination
  - Inactivity timeouts
  - Application crashes or unexpected exits
- Ensures cleanup even in abnormal shutdown scenarios.

---

### 9. User-Verifiable Security

- After every session, a compliance report is generated.
- Users receive proof of data destruction via a QR-based report.
- This shifts security from a **trust-based** to a **proof-based** model.

---

### 10. Security Guarantees

SafeDesk guarantees:
- Zero data persistence after session completion
- No cross-session or cross-device data leakage
- No cloud storage or external data transmission
- Transparent and verifiable data destruction

---

## AI Policy Engine

The AI Policy Engine enhances SafeDesk’s security by **dynamically adapting system policies based on session context**, while preserving determinism, privacy, and operator control. It is designed as an **advisory layer**, not an autonomous authority.

---

### 1. Purpose

Traditional public terminal systems rely on static security rules. SafeDesk introduces an AI-assisted layer to:

- Detect high-risk usage patterns in real time
- Adapt security parameters dynamically
- Reduce human oversight without sacrificing control
- Improve protection during abnormal or suspicious sessions

---

### 2. Architecture Role

- The AI Policy Engine operates alongside the rule-based Policy Engine.
- It **analyzes session metadata only**, never raw user content.
- AI outputs recommendations, which are validated and enforced by the core policy system.

---

### 3. Data Inputs

The AI evaluates the following **non-sensitive session parameters**:

- Session duration
- Time of day
- File upload frequency
- Number of connected devices
- Operational zone (Print Zone / Task Zone)

⚠️ **No file contents, personal data, or browsing data are shared with the AI.**

---

### 4. Decision Outputs

Based on analyzed context, the AI may recommend:

- Risk level classification (Low / Medium / High)
- Reduced inactivity timeouts
- Session duration limits
- Stricter cleanup triggers

These recommendations are applied only if they conform to predefined system rules.

---

### 5. Privacy & Safety Guarantees

- AI operates in a **stateless advisory mode**
- No user-identifiable data is stored or logged
- No persistent profiling across sessions
- All AI decisions are ephemeral and session-scoped

---

### 6. Fail-Safe Design

- If the AI service is unavailable, SafeDesk falls back to **default static policies**
- Core security functionality remains unaffected
- No session is blocked due to AI failure

---

### 7. Benefits

- Adaptive security without increased attack surface
- Improved detection of abnormal session behavior
- Reduced reliance on manual supervision
- Balanced integration of AI with deterministic enforcement

---
## Future Scope

SafeDesk is designed with extensibility in mind. While the current system is production-ready for secure public workspace use, several enhancements can further expand its capabilities, scalability, and adoption.

---

### 1. Enhanced Security Mechanisms
- Integration with hardware-based security modules such as **TPM** or secure enclaves
- Support for configurable data sanitization standards (e.g., **NIST 800-88** levels)
- Cryptographic verification of wipe operations

---

### 2. Offline AI Policy Engine
- Replacement of cloud-based AI models with **local, lightweight inference models**
- Fully air-gapped deployments for high-security environments
- Reduced dependency on external AI services

---

### 3. Cross-Platform Support
- Extension of SafeDesk to **Linux and macOS**
- Unified security model across multiple operating systems
- Increased adoption in diverse deployment environments

---

### 4. Advanced Print & Device Management
- Encrypted print pipelines from mobile devices to printers
- Fine-grained device access controls
- Rate-limiting and prioritization for high-volume printing scenarios

---

### 5. Role-Based Access Control
- Separate roles for administrators, operators, and users
- Policy customization based on role and environment
- Audit-friendly configuration management

---

### 6. Analytics & Monitoring (Privacy-Preserving)
- Aggregated, anonymized usage statistics
- Performance and reliability insights
- No storage of user-identifiable data

---

### 7. Enterprise & Government Deployment
- Centralized configuration distribution (offline-compatible)
- Support for controlled enterprise environments
- Custom deployment profiles for government and institutional use

---

### 8. Kiosk & OS-Level Integration
- Deep integration with Windows Kiosk Mode
- Automatic startup and lockdown configurations
- Hardening against OS-level escape attempts

---

### 9. Expanded Compliance Reporting
- Downloadable compliance certificates
- Optional audit logs for organizations
- Extended reporting formats for regulatory environments

---

### 10. Commercial & Product Evolution
- White-label versions for service providers
- Licensing and managed deployment options
- Plugin architecture for custom extensions

## FAQ
### What problem does SafeDesk solve?
SafeDesk prevents **data leakage on public and shared computers** by ensuring that all user activity occurs in a temporary, isolated session that is completely destroyed after use.

---

### How is SafeDesk different from incognito mode or browser-based solutions?
Incognito mode only disables history and cookies but **does not prevent file persistence, downloads, or forensic recovery**. SafeDesk enforces full session isolation and performs **forensic-grade secure data destruction**, with user-verifiable proof.

---

### Does SafeDesk store any user data?
No. SafeDesk does not store user data, browsing history, credentials, or uploaded files beyond the active session.

---

### Is an internet connection required?
No. SafeDesk operates **entirely offline**, except when optional AI services are enabled.

---

### How are mobile devices connected?
Users connect by scanning a **session-specific QR code**, which opens a local upload interface. No cloud servers or external services are involved.

---

### Can multiple users upload files at the same time?
Yes. SafeDesk supports **concurrent multi-device uploads**, allowing multiple users to send files simultaneously during a single session.

---

### What happens if the application crashes?
SafeDesk includes **fail-safe cleanup mechanisms** that trigger secure data destruction even during unexpected shutdowns or crashes.

---

### Can users access files uploaded by other devices?
No. Devices can upload files but **cannot view or access files uploaded by other users**.

---

### Is SafeDesk secure against forensic recovery?
Yes. SafeDesk uses a **multi-stage secure wipe engine** designed to prevent data recovery using forensic tools.

---

### Does SafeDesk require cloud services?
No. SafeDesk is designed to work **without cloud dependencies**, making it suitable for privacy-sensitive environments.

---

### Which operating systems are supported?
Currently, SafeDesk supports **Windows**. Cross-platform support is planned for future versions.

---

### Is AI mandatory for SafeDesk to function?
No. The AI Policy Engine is optional. SafeDesk continues to operate securely using static policies if AI services are unavailable.

---

### Can SafeDesk be deployed in government or enterprise environments?
Yes. SafeDesk is well-suited for **government offices, educational institutions, service centers, and enterprises** where secure public computing is required.

---

### Is SafeDesk open-source?
Yes. SafeDesk is an open-source project. Refer to the repository license for details.


