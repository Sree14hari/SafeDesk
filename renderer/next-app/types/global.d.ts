export {};

declare global {
  interface FileMetadata {
    name: string;
    size: number;
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
      onSessionStatus: (callback: (event: any, value: string) => void) => void;
      onSessionCreated: (callback: (event: any, sessionId: string) => void) => void;
      onSessionEnded: (callback: (event: any, reason: string) => void) => void;
      onFilesUpdated: (callback: (event: any, files: FileMetadata[]) => void) => void;
      onSessionInfoUpdated: (callback: (event: any, info: SessionInfo) => void) => void;
    };
  }
}
