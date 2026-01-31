import * as fs from 'fs-extra';
import * as path from 'path';

const BASE_DIR = 'C:\\SafeDesk\\sessions';

export interface FileMetadata {
  name: string;
  size: number;
}

export interface SessionInfo {
    id: string | null;
    startTime: number | null;
    totalSize: number;
    fileCount: number;
}

export class SessionManager {
  private activeSessionId: string | null = null;
  private sessionPath: string | null = null;
  private importedFiles: FileMetadata[] = [];
  
  // Metadata
  private startTime: number | null = null;
  private totalSize: number = 0;

  constructor() {
    fs.ensureDirSync(BASE_DIR);
  }

  public async startSession(): Promise<string> {
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
      return this.activeSessionId;
    } catch (error) {
      console.error('Failed to create session directory:', error);
      throw error;
    }
  }

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

    const newFiles: FileMetadata[] = [];

    for (const src of sourcePaths) {
      try {
        const stats = await fs.stat(src);
        const originalName = path.basename(src);
        
        // Resolve Unique Name
        const safeName = await this.resolveUniqueFilename(this.sessionPath, originalName);
        const dest = path.join(this.sessionPath, safeName);
        
        await fs.copy(src, dest);
        
        const metadata: FileMetadata = {
            name: safeName,
            size: stats.size
        };
        newFiles.push(metadata);
        this.importedFiles.push(metadata);
        this.totalSize += stats.size;

        console.log(`[SessionManager] Imported: ${safeName} (${stats.size} bytes)`);
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
