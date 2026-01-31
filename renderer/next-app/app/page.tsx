'use client';
import { useState, useEffect } from 'react';

// Locally defining interface if not picked up globally in dev immediately
interface FileMetadata {
  name: string;
  size: number;
}

export default function Home() {
  const [status, setStatus] = useState('Ready');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);

  useEffect(() => {
    if (window.electronAPI) {
      // Listen for status updates
      window.electronAPI.onSessionStatus((_event, value) => {
        setStatus(value);
      });

      // Listen for session creation
      window.electronAPI.onSessionCreated((_event, id) => {
        setSessionId(id);
        setStatus(`Session Active: ${id}`);
        setFiles([]); // Reset files on new session
      });

      // Listen for file updates
      window.electronAPI.onFilesUpdated((_event, newFiles) => {
         // Append new files to existing list
         setFiles(prev => [...prev, ...newFiles]);
      });
    }
  }, []);

  const handleStartSession = () => {
    if (window.electronAPI) {
      window.electronAPI.startSession();
      setStatus('Requesting Session Start...');
    }
  };

  const handleImport = () => {
    if (!sessionId) {
      alert('Please start a session first.');
      return;
    }
    window.electronAPI.triggerFileImport();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid #eaeaea', paddingBottom: '20px' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>Secure Session Workspace</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
             <p style={{ margin: 0, color: '#666' }}>Status: <strong>{status}</strong></p> 
             {sessionId && <span style={{ padding: '4px 8px', background: '#dff6dd', color: '#1f5f19', borderRadius: '4px', fontSize: '14px' }}>Active</span>}
        </div>
      </header>

      <main>
        {!sessionId ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <button 
              onClick={handleStartSession}
              style={{
                padding: '12px 24px',
                fontSize: '18px',
                cursor: 'pointer',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)'
              }}
            >
              Start Secure Session
            </button>
            <p style={{ marginTop: '15px', color: '#666' }}>Click to initialize an isolated workspace.</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Session Files</h2>
              <button 
                onClick={handleImport}
                style={{
                  padding: '10px 16px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  color: '#0070f3',
                  border: '1px solid #0070f3',
                  borderRadius: '5px'
                }}
              >
                + Import Files (Secure)
              </button>
            </div>

            <div style={{ background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eaeaea', minHeight: '200px' }}>
              {files.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  No files in this session yet. Import files to begin.
                </div>
              ) : (
                 <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                   {files.map((file, idx) => (
                     <li key={idx} style={{ 
                       padding: '12px 20px', 
                       borderBottom: '1px solid #eaeaea', 
                       display: 'flex', 
                       justifyContent: 'space-between',
                       alignItems: 'center'
                     }}>
                       <span style={{ fontWeight: 500 }}>{file.name}</span>
                       <span style={{ color: '#666', fontSize: '14px' }}>{(file.size / 1024).toFixed(1)} KB</span>
                     </li>
                   ))}
                 </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
