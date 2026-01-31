'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    // Listen for status updates from main process
    if (window.electronAPI) {
      window.electronAPI.onSessionStatus((_event: any, value: string) => {
        setStatus(value);
      });
    }
  }, []);

  const handleStartSession = () => {
    if (window.electronAPI) {
      console.log('Sending start-session IPC message');
      window.electronAPI.startSession();
      setStatus('Requesting Session Start...');
    } else {
      console.error('Electron API not available');
      setStatus('Error: Electron API unavailable');
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Secure App</h1>
      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={handleStartSession}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          Start Session
        </button>
      </div>
      <p>Status: <strong>{status}</strong></p>
    </div>
  );
}
