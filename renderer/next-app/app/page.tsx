'use client';
import { useState, useEffect } from 'react';

interface SessionInfo {
    id: string | null;
    startTime: number | null;
    totalSize: number;
    fileCount: number;
}
interface FileMetadata {
  name: string;
  size: number;
}

export default function Home() {
  const [status, setStatus] = useState('Ready');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
      id: null, startTime: null, totalSize: 0, fileCount: 0
  });
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSessionStatus((_event, value) => setStatus(value));

      window.electronAPI.onSessionCreated((_event, id) => {
        setStatus(`Session Active`);
        setFiles([]); 
        setEndReason(null);
      });

      window.electronAPI.onSessionEnded((_event, reason) => {
          setSessionInfo({ id: null, startTime: null, totalSize: 0, fileCount: 0 });
          setFiles([]);
          setStatus('No Active Session');
          setEndReason(reason);
      });

      window.electronAPI.onFilesUpdated((_event, newFiles) => {
         setFiles(prev => [...prev, ...newFiles]);
         setStatus(`Imported ${newFiles.length} file(s)`);
         setIsImporting(false);
      });
      
      window.electronAPI.onSessionInfoUpdated((_event, info) => {
          setSessionInfo(info);
      });
    }
  }, []);

  const handleStartSession = () => {
    if (window.electronAPI) {
      window.electronAPI.startSession();
      setStatus('Initializing Secure Workspace...');
    }
  };

  const handleEndSession = () => {
      if (window.electronAPI && confirm("Are you sure you want to end this secure session?")) {
        window.electronAPI.endSession();
      }
  };

  const handleImport = () => {
    if (!sessionInfo.id) return;
    setIsImporting(true);
    window.electronAPI.triggerFileImport();
  };
  
  const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ts: number | null) => {
      if (!ts) return '-';
      return new Date(ts).toLocaleTimeString();
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#fff', borderBottom: '1px solid #eaeaea', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '24px', height: '24px', background: sessionInfo.id ? '#28a745' : '#ccc', borderRadius: '50%' }}></div>
            <h1 style={{ margin: 0, fontSize: '20px', color: '#333' }}>SecureEngine</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '14px', color: '#666' }}>Status: <strong>{status}</strong></div>
            {sessionInfo.id && (
                <button 
                    onClick={handleEndSession} 
                    style={{ background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
                    End Session
                </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Trust Banner */}
        <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #b9e6fb', padding: '12px 20px', borderRadius: '8px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#006494' }}>
            <span style={{ fontSize: '18px' }}>🔐</span>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Safe Workspace: Files imported here are isolated in a temporary session and never saved to your standard folders.</span>
        </div>

        {endReason && !sessionInfo.id && (
            <div style={{ marginBottom: '20px', padding: '15px', background: '#ffebee', color: '#c62828', borderRadius: '8px', border: '1px solid #ef9a9a' }}>
                Session Ended: <strong>{endReason}</strong>
            </div>
        )}

        {!sessionInfo.id ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '400px' }}>
                <h2 style={{ marginTop: 0 }}>Start a New Session</h2>
                <p style={{ color: '#666', marginBottom: '30px' }}>Create a secure, isolated environment for handling sensitive documents.</p>
                <button 
                  onClick={handleStartSession}
                  style={{
                    padding: '14px 28px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: '#111',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    width: '100%',
                    transition: 'opacity 0.2s'
                  }}
                >
                  Start Secure Session
                </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            
            {/* Metadata Dashboard */}
            <div style={{ display: 'flex', gap: '20px' }}>
                <DashboardCard label="Session ID" value={sessionInfo.id.split('_')[2] || '...'} sub={sessionInfo.id} />
                <DashboardCard label="Started At" value={formatTime(sessionInfo.startTime)} />
                <DashboardCard label="Files" value={sessionInfo.fileCount.toString()} />
                <DashboardCard label="Total Storage" value={formatBytes(sessionInfo.totalSize)} />
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Session Files</h2>
              <button 
                onClick={handleImport}
                disabled={isImporting}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  backgroundColor: isImporting ? '#f0f0f0' : '#0070f3',
                  color: isImporting ? '#999' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isImporting ? 'Importing...' : '+ Import Files'}
              </button>
            </div>

            {/* File List */}
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', border: '1px solid #eaeaea', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #eaeaea', background: '#fafafa', fontSize: '12px', fontWeight: 600, color: '#666', display: 'flex' }}>
                  <div style={{ flex: 1 }}>NAME</div>
                  <div style={{ width: '100px', textAlign: 'right' }}>SIZE</div>
              </div>
              
              <div style={{ overflowY: 'auto', flex: 1 }}>
                  {files.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      <p>No files imported yet.</p>
                      <p style={{ fontSize: '13px' }}>Click "Import Files" to copy documents safely into this workspace.</p>
                    </div>
                  ) : (
                     <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                       {files.map((file, idx) => (
                         <li key={idx} style={{ 
                           padding: '12px 20px', 
                           borderBottom: '1px solid #f5f5f5', 
                           display: 'flex', 
                           justifyContent: 'space-between',
                           alignItems: 'center',
                           fontSize: '14px'
                         }}>
                           <span style={{ fontWeight: 500, color: '#333' }}>{file.name}</span>
                           <span style={{ color: '#666', fontFamily: 'monospace' }}>{formatBytes(file.size)}</span>
                         </li>
                       ))}
                     </ul>
                  )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DashboardCard({ label, value, sub }: { label: string, value: string, sub?: string }) {
    return (
        <div style={{ flex: 1, background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eaeaea', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#888', fontWeight: 600, marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#111' }}>{value}</div>
            {sub && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
        </div>
    );
}
