export {};

declare global {
  interface Window {
    electronAPI: {
      startSession: () => void;
      onSessionStatus: (callback: (event: any, value: string) => void) => void;
    };
  }
}
