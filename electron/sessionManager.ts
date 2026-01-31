import * as fs from 'fs-extra';
import * as path from 'path';
import { PersistenceManager, SystemState } from './persistenceManager';
import { EventEmitter } from 'events';
import { secureWipeSession, secureDeleteFile } from './secureWipe';
import { PrintManager } from './printManager';
import { ViewerManager } from './viewerManager';
import { AuditLogger } from './auditLogger';
import { UploadServer } from './uploadServer';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { TaskBrowser } from './taskBrowser';

const BASE_DIR = 'C:\\SafeDesk\\sessions';
const TASK_DIR = 'C:\\SafeDesk\\tasks';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export interface FileMetadata { name: string; size: number; originalPath: string | null; source: 'IMPORT' | 'SCAN' | 'UPLOAD'; }
export interface SessionInfo { id: string | null; startTime: number | null; totalSize: number; fileCount: number; state: SystemState; mode: SystemMode; type: 'PRINT' | 'TASK'; uploadUrl?: string | null; }

export type SystemMode = 'CUSTOMER' | 'OWNER';

export class SessionManager extends EventEmitter {
  private activeSessionId: string | null = null;
  private sessionPath: string | null = null;
  private importedFiles: FileMetadata[] = [];
  
  private startTime: number | null = null;
  private totalSize: number = 0;

  private inactivityTimer: NodeJS.Timeout | null = null;
  private persistence: PersistenceManager;
  
  private printManager: PrintManager;
  private viewerManager: ViewerManager;
  private auditLogger: AuditLogger;
  private uploadServer: UploadServer;
  private uploadUrl: string | null = null;
  private taskBrowser: TaskBrowser | null = null;

  // Strict State Machine
  private state: SystemState = 'IDLE';
  private mode: SystemMode = 'CUSTOMER';
  private sessionType: 'PRINT' | 'TASK' = 'PRINT';

  constructor() {
    super();
    fs.ensureDirSync(BASE_DIR);
    this.persistence = new PersistenceManager();
    this.auditLogger = new AuditLogger();
    this.printManager = new PrintManager();
    this.viewerManager = new ViewerManager();
    this.uploadServer = new UploadServer();
    
    this.uploadServer.on('session-end-requested', () => {
         console.log('[SessionManager] Mobile user requested session end.');
         this.endSession('MOBILE_USER');
    });

    this.uploadServer.on('file-uploaded', async (filePath: string) => {
        if (this.state !== 'ACTIVE_SESSION') return;
        
        console.log(`[SessionManager] QR Upload received: ${filePath}`);
        this.notifyActivity();

        try {
            const stats = await fs.stat(filePath);
            const metadata: FileMetadata = {
                name: path.basename(filePath),
                size: stats.size,
                originalPath: null, // No local source to wipe outside session
                source: 'UPLOAD'
            };

            this.importedFiles.push(metadata);
            this.totalSize += stats.size;
            
            // Notify Main -> UI
            this.emit('files-updated', this.importedFiles);
            this.emit('session-info-updated', this.getSessionInfo());

            await this.auditLogger.logAction("Secure Upload", "Received file via Local QR Ingress");
        } catch (e) {
            console.error('[SessionManager] Failed to process uploaded file:', e);
        }
    });

    // Initial state load is handled in recovery
  }

  // --- Core State Machine ---

  public getState(): SystemState { return this.state; }
  public getMode(): SystemMode { return this.mode; }

  public setMode(newMode: SystemMode) {
      if (this.state === 'ACTIVE_SESSION' && newMode === 'OWNER') {
          throw new Error("Cannot switch to Owner mode while a Customer Session is active. End session first.");
      }
      this.mode = newMode;
      this.auditLogger.logBlockedAction("Mode Change", `Switched to ${newMode} mode.`); 
  }

  private async transitionTo(newState: SystemState, reason: string) {
      console.log(`[SessionManager] State Transition: ${this.state} -> ${newState} (${reason})`);
      
      // Validity Checks
      if (this.state === 'DESTRUCTION_IN_PROGRESS' && newState === 'ACTIVE_SESSION') {
          throw new Error("Illegal State Transition: Cannot start session during destruction.");
      }

      this.state = newState;
      
      // Persistence Update
      this.persistence.saveState({
          lastSessionId: this.activeSessionId,
          path: this.sessionPath,
          status: this.state,
          timestamp: Date.now()
      });
  }

