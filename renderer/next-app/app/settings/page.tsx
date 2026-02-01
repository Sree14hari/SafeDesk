'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, History, BookOpen, Shield, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'replay' | 'manual'>('replay');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
     if (typeof window !== 'undefined' && (window as any).electron) {
         (window as any).electron.invoke('audit:get-logs').then((logs: any) => {
             setAuditLogs(logs || []);
         }).catch((err: any) => console.error("Failed to fetch logs:", err));
     }
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f9fa', fontFamily: 'var(--font-outfit), sans-serif', color: '#333' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e0e0e0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
         <button 
            onClick={() => router.push('/')} 
            className="bh-btn-hover"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center' }}
         >
            <ArrowLeft size={22} color="#444" />
         </button>
         <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Settings & Tools</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: '260px', background: 'white', borderRight: '1px solid #e0e0e0', padding: '16px 0', display: 'flex', flexDirection: 'column' }}>
            <div 
              onClick={() => setActiveTab('replay')}
              style={{ 
                  padding: '12px 24px', 
                  cursor: 'pointer', 
                  background: activeTab === 'replay' ? '#f0f4ff' : 'transparent', 
                  color: activeTab === 'replay' ? '#2563eb' : '#4b5563', 
                  fontWeight: activeTab === 'replay' ? 600 : 500, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  borderLeft: activeTab === 'replay' ? '4px solid #2563eb' : '4px solid transparent',
                  transition: 'all 0.1s'
              }}
            >
                <History size={18} /> Session Replay
            </div>
            <div 
              onClick={() => setActiveTab('manual')}
              style={{ 
                  padding: '12px 24px', 
                  cursor: 'pointer', 
                  background: activeTab === 'manual' ? '#f0f4ff' : 'transparent', 
                  color: activeTab === 'manual' ? '#2563eb' : '#4b5563', 
                  fontWeight: activeTab === 'manual' ? 600 : 500, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  borderLeft: activeTab === 'manual' ? '4px solid #2563eb' : '4px solid transparent',
                  transition: 'all 0.1s'
              }}
            >
                <BookOpen size={18} /> User Manual
            </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
            
            {/* SESSION REPLAY TAB */}
            {activeTab === 'replay' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '30px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Session Replay (Data-Less)</h2>
                        <p style={{ color: '#666' }}>“Show what happened — without showing files.” Visualize previous session events.</p>
                    </div>

                    <div className="bh-card" style={{ padding: '40px', minHeight: '400px' }}>
                         {auditLogs.length === 0 && (
                             <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                                 <History size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                                 <p>No activity logs found yet.</p>
                             </div>
                         )}

                         <div style={{ position: 'relative', borderLeft: '2px solid #e5e7eb', paddingLeft: '40px', marginLeft: '20px' }}>
                            {auditLogs.map((log, i) => (
                                <div key={i} style={{ marginBottom: '40px', position: 'relative' }}>
                                    {/* Timeline Marker */}
                                    <div style={{
                                        position: 'absolute', 
                                        left: '-47px', 
                                        top: '4px', 
                                        width: '12px', 
                                        height: '12px', 
                                        borderRadius: '50%', 
                                        background: log.type === 'SESSION_START' ? '#2563eb' : (log.type.includes('WIPE_SUCCESS') ? '#16a34a' : (log.type.includes('WIPE_FAILURE') ? '#dc2626' : '#9ca3af')),
                                        border: '2px solid white',
                                        boxShadow: '0 0 0 2px #e5e7eb'
                                    }}></div>
                                    
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  •  {new Date(log.timestamp).toLocaleDateString()}
                                    </div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                                        {/* Censor Session IDs */}
                                        {log.details.replace(/session_[0-9_]+/, 'SESSION_***')}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', fontWeight: 500 }}>
                                        EVENT TYPE: {log.type}
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            )}

            {/* USER MANUAL TAB */}
            {activeTab === 'manual' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '30px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>User Manual</h2>
                        <p style={{ color: '#666' }}>Guide to operating the SafeDesk secure environment.</p>
                    </div>

                    <div className="bh-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '30px', borderBottom: '1px solid #eee' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Shield size={20} color="#2563eb" /> 1. Overview</h3>
                            <p style={{ lineHeight: '1.6', color: '#444' }}>
                                SafeDesk is a ephemeral workspace designed to handle sensitive documents with zero residue. 
                                Every session creates a temporary encrypted container that is completely destroyed when you finish.
                            </p>
                        </div>
                        <div style={{ padding: '30px', borderBottom: '1px solid #eee' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><FileText size={20} color="#2563eb" /> 2. Importing Files</h3>
                            <ul style={{ lineHeight: '1.8', color: '#444', paddingLeft: '20px' }}>
                                <li><strong>USB/Disk:</strong> Use the "Add Files" button to select files from connected drives.</li>
                                <li><strong>Mobile Upload:</strong> Scan the QR code (if enabled) to upload a file directly from your phone without cables.</li>
                            </ul>
                        </div>
                        <div style={{ padding: '30px', borderBottom: '1px solid #eee' }}>
                             <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CheckCircle size={20} color="#2563eb" /> 3. Ending a Session</h3>
                             <p style={{ lineHeight: '1.6', color: '#444' }}>
                                 Click "End Session" (Trash Icon) to initiate the wipe sequence. 
                                 SafeDesk performs a proprietary DoD-standard wipe (Overwrite → Rename → Delete) 
                                 to ensure forensic unrecoverability.
                             </p>
                        </div>
                         <div style={{ padding: '30px', background:'#fff4f4' }}>
                             <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626' }}><AlertTriangle size={20} /> 4. Safety Warnings</h3>
                             <p style={{ lineHeight: '1.6', color: '#7f1d1d' }}>
                                 Do NOT close the application window forcefully during the "Destruction in Progress" phase. 
                                 Wait for the green "System Clean" confirmation.
                             </p>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}
