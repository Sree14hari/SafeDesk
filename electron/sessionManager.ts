import * as fs from 'fs-extra';
import * as path from 'path';
import { PersistenceManager } from './persistenceManager';
import { EventEmitter } from 'events';

const BASE_DIR = 'C:\\SafeDesk\\sessions';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface FileMetadata { name: string; size: number; }
export interface SessionInfo { id: string | null; startTime: number | null; totalSize: number; fileCount: number; }

export class SessionManager extends EventEmitter {
  private activeSessionId: string | null = null;
  private sessionPath: string | null = null;
  private importedFiles: FileMetadata[] = [];
  
  private startTime: number | null = null;
  private totalSize: number = 0;

  private inactivityTimer: NodeJS.Timeout | null = null;
  private persistence: PersistenceManager;

  constructor() {
    super();
    fs.ensureDirSync(BASE_DIR);
    this.persistence = new PersistenceManager();
  }

  // --- Lifecycle ---

  public async recoverSessions() {
      const state = this.persistence.loadState();
      
      if (state.status === 'ACTIVE' && state.lastSessionId) {
          console.warn(`[SessionManager] Detected crash/unsafe exit for session ${state.lastSessionId}. Forcing close.`);
          // Logic: We don't resume. We ensure it's marked as ended.
          // Optional: We could delete the folder here if "auto-wipe" was in scope.
          this.persistence.saveState({
              ...state,
              status: 'ENDED' // Force end
          });
          // Notify (though no UI yet)? Just log.
      } else {
          console.log('[SessionManager] Clean startup. No active sessions recovered.');
      }
  }

  public async startSession(): Promise<string> {
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

  public endSession(reason: string) {
      if (!this.activeSessionId) return;

      console.log(`[SessionManager] Ending session ${this.activeSessionId}. Reason: ${reason}`);
      
      this.clearInactivityTimer();
      
      const oldId = this.activeSessionId;
      const oldPath = this.sessionPath;

      // Update State
      this.activeSessionId = null;
      this.sessionPath = null;
      this.importedFiles = [];
      this.totalSize = 0;
      this.startTime = null;

      // Persist 'ENDED'
      this.persistence.saveState({
          lastSessionId: oldId,
          path: oldPath,
          status: 'ENDED',
          timestamp: Date.now()
      });

      // Emit event for Main process to handle (e.g., notify UI)
      this.emit('session-ended', reason);
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
          // Reset timer
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

    this.notifyActivity(); // Reset timer on import

    const newFiles: FileMetadata[] = [];

    for (const src of sourcePaths) {
      try {
        const stats = await fs.stat(src);
        const originalName = path.basename(src);
        
        const safeName = await this.resolveUniqueFilename(this.sessionPath, originalName);
        const dest = path.join(this.sessionPath, safeName);
        
        await fs.copy(src, dest);
        
        const metadata: FileMetadata = { name: safeName, size: stats.size };
        newFiles.push(metadata);
        this.importedFiles.push(metadata);
        this.totalSize += stats.size;

        console.log(`[SessionManager] Imported: ${safeName}`);
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