  // --- Trust Assertions ---

  private assertSystemClean() {
      if (this.state === 'ACTIVE_SESSION') throw new Error("Security Violation: Session already active.");
      if (this.state === 'DESTRUCTION_IN_PROGRESS') throw new Error("Security Violation: Destruction in progress.");
      
      // Check for orphan folders
      if (fs.existsSync(BASE_DIR)) {
        const sessions = fs.readdirSync(BASE_DIR);
        // If we are here, state is IDLE or SYSTEM_CLEAN.
        // If files exist, that's an anomaly.
        if (sessions.length > 0) {
             this.auditLogger.logAssertionFailure("Orphan session files found in IDLE state.");
             // Potentially auto-fix or block here
        }
      }
  }

  // --- Lifecycle ---

  public async recoverSessions() {
      const state = this.persistence.loadState();
      
      console.log(`[SessionManager] Recovering from state: ${state.status}`);

      // Crash Recovery Logic
      if (state.status === 'ACTIVE_SESSION' || state.status === 'DESTRUCTION_IN_PROGRESS') {
          console.warn(`[SessionManager] Detected unclean shutdown (Status: ${state.status}). Initiating emergency wipe.`);
          
          this.activeSessionId = state.lastSessionId;
          this.sessionPath = state.path; // Potentially unsafe path if tampered, but we wipe it.
          
          // Force state to destruction
          await this.transitionTo('DESTRUCTION_IN_PROGRESS', 'Crash Recovery');
          
          // Attempt Wipe
          if (this.sessionPath && fs.existsSync(this.sessionPath)) {
              await this.executeSecureWipe(this.sessionPath);
          } else {
              // Path gone? Assume clean.
              await this.transitionTo('IDLE', 'Recovery: Path not found');
          }
      } else {
          this.state = 'IDLE'; // Default safe state
      }
  }

  public async startSession(type: 'PRINT' | 'TASK' = 'PRINT'): Promise<string> {
    if (this.mode === 'OWNER') {
        throw new Error("Cannot start Customer Session in Owner Mode.");
    }
    
    this.assertSystemClean();
    
    // Double check state
    if (this.state !== 'IDLE' && this.state !== 'SYSTEM_CLEAN') {
         throw new Error(`System is not ready (Current State: ${this.state})`);
    }

    this.sessionType = type;
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    
    if (type === 'TASK') {
        this.activeSessionId = `task_${timestamp}_${random}`;
        this.sessionPath = path.join(TASK_DIR, this.activeSessionId);
    } else {
        this.activeSessionId = `session_${timestamp}_${random}`;
        this.sessionPath = path.join(BASE_DIR, this.activeSessionId);
    }
    this.startTime = timestamp;
    this.totalSize = 0;
    this.importedFiles = [];
    
    try {
      await fs.ensureDir(this.sessionPath);
      console.log(`[SessionManager] Created workspace: ${this.sessionPath}`);
      
      await this.transitionTo('ACTIVE_SESSION', 'User Start');
      await this.auditLogger.logSessionStart(this.activeSessionId);

      // Start Upload Server
      const token = crypto.randomBytes(16).toString('hex');
      try {
           const rawUrl = await this.uploadServer.start(this.sessionPath, token);
           this.uploadUrl = await QRCode.toDataURL(rawUrl);
           console.log(`[SessionManager] QR Code generated for: ${rawUrl}`);
      } catch (e) {
           console.error('[SessionManager] Failed to start Upload Server or generate QR:', e);
           this.uploadUrl = null;
      }

      this.startInactivityTimer();
      
      if (this.sessionType === 'TASK' && this.sessionPath) {
          this.taskBrowser = new TaskBrowser(this.sessionPath, this.activeSessionId!);
          // Auto-launch
          try {
              await this.launchBrowser();
          } catch (browserErr: any) {
              console.error('[SessionManager] Failed to launch browser:', browserErr);
              await this.endSession('START_FAILED'); 
              throw new Error(`Browser launch failed: ${browserErr.message}`);
          }
      }

      return this.activeSessionId;

    } catch (error) {
      console.error('Failed to create session directory:', error);
      // Ensure we don't leave a half-open state if we already transitioned
      // We check if we managed to set an ID, which implies we passed the initial checks
      if (this.activeSessionId) {
           this.state = 'DESTRUCTION_IN_PROGRESS'; // Force state for cleanup
           await this.endSession('STARTUP_ERROR');
      }
      throw error;
    }
  }

