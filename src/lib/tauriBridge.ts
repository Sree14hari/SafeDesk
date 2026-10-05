'use client';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const isTauri = () =>
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export function initTauriBridge() {
  if (typeof window === 'undefined') return;

  window.electronAPI = {
    startSession: (type?: string) => {
      invoke('start_session', { sessionType: type || 'PRINT' }).catch(console.error);
    },
    endSession: () => {
      invoke('end_session').catch(console.error);
    },
    triggerFileImport: () => {
      invoke('trigger_file_import').catch(console.error);
    },
    printFile: (fileName: string) => {
      invoke('print_file', { fileName }).catch(console.error);
    },
    previewFile: (fileName: string) => {
      invoke('preview_file', { fileName }).catch(console.error);
    },
    deleteFile: (fileName: string) => {
      return invoke<void>('delete_file', { fileName });
    },
    triggerScan: () => {
      invoke('trigger_scan').catch(console.error);
    },
    scanResidue: (options?: any) => {
      return invoke<InspectionReport>('scan_residue', { options });
    },
    cleanResidue: (files: ResidueFile[]) => {
      return invoke<CleanupReport>('clean_residue', { files });
    },
    startTaskSession: () => {
      invoke('start_task_session').catch(console.error);
    },
    launchTaskBrowser: () => {
      invoke('launch_task_browser').catch(console.error);
    },
    sendToMobile: (fileName: string) => {
      return invoke<boolean>('send_to_mobile', { fileName });
    },
    onSessionStatus: (callback: (event: any, value: string) => void) => {
      listen<string>('session:status', (event) => callback(event, event.payload));
    },
    onSessionCreated: (callback: (event: any, sessionId: string) => void) => {
      listen<string>('session:created', (event) => callback(event, event.payload));
    },
    onSessionEnded: (callback: (event: any, reason: string, failures: string[], reportUrl?: string) => void) => {
      listen<any>('session:ended', (event) => {
        const payload = event.payload;
        callback(event, payload?.reason || 'Ended', payload?.failures || [], payload?.report_url);
      });
    },
    onFilesUpdated: (callback: (event: any, files: FileMetadata[]) => void) => {
      listen<FileMetadata[]>('files:updated', (event) => callback(event, event.payload));
    },
    onSessionInfoUpdated: (callback: (event: any, info: SessionInfo) => void) => {
      listen<SessionInfo>('session:info-updated', (event) => callback(event, event.payload));
    },
  };
}
