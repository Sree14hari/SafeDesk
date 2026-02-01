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
      uploadUrl?: string | null;
  }

  interface ResidueFile {
      path: string;
      name: string;
      location: 'Desktop' | 'Downloads';
  }

  interface InspectionReport {
      timestamp: number;
      foundFiles: ResidueFile[];
  }

  interface CleanupReport {
      successCount: number;
      failures: string[];
  }

  interface Window {
    electronAPI: {
      startSession: (type?: string) => void;
      endSession: () => void;
      triggerFileImport: () => void;
      printFile: (fileName: string) => void;
      previewFile: (fileName: string) => void;
      deleteFile: (fileName: string) => Promise<void>;
      triggerScan: () => void;
      
      scanResidue: (options?: any) => Promise<InspectionReport>;
      cleanResidue: (files: ResidueFile[]) => Promise<CleanupReport>;
      
      startTaskSession: () => void;
      launchTaskBrowser: () => void;
      
      onSessionStatus: (callback: (event: any, value: string) => void) => void;
      onSessionCreated: (callback: (event: any, sessionId: string) => void) => void;
      onSessionEnded: (callback: (event: any, reason: string, failures: string[], reportUrl?: string) => void) => void;
      onFilesUpdated: (callback: (event: any, files: FileMetadata[]) => void) => void;
      onSessionInfoUpdated: (callback: (event: any, info: SessionInfo) => void) => void;
    };
  }
}