  public async deleteFile(fileName: string) {
      if (this.state !== 'ACTIVE_SESSION' || !this.sessionPath) return;
      
      const fullPath = path.join(this.sessionPath, fileName);
      const fileIndex = this.importedFiles.findIndex(f => f.name === fileName);

      if (fileIndex === -1) {
          console.warn(`[SessionManager] Delete requested for "${fileName}" but it's not in registry. Checking disk...`);
          // Graceful handling: If file exists on disk but not in list, delete it. If neither, it's already done.
          if (await fs.pathExists(fullPath)) {
               await secureDeleteFile(fullPath);
               console.log(`[SessionManager] Orphaned file "${fileName}" deleted from disk.`);
          } else {
               console.log(`[SessionManager] File "${fileName}" already deleted. Ignoring.`);
          }
          // Sync UI just in case
          this.emit('files-updated', this.importedFiles);
          return;
      }
      
      const file = this.importedFiles[fileIndex];
      
      console.log(`[SessionManager] Securely deleting: ${fileName}`);
      
      // Destroy physical file in session
      await secureDeleteFile(fullPath);
      
      // Remove from list
      this.importedFiles.splice(fileIndex, 1);
      
      // Emit updates
      this.emit('files-updated', this.importedFiles);
      this.emit('session-info-updated', this.getSessionInfo());
      
      await this.auditLogger.logAction('Local Delete', `Deleted file: ${fileName}`);
  }

  public async endSession(reason: string) {
      if (this.state !== 'ACTIVE_SESSION') return;
      if (!this.activeSessionId || !this.sessionPath) return;

      console.log(`[SessionManager] Ending session ${this.activeSessionId}. Reason: ${reason}`);
      
      // Stop Upload Server Immediately
      this.uploadServer.stop();
      this.uploadUrl = null;
      
      await this.transitionTo('DESTRUCTION_IN_PROGRESS', reason);
      this.emit('session-wiping');
      
      await this.auditLogger.logSessionEnd(reason);
      await this.auditLogger.logWipeStart();
      
      this.clearInactivityTimer();
      this.clearInactivityTimer();
      this.printManager.closeAll();
      this.viewerManager.closeAll();
      
      if (this.taskBrowser) {
        await this.taskBrowser.cleanup();
        this.taskBrowser = null;
      }
      
      const targetPath = this.sessionPath;

      // 1. Destroy imported source files ONLY if manually confirmed
      if (reason === 'MANUAL') {
        console.log('[SessionManager] DESTROYING ORIGINAL SOURCE FILES (Confirmed via UI)...');
        for (const file of this.importedFiles) {
            if (file.originalPath) {
                 const result = await secureDeleteFile(file.originalPath);
                 if (!result.success) {
                      console.warn(`[SessionManager] Failed to wipe source: ${file.originalPath} (${result.error})`);
                 }
            }
        }
      } else {
        console.log(`[SessionManager] Skipping source file destruction (Reason: ${reason} - Confirmation Required)`);
      }

      // 2. Wipe Session Workspace
      await this.executeSecureWipe(targetPath);
  }

