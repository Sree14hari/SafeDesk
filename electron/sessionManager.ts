import * as fs from 'fs-extra';
import * as path from 'path';
import { PersistenceManager } from './persistenceManager';
import { EventEmitter } from 'events';
import { secureWipeSession, secureDeleteFile } from './secureWipe';

const BASE_DIR = 'C:\\SafeDesk\\sessions';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export interface FileMetadata { name: string; size: number; originalPath: string; }
export interface SessionInfo { id: string | null; startTime: number | null; totalSize: number; fileCount: number; }

export class SessionManager extends EventEmitter {
  private activeSessionId: string | null = null;
  private sessionPath: string | null = null;
  private importedFiles: FileMetadata[] = [];
  
  private startTime: number | null = null;
  private totalSize: number = 0;

  private inactivityTimer: NodeJS.Timeout | null = null;
  private persistence: PersistenceManager;
  private isWiping: boolean = false;

  constructor() {
    super();
    fs.ensureDirSync(BASE_DIR);
    this.persistence = new PersistenceManager();
  }

  // --- Lifecycle ---

  public async recoverSessions() {
      const state = this.persistence.loadState();
      
      if (state.lastSessionId && state.path && fs.existsSync(state.path)) {
          console.warn(`[SessionManager] Detected crash. Wiping zombie session ${state.lastSessionId}.`);
          this.isWiping = true;
          await secureWipeSession(state.path);
          this.persistence.saveState({ ...state, status: 'ENDED' });
          this.isWiping = false;
      }
  }

  public async startSession(): Promise<string> {
    if (this.isWiping) {
        throw new Error('System is currently performing a secure wipe. Please wait.');
    }
    if (this.activeSessionId) {
        throw new Error('Session already active');
    }

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    this.activeSessionId = `session_${timestamp}_${random}`;
    
    this.sessionPath = path.join(BASE_DIR, this.activeSessionId);
    this.startTime = timestamp;
    this.totalSize = 0;
    this.importedFiles = [];
    
    try {
      await fs.ensureDir(this.sessionPath);
      console.log(`[SessionManager] Created workspace: ${this.sessionPath}`);
      
      this.persistence.saveState({
          lastSessionId: this.activeSessionId,
          path: this.sessionPath,
          status: 'ACTIVE',
          timestamp: this.startTime
      });

      this.startInactivityTimer();
      return this.activeSessionId;

    } catch (error) {
      console.error('Failed to create session directory:', error);
      throw error;
    }
  }

  public async endSession(reason: string) {
      if (!this.activeSessionId || !this.sessionPath) return;

      console.log(`[SessionManager] Ending session ${this.activeSessionId}. Reason: ${reason}`);
      this.emit('session-wiping');
      this.isWiping = true;
      
      this.clearInactivityTimer();
      
      const oldId = this.activeSessionId;
      const oldPath = this.sessionPath;
      const filesToDestroy = [...this.importedFiles];

      // Reset State Early (Memory)
      this.activeSessionId = null;
      this.sessionPath = null;
      this.importedFiles = [];
      this.totalSize = 0;
      this.startTime = null;

      const wipeFailures: string[] = [];

      // 1. Wipe Source Files (Destructive)
      if (filesToDestroy.length > 0) {
          console.log('[SessionManager] DESTROYING ORIGINAL SOURCE FILES...');
          for (const file of filesToDestroy) {
             const result = await secureDeleteFile(file.originalPath);
             if (!result.success) {
                 wipeFailures.push(`${file.originalPath} (${result.error})`);
             }
          }
      }

      // 2. Wipe Session Workspace
      const wipeSuccess = await secureWipeSession(oldPath);
      if (!wipeSuccess) {
          wipeFailures.push(`Session Workspace: ${oldPath} (Directory not fully removed)`);
      }
      
      const status = wipeFailures.length === 0 ? 'ENDED' : 'WIPE_FAILED';

      this.persistence.saveState({
          lastSessionId: oldId,
          path: oldPath,
          status: status,
          timestamp: Date.now()
      });

      this.isWiping = false;
      this.emit('session-ended', reason, wipeFailures);
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
      if (this.activeSessionId) {
          this.startInactivityTimer();
      }
  }

  // --- Files ---

  private async resolveUniqueFilename(targetDir: string, fileName: string): Promise<string> {
      let finalName = fileName;
      let counter = 1;
      const parsed = path.parse(fileName);
      
      while (await fs.pathExists(path.join(targetDir, finalName))) {
          finalName = `${parsed.name} (${counter})${parsed.ext}`;
          counter++;
      }
      return finalName;
  }

  public async importFiles(sourcePaths: string[]): Promise<FileMetadata[]> {
    if (!this.activeSessionId || !this.sessionPath) {
      throw new Error('No active session');
    }

    this.notifyActivity(); 

    const newFiles: FileMetadata[] = [];

    for (const src of sourcePaths) {
      try {
        const stats = await fs.stat(src);
        const originalName = path.basename(src);
        
        const safeName = await this.resolveUniqueFilename(this.sessionPath, originalName);
        const dest = path.join(this.sessionPath, safeName);
        
        await fs.copy(src, dest);
        
        const metadata: FileMetadata = { 
            name: safeName, 
            size: stats.size,
            originalPath: src 
        };
        newFiles.push(metadata);
        this.importedFiles.push(metadata);
        this.totalSize += stats.size;

        console.log(`[SessionManager] Imported: ${safeName} (Source tracked: ${src})`);
      } catch (error) {
        console.error(`[SessionManager] Failed to import ${src}:`, error);
      }
    }

    return newFiles;
  }

  public getSessionInfo(): SessionInfo {
    return {
      id: this.activeSessionId,
      startTime: this.startTime,
      totalSize: this.totalSize,
      fileCount: this.importedFiles.length
    };
  }
}
