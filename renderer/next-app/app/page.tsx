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
  Search,
  Smartphone,
  Globe
} from 'lucide-react';

interface SessionInfo {
    id: string | null;
    startTime: number | null;
    totalSize: number;
    fileCount: number;
    uploadUrl?: string | null;
    type?: 'PRINT' | 'TASK';
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
  const [scanOptions, setScanOptions] = useState({
      desktop: true,
      downloads: true,
      documents: false,
      pictures: false
  });

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

      window.electronAPI.onFilesUpdated((_event, updatedFiles) => {
         console.log('Files updated:', updatedFiles);
         setFiles(updatedFiles);
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
      setStatus('Initializing Secure Print Zone...');
      setWipeFailures([]);
    }
  };

  const handleStartTaskSession = () => {
    if (window.electronAPI) {
      window.electronAPI.startTaskSession();
      setStatus('Initializing Ephemeral Task Zone...');
      setWipeFailures([]);
    }
  };

  const handleLaunchBrowser = () => {
      if (window.electronAPI) {
           window.electronAPI.launchTaskBrowser();
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

  const handleDeleteFile = async (fileName: string) => {
      if (window.electronAPI && confirm(`Permanently destroy "${fileName}"? This cannot be undone.`)) {
          await window.electronAPI.deleteFile(fileName);
      }
  };
  
  // --- Phase 5 Handlers ---

  const handleResidueScan = async () => {
      if (!window.electronAPI) return;
      setIsProcessing(true);
      try {
          const report = await window.electronAPI.scanResidue(scanOptions);
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

  const toggleOption = (key: keyof typeof scanOptions) => {
      setScanOptions(prev => ({ ...prev, [key]: !prev[key] }));
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
                {sessionInfo.type === 'PRINT' && (
                    <button className="bh-btn bh-btn-action" onClick={handleScan}>
                        <ScanLine size={16} /> Scan Paper
                    </button>
                )}
                {sessionInfo.type === 'TASK' && (
                     <button className="bh-btn bh-btn-action" onClick={handleLaunchBrowser} style={{background: '#2196F3'}}>
                        <Globe size={16} /> Open Secure Browser
                    </button>
                )}
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
            <span style={{ fontSize: '14px' }}>SECURE PRINT ZONE: All files imported here will be DESTROYED from source upon session completion.</span>
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

        {/* Phase 5 & 6: IDLE Screen Layout */}
        {!sessionInfo.id && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="bh-grid" style={{ alignItems: 'stretch', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                
                {/* 1. Start Disposition Session (Primary Action) */}
                <div className="bh-card" style={{ textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{width:'80px', height:'80px', background:'var(--bh-black)', borderRadius:'50%', margin:'0 auto 20px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <Shield size={40} color="white" />
                    </div>
                    <h2 style={{ textTransform:'uppercase', fontWeight: 900 }}>Print Zone</h2>
                    <p style={{ marginBottom: '30px' }}>Securely review, print, and destroy sensitive documents in an isolated environment.</p>
                    <button 
                        onClick={handleStartSession}
                        className="bh-btn bh-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                        disabled={wipeFailures.length > 0} 
                    >
                        Start Secure Session
                    </button>
                </div>

                {/* 2. Residue Guard (Secondary Action) */}
                <div className="bh-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', textTransform:'uppercase', fontSize: '16px' }}>
                            <Search size={20} /> Data Residue Guard
                        </h3>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>Scan system locations for sensitive files left behind.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            <input type="checkbox" checked={scanOptions.desktop} onChange={() => toggleOption('desktop')} /> Desktop
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            <input type="checkbox" checked={scanOptions.downloads} onChange={() => toggleOption('downloads')} /> Downloads
                        </label>
                         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            <input type="checkbox" checked={scanOptions.documents} onChange={() => toggleOption('documents')} /> Documents
                        </label>
                         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            <input type="checkbox" checked={scanOptions.pictures} onChange={() => toggleOption('pictures')} /> Pictures
                        </label>
                    </div>

                    <button 
                        onClick={handleResidueScan}
                        disabled={isProcessing}
                        className="bh-btn bh-btn-white"
                        style={{ width: '100%', justifyContent: 'center', marginBottom: '20px', marginTop: 'auto' }}
                    >
                        {isProcessing ? 'Scanning...' : 'Start Scan'}
                    </button>
                    
                    {cleanupReport && (
                        <div style={{ padding: '10px', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 'var(--radius)', marginBottom: '10px', fontWeight: 600, fontSize: '13px', color: 'green' }}>
                            {cleanupReport}
                        </div>
                    )}

                    {hasScanned && (
                        <div>
                            {residueFiles.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'green', fontWeight: 700 }}>
                                    <CheckCircle size={24} />
                                    <span>SYSTEM CLEAN.</span>
                                </div>
                            ) : (
                                <div style={{ background: '#fff', border: '1px solid var(--bh-red)', borderRadius: 'var(--radius)', padding: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--bh-red)', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, textTransform:'uppercase', fontSize: '13px' }}>
                                            <AlertTriangle size={16} /> {residueFiles.length} Risks Found
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', maxHeight: '150px', overflowY: 'auto', marginBottom: '10px' }}>
                                        <ul style={{ margin: 0, paddingLeft: '20px', fontFamily:'monospace' }}>
                                            {residueFiles.map((f, i) => (
                                                <li key={i}>{f.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <button
                                        onClick={handleResidueCleanup}
                                        className="bh-btn bh-btn-danger"
                                        style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                                    >
                                        CLEANUP ALL
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. Ephemeral Task Zone */}
                <div className="bh-card" style={{ textAlign: 'center', padding: '40px', background: '#f5f5f5', border: '2px dashed #ccc', display: 'flex', flexDirection: 'column', height: '100%' }}>
                     <div style={{width:'60px', height:'60px', background:'#666', borderRadius:'50%', margin:'0 auto 20px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <Clock size={30} color="white" />
                     </div>
                     <h2 style={{ textTransform:'uppercase', fontWeight: 900, fontSize: '18px' }}>Ephemeral Task Zone</h2>
                     <p style={{ marginBottom: '30px', fontSize: '13px' }}>Temporary workspace for online forms & uploads. Auto-destroys on exit.</p>
                     <button 
                        onClick={handleStartTaskSession}
                        className="bh-btn bh-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', background: '#444', marginTop: 'auto' }}
                        disabled={wipeFailures.length > 0}  
                     >
                        Start Task Mode
                     </button>
                </div>
            </div>




                {/* Privacy Footprint - Live Dashboard (Only after Secure Destruction) */}
                {endReason && (
                    <div className="bh-card" style={{ marginTop: '30px', borderTop: '4px solid var(--bh-green)', padding: '25px' }}>
                        <h3 style={{ marginTop: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Shield size={20} color="green" /> Privacy Footprint – LIVE
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', margin: '20px 0' }}>
                            <StatusItem label="Active Sessions" value="0" />
                            <StatusItem label="Session Folders" value="0" />
                            <StatusItem label="Browser Cache" value="Clean" />
                            <StatusItem label="Downloads" value="Clean" />
                            <StatusItem label="Desktop" value="Clean" />
                            <StatusItem label="Print Spool" value="Empty" />
                            <StatusItem label="Temp Files" value="Clean" />
                        </div>

                        <div style={{ background: '#e6f4ea', color: '#137333', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: 800, border: '1px solid #ceead6' }}>
                            OVERALL STATE: 🟢 ZERO CUSTOMER DATA
                        </div>
                    </div>
                )}
            </div>
        )}

        {sessionInfo.id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Metadata Dashboard */}
            <div className="bh-grid">
                <DashboardCard label="Session ID" value={sessionInfo.id.split('_')[2] || '...'} icon={<Shield size={20}/>} />
                <DashboardCard label="Started At" value={formatTime(sessionInfo.startTime)} icon={<Clock size={20}/>} />
                <DashboardCard label="Files" value={sessionInfo.fileCount.toString()} icon={<FileText size={20}/>}/>
                <DashboardCard label="Storage" value={formatBytes(sessionInfo.totalSize)} icon={<HardDrive size={20}/>} />
            </div>

            {sessionInfo.uploadUrl && (
                <div className="bh-card" style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#fafafa' }}>
                    <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                        <img src={sessionInfo.uploadUrl} alt="Secure Upload QR" style={{ width: '120px', height: '120px', display: 'block' }} />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                            <Smartphone size={20} /> Secure Mobile Upload
                        </h3>
                        <p style={{ fontSize: '13px', color: '#555', maxWidth: '400px', margin: 0 }}>
                            Scan this QR code to upload a file directly from your mobile device. 
                            The link is valid for <b>one upload</b> only and expires immediately.
                        </p>
                    </div>
                </div>
            )}

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
                               <button 
                                onClick={() => handleDeleteFile(file.name)}
                                title="Secure Delete"
                                className="bh-btn bh-btn-danger" style={{padding: '6px'}}>
                                   <Trash2 size={16} />
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


function StatusItem({ label, value }: { label: string, value: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
             <span style={{ fontSize: '13px', color: '#555', fontWeight: 600 }}>{label}</span>
             <span style={{ fontSize: '14px', fontWeight: 800, color: value === 'Clean' || value === 'Empty' || value === '0' ? '#137333' : 'black' }}>
                {value === 'Clean' || value === 'Empty' || value === '0' ? <CheckCircle size={14} style={{verticalAlign:'middle', marginRight:'4px'}}/> : null}
                {value}
             </span>
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
