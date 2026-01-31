'use client';
import { useState, useEffect } from 'react';
import { 
  Shield, 
  Trash2, 
  FileUp, 
  ScanLine, 
  Printer, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  HardDrive, 
  Clock, 
  FileText,
  Activity,
  Lock,
  Search
} from 'lucide-react';

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
    <div className="bh-container">
      
      {/* Header */}
      <header className="bh-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', background: sessionInfo.id ? 'var(--bh-red)' : 'var(--bh-black)', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', border: '2px solid black' }}>
                <Shield color="white" size={20} />
            </div>
            <div>
                <h1 className="bh-title">SecureEngine</h1>
                <div className="bh-status-pill">Disposal Mode</div>
            </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
             <div style={{fontFamily: 'monospace', fontWeight: 600}}>
                 <Activity size={14} style={{marginRight: 6, verticalAlign: 'middle'}}/>
                 {status}
             </div>

            {sessionInfo.id && (
                <>
                <button className="bh-btn bh-btn-action" onClick={handleScan}>
                    <ScanLine size={16} /> Scan Paper
                </button>
                <div style={{width:'2px', height:'30px', background:'black'}}></div>
                <button className="bh-btn bh-btn-danger" onClick={handleEndSession}>
                    <Trash2 size={16} /> Destroy Session
                </button>
                </>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
        
        {/* Trust Banner */}
        <div className="bh-banner">
            <Lock size={24} />
            <span style={{ fontSize: '14px' }}>SECURE DISPOSITION: All files imported here will be DESTROYED from source upon session completion.</span>
        </div>

        {wipeFailures.length > 0 && (
            <div className="bh-card" style={{ marginBottom: '24px', borderLeft: '8px solid var(--bh-red)' }}>
                <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--bh-red)' }}>
                    <AlertTriangle /> PARTIAL FAILURE - FILES REMAINING
                </h3>
                <p>The following files could not be destroyed (likely locked by another application):</p>
                <ul style={{ fontFamily: 'monospace' }}>
                    {wipeFailures.map((fail, idx) => (
                        <li key={idx}>{fail}</li>
                    ))}
                </ul>
            </div>
        )}

        {endReason && !sessionInfo.id && wipeFailures.length === 0 && (
            <div className="bh-card" style={{ marginBottom: '24px', borderLeft: '8px solid var(--bh-green)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <CheckCircle size={40} color="green" />
                <div>
                    <h3 style={{ margin: '0 0 5px 0' }}>DESTRUCTION COMPLETE</h3>
                    <p style={{ margin: 0 }}>{endReason}</p>
                </div>
            </div>
        )}

        {/* Phase 5: Residue Guard Section */}
        {!sessionInfo.id && <div className="bh-card" style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', textTransform:'uppercase' }}>
                    <Search size={20} /> Data Residue Guard
                </h3>
                <button 
                    onClick={handleResidueScan}
                    disabled={isProcessing}
                    className="bh-btn bh-btn-white">
                    {isProcessing ? 'Scanning...' : 'Scan Desktop & Downloads'}
                </button>
            </div>
            
            {cleanupReport && (
                <div style={{ padding: '10px', background: '#e8f5e9', border: '2px solid black', marginBottom: '10px', fontWeight: 600 }}>
                    {cleanupReport}
                </div>
            )}

            {hasScanned && (
                <div>
                    {residueFiles.length === 0 ? (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'green', fontWeight: 700 }}>
                             <CheckCircle size={24} />
                             <span>SYSTEM CLEAN. NO RISK FILES DETECTED.</span>
                         </div>
                    ) : (
                        <div style={{ background: '#fff', border: '2px solid var(--bh-red)', padding: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--bh-red)', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, textTransform:'uppercase' }}>
                                    <AlertTriangle size={20} /> {residueFiles.length} Risk Files Found
                                </div>
                                <button
                                    onClick={handleResidueCleanup}
                                    className="bh-btn bh-btn-danger"
                                >
                                    CLEANUP ALL
                                </button>
                            </div>
                            <div style={{ fontSize: '12px', maxHeight: '150px', overflowY: 'auto' }}>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontFamily:'monospace' }}>
                                    {residueFiles.map((f, i) => (
                                        <li key={i}>{f.name} <span style={{color:'#666'}}>({f.location})</span></li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>}

        {!sessionInfo.id ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
            <div className="bh-card" style={{ textAlign: 'center', maxWidth: '500px' }}>
                <div style={{width:'80px', height:'80px', background:'var(--bh-black)', borderRadius:'50%', margin:'0 auto 20px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <Shield size={40} color="white" />
                </div>
                <h2 style={{ textTransform:'uppercase', fontWeight: 900 }}>Start Disposition Session</h2>
                <p style={{ marginBottom: '30px' }}>Securely review, print, and destroy sensitive documents in an isolated environment.</p>
                <button 
                  onClick={handleStartSession}
                  className="bh-btn bh-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={wipeFailures.length > 0} 
                >
                  Start Secure Session
                </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Metadata Dashboard */}
            <div className="bh-grid">
                <DashboardCard label="Session ID" value={sessionInfo.id.split('_')[2] || '...'} icon={<Shield size={20}/>} />
                <DashboardCard label="Started At" value={formatTime(sessionInfo.startTime)} icon={<Clock size={20}/>} />
                <DashboardCard label="Files" value={sessionInfo.fileCount.toString()} icon={<FileText size={20}/>}/>
                <DashboardCard label="Storage" value={formatBytes(sessionInfo.totalSize)} icon={<HardDrive size={20}/>} />
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', textTransform:'uppercase', fontWeight: 800 }}>Tracking for Destruction</h2>
              <button 
                onClick={handleImport}
                disabled={isProcessing}
                className="bh-btn bh-btn-primary"
              >
                <FileUp size={16} /> {isProcessing ? 'Processing...' : 'Add Files'}
              </button>
            </div>

            {/* File List */}
            <div className="bh-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '2px solid black', background: '#eee', fontSize: '12px', fontWeight: 800, display: 'flex' }}>
                  <div style={{ flex: 1 }}>FILE</div>
                  <div style={{ width: '150px' }}>STATUS</div>
                  <div style={{ width: '100px', textAlign:'right' }}>ACTIONS</div>
              </div>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {files.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                      <p style={{fontWeight: 600}}>NO FILES TRACKED</p>
                    </div>
                  ) : (
                     <div>
                       {files.map((file, idx) => (
                         <div key={idx} className="bh-list-item">
                           <div style={{flex:1, display:'flex', alignItems: 'center', gap: '12px'}}>
                               <FileText size={24} />
                               <div>
                                   <div style={{ fontWeight: 700 }}>{file.name}</div>
                                   <div style={{ fontSize:'12px', color:'#555', fontFamily: 'monospace' }}>{formatBytes(file.size)}</div>
                               </div>
                           </div>
                           
                           <div style={{ width: '150px' }}>
                               {file.originalPath ? 
                                    <span style={{ fontSize:'10px', background:'var(--bh-red)', color:'white', padding:'4px 6px', fontWeight: 700 }}>SOURCE MATCHED</span>
                                    : 
                                    <span style={{ fontSize:'10px', background:'var(--bh-blue)', color:'white', padding:'4px 6px', fontWeight: 700 }}>SESSION ONLY</span>
                                }
                           </div>
                           
                           <div style={{ width: '100px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                               <button 
                                onClick={() => handlePreview(file.name)}
                                title="View"
                                className="bh-btn bh-btn-white" style={{padding: '6px'}}>
                                   <Eye size={16} />
                               </button>
                               <button 
                                onClick={() => handlePrint(file.name)}
                                title="Print"
                                className="bh-btn bh-btn-white" style={{padding: '6px'}}>
                                   <Printer size={16} />
                               </button>
                           </div>
                         </div>
                       ))}
                     </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DashboardCard({ label, value, icon }: { label: string, value: string, icon?: any }) {
    return (
        <div className="bh-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {icon && <div style={{ opacity: 0.5 }}>{icon}</div>}
            <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, opacity: 0.6 }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: 900 }}>{value}</div>
            </div>
        </div>
    );
}
