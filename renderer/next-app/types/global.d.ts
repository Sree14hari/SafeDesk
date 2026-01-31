export {};

declare global {
  interface FileMetadata {
    name: string;
    size: number;
  }

  interface Window {
    electronAPI: {
      startSession: () => void;
      triggerFileImport: () => void;
      onSessionStatus: (callback: (event: any, value: string) => void) => void;
      onSessionCreated: (callback: (event: any, sessionId: string) => void) => void;
      onFilesUpdated: (callback: (event: any, files: FileMetadata[]) => void) => void;
    };
  }
}
