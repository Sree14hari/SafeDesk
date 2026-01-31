export {};

declare global {
  interface FileMetadata {
    name: string;
    size: number;
    originalPath: string | null;
  }
  
  interface SessionInfo {
      id: string | null;
      startTime: number | null;
      totalSize: number;
      fileCount: number;
  }

  interface Window {
    electronAPI: {
      startSession: () => void;
      endSession: () => void;
      triggerFileImport: () => void;
      printFile: (fileName: string) => void;
      previewFile: (fileName: string) => void;
      triggerScan: () => void;
      
      onSessionStatus: (callback: (event: any, value: string) => void) => void;
      onSessionCreated: (callback: (event: any, sessionId: string) => void) => void;
      onSessionEnded: (callback: (event: any, reason: string, failures: string[]) => void) => void;
      onFilesUpdated: (callback: (event: any, files: FileMetadata[]) => void) => void;
      onSessionInfoUpdated: (callback: (event: any, info: SessionInfo) => void) => void;
    };
  }
}
