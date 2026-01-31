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
      window.electronAPI.onSessionStatus((_event, value) => {
          setStatus(value);
      });

      window.electronAPI.onSessionCreated((_event, id) => {
        setStatus(`Session Active`);
        setFiles([]); 
        setEndReason(null);
      });

      window.electronAPI.onSessionEnded((_event, reason) => {
          setSessionInfo({ id: null, startTime: null, totalSize: 0, fileCount: 0 });
          setFiles([]);
          setStatus('No Active Session');
          setEndReason(`Session Ended (${reason}). Original source files and session copies have been securely destroyed.`);
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
      setStatus('Initializing Secure Disposition Workspace...');
    }
  };

  const handleEndSession = () => {
      // EXPLICIT WARNING
      if (window.electronAPI && confirm("⚠️ WARNING: This will PERMANENTLY WIPE the ORIGINAL files from your computer (e.g., Desktop/Documents) AND the session copies.\n\nAre you sure you want to destroy these files?")) {
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
            <div style={{ width: '24px', height: '24px', background: sessionInfo.id ? '#d32f2f' : '#ccc', borderRadius: '50%' }}></div>
            <h1 style={{ margin: 0, fontSize: '20px', color: '#333' }}>SecureEngine <span style={{fontSize:'12px', fontWeight:'normal', background:'#eee', padding:'2px 6px', borderRadius:'4px'}}>DISPOSAL MODE</span></h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '14px', color: '#666' }}>Status: <strong>{status}</strong></div>
            {sessionInfo.id && (
                <button 
                    onClick={handleEndSession} 
                    style={{ background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    DESTROY SESSION & FILES
                </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Trust Banner */}
        <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeeba', padding: '12px 20px', borderRadius: '8px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#856404' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Secure Disposition: Any file imported here will be WIPED from your computer when the session ends.</span>
        </div>

        {endReason && !sessionInfo.id && (
            <div style={{ marginBottom: '20px', padding: '20px', background: '#ffebee', color: '#b71c1c', borderRadius: '8px', border: '1px solid #ffcdd2', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '24px' }}>🗑️</span>
                <div>
                    <h3 style={{ margin: '0 0 5px 0' }}>Destruction Complete</h3>
                    <p style={{ margin: 0 }}>{endReason}</p>
                </div>
            </div>
        )}

        {!sessionInfo.id ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '400px' }}>
                <h2 style={{ marginTop: 0 }}>Start Disposition Session</h2>
                <p style={{ color: '#666', marginBottom: '30px' }}>Securely review and then permanently destroy sensitive documents.</p>
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
              <h2 style={{ margin: 0, fontSize: '18px' }}>Tracking for Destruction</h2>
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
                {isImporting ? 'Importing...' : '+ Add Files to Destroy'}
              </button>
            </div>

            {/* File List */}
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', border: '1px solid #eaeaea', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #eaeaea', background: '#fafafa', fontSize: '12px', fontWeight: 600, color: '#d32f2f', display: 'flex' }}>
                  <div style={{ flex: 1 }}>FILE (MARKED FOR DELETION)</div>
                  <div style={{ width: '100px', textAlign: 'right' }}>SIZE</div>
              </div>
              
              <div style={{ overflowY: 'auto', flex: 1 }}>
                  {files.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      <p>No files tracked.</p>
                      <p style={{ fontSize: '13px' }}>Import files to mark them for secure destruction.</p>
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
                           <span style={{ color: '#d32f2f', fontFamily: 'monospace', fontSize:'11px', border:'1px solid #d32f2f', padding:'2px 4px', borderRadius:'3px' }}>WILL BE WIPED</span>
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