  private async executeSecureWipe(targetPath: string) {
       const success = await secureWipeSession(targetPath);
       
       if (success) {
           this.auditLogger.logWipeResult(true);
           this.activeSessionId = null;
           this.sessionPath = null;
           this.importedFiles = [];
           this.totalSize = 0;
           this.startTime = null;
           
           await this.transitionTo('SYSTEM_CLEAN', 'Wipe Success');
           // Auto-transit to IDLE?
           await this.transitionTo('IDLE', 'Ready');
           
           this.emit('session-ended', 'COMPLETED', []);
       } else {
           this.auditLogger.logWipeResult(false, 1);
           // Stuck in destruction? Or WIPE_FAILED?
           // The state machine says "No half states".
           // We might need to stay in destruction or a separate ERROR state.
           // However prompt says "IDLE, ACTIVE, DESTRUCTION, CLEAN".
           // If wipe fails, we are arguably still in DESTRUCTION_IN_PROGRESS (stalled) or effectively it's unsafe.
           // I'll keep it in DESTRUCTION_IN_PROGRESS so guardrails block new sessions.
           this.emit('session-ended', 'WIPE_FAILED', ['Session directory could not be fully removed']);
       }
  }

  // --- Timeouts ---

  private startInactivityTimer() {
      this.clearInactivityTimer();
      this.inactivityTimer = setTimeout(() => {
          this.endSession('TIMEOUT');
      }, INACTIVITY_TIMEOUT_MS);
  }

  private clearInactivityTimer() {
      if (this.inactivityTimer) {
          clearTimeout(this.inactivityTimer);
          this.inactivityTimer = null;
      }
  }

  public notifyActivity() {
      if (this.state === 'ACTIVE_SESSION') {
          this.startInactivityTimer();
      }
  }

  public async verifyPrintPermission(fileName: string): Promise<boolean> {
      const file = this.importedFiles.find(f => f.name === fileName);
      if (file && file.source === 'UPLOAD' && this.uploadUrl) {
           console.log(`[SessionManager] File ${fileName} requires mobile approval.`);
           return await this.uploadServer.requestApproval(fileName);
      }
      return true;
  }
  
  public getPrintManager(): PrintManager { return this.printManager; }
  public getViewerManager(): ViewerManager { return this.viewerManager; }
  public getSessionPath(): string | null { return this.sessionPath; }

  // --- Files ---

  public async registerScan(scanPath: string): Promise<FileMetadata[]> {
       if (this.state !== 'ACTIVE_SESSION') throw new Error("No active session");
       this.notifyActivity();
       const stats = await fs.stat(scanPath);
       const metadata: FileMetadata = {
           name: path.basename(scanPath),
           size: stats.size,
           originalPath: null,
           source: 'SCAN'
       };
       this.importedFiles.push(metadata);
       this.totalSize += stats.size;
       return this.importedFiles;
  }

  public async launchBrowser() {
      if (this.state === 'ACTIVE_SESSION' && this.sessionType === 'TASK' && this.taskBrowser) {
          await this.taskBrowser.launch();
      }
  }

  public async importFiles(sourcePaths: string[]): Promise<FileMetadata[]> {
    if (this.state !== 'ACTIVE_SESSION') throw new Error('No active session');
    // strict check: imported files allowed?
    if (this.mode === 'OWNER') throw new Error("Security Violation: Cannot import files in Owner Mode."); 
    this.notifyActivity(); 

    const newFiles: FileMetadata[] = [];
    let importCount = 0;

    for (const src of sourcePaths) {
      try {
        const stats = await fs.stat(src);
        const safeName = `${Date.now()}_${path.basename(src)}`; // Simple safe name
        const dest = path.join(this.sessionPath!, safeName);
        
        await fs.copy(src, dest);
        
        const metadata: FileMetadata = { 
            name: safeName, 
            size: stats.size,
            originalPath: src,
            source: 'IMPORT'
        };
        newFiles.push(metadata);
        this.importedFiles.push(metadata);
        this.totalSize += stats.size;
        importCount++;
      } catch (error) {
        console.error(`[SessionManager] Failed to import ${src}:`, error);
      }
    }
    
    if (importCount > 0) {
        await this.auditLogger.logImport(importCount);
    }

    return newFiles;
  }

  public getSessionInfo(): SessionInfo {
    return {
      id: this.activeSessionId,
      startTime: this.startTime,
      totalSize: this.totalSize,
      fileCount: this.importedFiles.length,
      state: this.state,
      mode: this.mode,
      type: this.sessionType,
      uploadUrl: this.uploadUrl
    };
  }
}
