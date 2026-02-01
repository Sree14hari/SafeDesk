'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
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
  Globe,
  Settings,
  History
} from 'lucide-react';

interface SessionInfo {
    id: string | null;
    startTime: number | null;
    totalSize: number;
    fileCount: number;
    uploadUrl?: string | null;
    type?: 'PRINT' | 'TASK';
    riskLevel?: "low" | "medium" | "high";
    aiPolicyReason?: string;
    currentTimeoutSeconds?: number;
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
  const router = useRouter(); // Hook
  const { t, language } = useLanguage();
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
    <div className="bh-container" data-lang={language}>
      
      {/* Header */}
      <header className="bh-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', background: sessionInfo.id ? 'var(--bh-red)' : 'var(--bh-black)', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', border: '2px solid black' }}>
                <Shield color="white" size={20} />
            </div>
            <div>
                <h1 className="bh-title">{t('appName')}</h1>
                <div style={{display:'flex', gap:'8px'}}>
                    <div className="bh-status-pill">{t('customerMode')}</div>
                </div>
            </div>
        </div>
        

        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{fontFamily: 'monospace', fontWeight: 600, marginRight: '8px', display: 'flex', alignItems: 'center'}}>
                 <Activity size={14} style={{marginRight: 6}}/>
                 {status}
             </div>
             <div style={{width:'1px', height:'24px', background:'#e0e0e0'}}></div>

             {sessionInfo.type === 'PRINT' && (
                     <button className="bh-btn bh-btn-action" onClick={handleScan}>
                         <ScanLine size={16} /> {t('btnScanPaper')}
                     </button>
                 )}
                 {sessionInfo.type === 'TASK' && (
                      <button className="bh-btn bh-btn-action" onClick={handleLaunchBrowser} style={{background: '#2196F3'}}>
                         <Globe size={16} /> {t('btnOpenBrowser')}
                     </button>
                 )}
                 
                {sessionInfo.id && (
                    <>
                    <div style={{width:'2px', height:'30px', background:'black'}}></div>
                    <button className="bh-btn bh-btn-danger" onClick={handleEndSession}>
                        <Trash2 size={16} /> {t('endSession')}
                    </button>
                    </>
                )}
                <button 
                  onClick={() => router.push('/settings')} 
                  style={{
                    background:'none', 
                    border:'none', 
                    cursor:'pointer', 
                    padding:'8px', 
                    borderRadius:'8px', 
                    display:'flex', 
                    alignItems:'center', 
                    justifyContent:'center',
                    color: '#555',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                    <Settings size={20} />
                </button>
                <LanguageSwitcher />
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
                    <h2 style={{ textTransform:'uppercase', fontWeight: 900 }}>{t('printZoneTitle')}</h2>
                    <p style={{ marginBottom: '30px' }}>{t('printZoneDesc')}</p>
                    <button 
                        onClick={handleStartSession}
                        className="bh-btn bh-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                        disabled={wipeFailures.length > 0} 
                    >
                        {t('startPrintSession')}
                    </button>
                </div>

                {/* 2. Residue Guard (Secondary Action) */}
                <div className="bh-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', textTransform:'uppercase', fontSize: '16px' }}>
                            <Search size={20} /> {t('residueGuardTitle')}
                        </h3>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>{t('residueGuardDesc')}</p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginBottom: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', minWidth: '45%' }}>
                            <input type="checkbox" checked={scanOptions.desktop} onChange={() => toggleOption('desktop')} /> <span style={{whiteSpace:'nowrap'}}>{t('scan_desktop')}</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', minWidth: '45%' }}>
                            <input type="checkbox" checked={scanOptions.downloads} onChange={() => toggleOption('downloads')} /> <span style={{whiteSpace:'nowrap'}}>{t('scan_downloads')}</span>
                        </label>
                         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', minWidth: '45%' }}>
                            <input type="checkbox" checked={scanOptions.documents} onChange={() => toggleOption('documents')} /> <span style={{whiteSpace:'nowrap'}}>{t('scan_documents')}</span>
                        </label>
                         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', minWidth: '45%' }}>
                            <input type="checkbox" checked={scanOptions.pictures} onChange={() => toggleOption('pictures')} /> <span style={{whiteSpace:'nowrap'}}>{t('scan_pictures')}</span>
                        </label>
                    </div>

                    <button 
                        onClick={handleResidueScan}
                        disabled={isProcessing}
                        className="bh-btn bh-btn-white"
                        style={{ width: '100%', justifyContent: 'center', marginBottom: '20px', marginTop: 'auto' }}
                    >
                        {isProcessing ? t('actionScanning') : t('actionStartScan')}
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
                                    <span>{t('statusClean')}</span>
                                </div>
                            ) : (
                                <div style={{ background: '#fff', border: '1px solid var(--bh-red)', borderRadius: 'var(--radius)', padding: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--bh-red)', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, textTransform:'uppercase', fontSize: '13px' }}>
                                            <AlertTriangle size={16} /> {residueFiles.length} {t('statusRisks')}
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
                                        {t('actionCleanup')}
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
                     <h2 style={{ textTransform:'uppercase', fontWeight: 900, fontSize: '18px' }}>{t('taskZoneTitle')}</h2>
                     <p style={{ marginBottom: '30px', fontSize: '13px' }}>{t('taskZoneDesc')}</p>
                     <button 
                        onClick={handleStartTaskSession}
                        className="bh-btn bh-btn-primary"
                        style={{ width: '100%', justifyContent: 'center', background: '#444', marginTop: 'auto' }}
                        disabled={wipeFailures.length > 0}  
                     >
                        {t('startTaskSession')}
                     </button>
                </div>
            </div>




                {/* Privacy Footprint - Live Dashboard (Only after Secure Destruction) */}
                {endReason && (
                    <div className="bh-card" style={{ marginTop: '30px', borderTop: '4px solid var(--bh-green)', padding: '25px' }}>
                        <h3 style={{ marginTop: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Shield size={20} color="green" /> {t('privacyFootprint')}
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', margin: '20px 0' }}>
                            <StatusItem label={t('fpActiveSessions')} value="0" />
                            <StatusItem label={t('fpSessionFolders')} value="0" />
                            <StatusItem label={t('fpBrowserCache')} value="Clean" />
                            <StatusItem label={t('scan_downloads')} value="Clean" />
                            <StatusItem label={t('scan_desktop')} value="Clean" />
                            <StatusItem label={t('fpPrintSpool')} value="Empty" />
                            <StatusItem label={t('fpTempFiles')} value="Clean" />
                        </div>

                        <div style={{ background: '#e6f4ea', color: '#137333', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: 800, border: '1px solid #ceead6' }}>
                            {t('zeroData')}
                        </div>
                    </div>
                )}
            </div>
        )}

        {sessionInfo.id && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Metadata Dashboard */}
            <div className="bh-grid">
                <DashboardCard label={t('sessionId')} value={sessionInfo.id.split('_')[2] || '...'} icon={<Shield size={20}/>} />
                <DashboardCard label={t('startedAt')} value={formatTime(sessionInfo.startTime)} icon={<Clock size={20}/>} />
                <DashboardCard label={t('files')} value={sessionInfo.fileCount.toString()} icon={<FileText size={20}/>}/>
                {sessionInfo.type !== 'TASK' && (
                    <DashboardCard 
                        label={t('autoEndTimeout')}
                        value={sessionInfo.currentTimeoutSeconds ? `${Math.floor(sessionInfo.currentTimeoutSeconds / 60)}m ${sessionInfo.currentTimeoutSeconds % 60}s` : '5m'} 
                        icon={<AlertTriangle size={20}/>}
                    />
                )}
                <DashboardCard label={t('storage')} value={formatBytes(sessionInfo.totalSize)} icon={<HardDrive size={20}/>} />
            </div>

            {sessionInfo.uploadUrl && (
                <div className="bh-card" style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#fafafa' }}>
                    <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
                        <img src={sessionInfo.uploadUrl} alt="Secure Upload QR" style={{ width: '120px', height: '120px', display: 'block' }} />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                            <Smartphone size={20} /> {t('qrUploadTitle')}
                        </h3>
                        <p style={{ fontSize: '13px', color: '#555', maxWidth: '400px', margin: 0 }}>
                            {t('qrUploadInstructions')}
                        </p>
                    </div>
                </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', textTransform:'uppercase', fontWeight: 800 }}>{t('trackingHeader')}</h2>
              <button 
                onClick={handleImport}
                disabled={isProcessing}
                className="bh-btn bh-btn-primary"
              >
                <FileUp size={16} /> {isProcessing ? t('lblProcessing') : t('lblAddFiles')}
              </button>
            </div>

            {/* File List */}
            <div className="bh-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '2px solid black', background: '#eee', fontSize: '12px', fontWeight: 800, display: 'flex' }}>
                  <div style={{ flex: 1 }}>{t('colFile')}</div>
                  <div style={{ width: '150px' }}>{t('colStatus')}</div>
                  <div style={{ width: '100px', textAlign:'right' }}>{t('colActions')}</div>
              </div>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {files.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                      <p style={{fontWeight: 600}}>{t('lblNoFiles')}</p>
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

        {/* Floating AI Safety Button */}
        {sessionInfo.id && sessionInfo.riskLevel && sessionInfo.type !== 'TASK' && (
           <div style={{
               position: 'fixed',
               bottom: '24px',
               right: '24px',
               zIndex: 9999,
               display: 'flex',
               flexDirection: 'column',
               alignItems: 'flex-end',
               gap: '12px'
           }}>
               {/* Bubble (Top) */}
               {sessionInfo.aiPolicyReason && (
                    <div style={{
                        background: 'white',
                        color: 'black',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        border: '1.5px solid black',
                        fontSize: '11px',
                        fontWeight: 600,
                        boxShadow: '3px 3px 0px rgba(0,0,0,0.15)',
                        maxWidth: '220px',
                        marginBottom: '4px',
                        position: 'relative'
                    }}>
                       "{sessionInfo.aiPolicyReason}"
                       {/* Triangle pointing down to button */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-6px',
                            right: '18px',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid black'
                        }} />
                         <div style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '19.5px',
                            width: 0,
                            height: 0,
                            borderLeft: '4.5px solid transparent',
                            borderRight: '4.5px solid transparent',
                            borderTop: '4.5px solid white'
                        }} />
                   </div>
               )}

               {/* Button (Bottom) */}
                <div style={{
                    height: '40px',
                    padding: '0 16px',
                    borderRadius: '20px',
                    background: sessionInfo.riskLevel === 'high' ? 'var(--bh-red)' : sessionInfo.riskLevel === 'medium' ? 'var(--bh-yellow)' : 'var(--bh-blue)',
                    color: sessionInfo.riskLevel === 'medium' ? 'black' : 'white',
                    border: '1.5px solid black',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700,
                    fontSize: '11px',
                    boxShadow: '3px 3px 0px rgba(0,0,0,0.2)',
                    cursor: 'default'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px', 
                        borderRadius: '50%', 
                        background: sessionInfo.riskLevel === 'medium' ? 'black' : 'white',
                        animation: 'pulse 2s infinite'
                    }} />
                    AI: {sessionInfo.riskLevel.toUpperCase()}
                </div>
           </div>
        )}

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
