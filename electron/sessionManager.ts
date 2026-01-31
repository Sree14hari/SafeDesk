import * as fs from 'fs-extra';
import * as path from 'path';

const BASE_DIR = 'C:\\SafeDesk\\sessions';

export interface FileMetadata {
  name: string;
  size: number;
  // storedName? could be added if we sanitize filenames to disk
}

export class SessionManager {
  private activeSessionId: string | null = null;
  private sessionPath: string | null = null;
  private importedFiles: FileMetadata[] = [];

  constructor() {
    // Ensure base directory exists
    // In a real app, strict permissions should be applied here.
    fs.ensureDirSync(BASE_DIR);
  }

  public async startSession(): Promise<string> {
    // Generate simple unique ID: timestamp + random suffix
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    this.activeSessionId = `session_${timestamp}_${random}`;
    
    this.sessionPath = path.join(BASE_DIR, this.activeSessionId);
    
    try {
      await fs.ensureDir(this.sessionPath);
      console.log(`[SessionManager] Created workspace: ${this.sessionPath}`);
      this.importedFiles = [];
      return this.activeSessionId;
    } catch (error) {
      console.error('Failed to create session directory:', error);
      throw error;
    }
  }

  public async importFiles(sourcePaths: string[]): Promise<FileMetadata[]> {
    if (!this.activeSessionId || !this.sessionPath) {
      throw new Error('No active session');
    }

    const newFiles: FileMetadata[] = [];

    for (const src of sourcePaths) {
      try {
        const stats = await fs.stat(src);
        const fileName = path.basename(src);
        const dest = path.join(this.sessionPath, fileName);

        // Prevent overwriting? For now, we overwrite.
        // SECURITY: We should sanitize fileName to avoid ../ traversal if it came from untrusted source.
        // But sourcePaths come from dialog.showOpenDialog, which is relatively safe locally.
        
        await fs.copy(src, dest);
        
        const metadata: FileMetadata = {
            name: fileName,
            size: stats.size
        };
        newFiles.push(metadata);
        this.importedFiles.push(metadata);

        console.log(`[SessionManager] Imported: ${fileName}`);
      } catch (error) {
        console.error(`[SessionManager] Failed to import ${src}:`, error);
        // Continue with other files or throw?
      }
    }

    return newFiles;
  }

  public getSessionInfo() {
    return {
      id: this.activeSessionId,
      fileCount: this.importedFiles.length
    };
  }
}
