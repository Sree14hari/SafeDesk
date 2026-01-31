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
  originalPath: string | null;
}

interface ResidueFile {
    path: string;
    name: string;
    location: 'Desktop' | 'Downloads';
}

export default function Home() {
  const [status, setStatus] = useState('Ready');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
      id: null, startTime: null, totalSize: 0, fileCount: 0
  });
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [wipeFailures, setWipeFailures] = useState<string[]>([]);
  
  // Phase 5 State
  const [residueFiles, setResidueFiles] = useState<ResidueFile[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSessionStatus((_event, value) => {
          setStatus(value);
          if (value.includes('Scann') || value.includes('Print')) setIsProcessing(false); 
      });

      window.electronAPI.onSessionCreated((_event, id) => {
        setStatus(`Session Active`);
        setFiles([]); 
        setEndReason(null);
        setWipeFailures([]);
      });

      window.electronAPI.onSessionEnded((_event, reason, failures) => {
          setSessionInfo({ id: null, startTime: null, totalSize: 0, fileCount: 0 });
          setFiles([]);
          setStatus('No Active Session');
          
          if (failures && failures.length > 0) {
              setEndReason(`Session Ended (${reason}). WARNING: Some files could not be destroyed.`);
              setWipeFailures(failures);
          } else {
              setEndReason(`Session Ended (${reason}). Original source files and session copies have been securely destroyed.`);
              setWipeFailures([]);
          }
      });

      window.electronAPI.onFilesUpdated((_event, newFiles) => {
         setFiles(prev => [...prev, ...newFiles]);
         setStatus(`Imported ${newFiles.length} file(s)`);
         setIsProcessing(false);
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
      setWipeFailures([]);
    }
  };

  const handleEndSession = () => {
      if (window.electronAPI && confirm("⚠️ WARNING: This will PERMANENTLY WIPE the ORIGINAL files from your computer (e.g., Desktop/Documents) AND the session copies.\n\nAre you sure you want to destroy these files?")) {
        window.electronAPI.endSession();
      }
  };

  const handleImport = () => {
    if (!sessionInfo.id) return;
    setIsProcessing(true);
    window.electronAPI.triggerFileImport();
  };
  
  const handleScan = () => {
    if (!sessionInfo.id) return;
    setIsProcessing(true);
    window.electronAPI.triggerScan();
  };
  
  const handlePrint = (fileName: string) => {
      if (window.electronAPI) {
          window.electronAPI.printFile(fileName);
      }
  };

  const handlePreview = (fileName: string) => {
      if (window.electronAPI) {
          window.electronAPI.previewFile(fileName);
      }
  };
  
  // --- Phase 5 Handlers ---

  const handleResidueScan = async () => {
      if (!window.electronAPI) return;
      setIsProcessing(true);
      try {
          const report = await window.electronAPI.scanResidue();
          setResidueFiles(report.foundFiles);
          setHasScanned(true);
          setCleanupReport(null);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleResidueCleanup = async () => {
      if (!window.electronAPI) return;
      
      if (!confirm(`DETECTED ${residueFiles.length} RISKY FILES.\n\nThis will PERMANENTLY WIPE these files from your Desktop/Downloads folders.\n\nAre you sure?`)) {
          return;
      }
      
      setIsProcessing(true);
      try {
          const result = await window.electronAPI.cleanResidue(residueFiles);
          setCleanupReport(`Securely Wiped: ${result.successCount} files. Failures: ${result.failures.length}`);
          setResidueFiles([]); // Clear list assuming done (or re-scan to verify)
          if (result.failures.length > 0) {
              alert(`Cleanup Warnings:\n${result.failures.join('\n')}`);
          }
      } finally {
          setIsProcessing(false);
      }
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
                <>
                <button 
                    onClick={handleScan}
                    style={{ background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', display:'flex', alignItems:'center', gap:'5px' }}>
                    <span>📄</span> SCAN DOCUMENT
                </button>
                <div style={{height:'20px', borderLeft:'1px solid #ddd'}}></div>
                <button 
                    onClick={handleEndSession} 
                    style={{ background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    DESTROY SESSION & FILES
                </button>
                </>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
        
        {/* Trust Banner */}
        <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeeba', padding: '12px 20px', borderRadius: '8px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#856404' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Secure Disposition: Any file imported here will be WIPED from your computer when the session ends.</span>
        </div>

        {wipeFailures.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '20px', background: '#ffebee', color: '#b71c1c', borderRadius: '8px', border: '1px solid #ffcdd2' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>❌</span> PARTIAL FAILURE - FILES REMAINING
                </h3>
                <p style={{ margin: '0 0 10px 0' }}>The following files could not be destroyed (likely locked by another application):</p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontFamily: 'monospace', fontSize: '13px' }}>
                    {wipeFailures.map((fail, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{fail}</li>
                    ))}
                </ul>
            </div>
        )}

        {endReason && !sessionInfo.id && wipeFailures.length === 0 && (
            <div style={{ marginBottom: '20px', padding: '20px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', border: '1px solid #c8e6c9', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '24px' }}>🗑️</span>
                <div>
                    <h3 style={{ margin: '0 0 5px 0' }}>Destruction Complete</h3>
                    <p style={{ margin: 0 }}>{endReason}</p>
                </div>
            </div>
        )}

        {/* Phase 5: Residue Guard Section */}
        {!sessionInfo.id && <div style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🛡️</span> Data Residue Guard
                </h3>
                <button 
                    onClick={handleResidueScan}
                    disabled={isProcessing}
                    style={{ background: '#fff', border: '1px solid #ccc', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                    {isProcessing ? 'Scanning...' : 'Scan Desktop & Downloads'}
                </button>
            </div>
            
            {cleanupReport && (
                <div style={{ padding: '10px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', fontSize: '13px', marginBottom: '10px' }}>
                    {cleanupReport}
                </div>
            )}

            {hasScanned && (
                <div>
                    {residueFiles.length === 0 ? (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2e7d32' }}>
                             <span style={{ fontSize: '24px' }}>✅</span>
                             <span>System Clean. No obvious high-risk files detected.</span>
                         </div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#b71c1c', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                                    <span>⚠️</span> {residueFiles.length} Potential Risk Files Found
                                </div>
                                <button
                                    onClick={handleResidueCleanup}
                                    style={{ background: '#d32f2f', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    SECURE CLEANUP ALL
                                </button>
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', maxHeight: '100px', overflowY: 'auto' }}>
                                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                    {residueFiles.map((f, i) => (
                                        <li key={i}>{f.name} <span style={{color:'#999'}}>({f.location})</span></li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>}

        {!sessionInfo.id ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '400px', borderTop: '4px solid #111' }}>
                <h2 style={{ marginTop: 0 }}>Start Disposition Session</h2>
                <p style={{ color: '#666', marginBottom: '30px' }}>Securely review, print, scan, and destroy sensitive documents.</p>
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
                  disabled={wipeFailures.length > 0} 
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
                disabled={isProcessing}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  backgroundColor: isProcessing ? '#f0f0f0' : '#0070f3',
                  color: isProcessing ? '#999' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isProcessing ? 'Processing...' : '+ Add Files to Destroy'}
              </button>
            </div>

            {/* File List */}
            <div style={{ flex: 1, background: '#fff', borderRadius: '8px', border: '1px solid #eaeaea', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #eaeaea', background: '#fafafa', fontSize: '12px', fontWeight: 600, color: '#666', display: 'flex' }}>
                  <div style={{ flex: 1 }}>FILE</div>
                  <div style={{ width: '100px' }}>STATUS</div>
                  <div style={{ width: '120px', textAlign:'right' }}>ACTIONS</div>
              </div>
              
              <div style={{ overflowY: 'auto', flex: 1 }}>
                  {files.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                      <p>No files tracked.</p>
                      <p style={{ fontSize: '13px' }}>Import or Scan files to begin.</p>
                    </div>
                  ) : (
                     <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                       {files.map((file, idx) => (
                         <li key={idx} style={{ 
                           padding: '10px 20px', 
                           borderBottom: '1px solid #f5f5f5', 
                           display: 'flex', 
                           justifyContent: 'space-between',
                           alignItems: 'center',
                           fontSize: '14px'
                         }}>
                           <div style={{flex:1, display:'flex', flexDirection:'column'}}>
                               <span style={{ fontWeight: 500, color: '#333' }}>{file.name}</span>
                               <span style={{ fontSize:'11px', color:'#999' }}>{formatBytes(file.size)}</span>
                           </div>
                           
                           <div style={{ width: '100px' }}>
                               {file.originalPath ? 
                                    <span style={{ color: '#d32f2f', fontSize:'10px', border:'1px solid #d32f2f', padding:'1px 4px', borderRadius:'3px' }}>SOURCES MATCHED</span>
                                    : 
                                    <span style={{ color: '#2e7d32', fontSize:'10px', border:'1px solid #2e7d32', padding:'1px 4px', borderRadius:'3px' }}>SESSION GENERATED</span>
                                }
                           </div>
                           
                           <div style={{ width: '120px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                               <button 
                                onClick={() => handlePreview(file.name)}
                                title="Secure Preview"
                                style={{ background:'none', border:'1px solid #ddd', borderRadius:'4px', cursor:'pointer', padding:'4px 8px' }}>
                                   👁️
                               </button>
                               <button 
                                onClick={() => handlePrint(file.name)}
                                title="Secure Print"
                                style={{ background:'none', border:'1px solid #ddd', borderRadius:'4px', cursor:'pointer', padding:'4px 8px' }}>
                                   🖨️
                               </button>
                           </div>
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
