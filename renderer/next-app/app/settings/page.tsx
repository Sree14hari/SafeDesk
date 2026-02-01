'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Shield, FileText, CheckCircle, AlertTriangle, Globe, Check } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { Language } from '../i18n';

export default function SettingsPage() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'language' | 'manual'>('language');

  const languages: { code: Language; name: string; englishName: string; flag: string }[] = [
    { code: 'en', name: 'English', englishName: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिंदी', englishName: 'Hindi', flag: '🇮🇳' },
    { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam', flag: '🌴' },
  ];

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
              onClick={() => setActiveTab('language')}
              style={{ 
                  padding: '12px 24px', 
                  cursor: 'pointer', 
                  background: activeTab === 'language' ? '#f0f4ff' : 'transparent', 
                  color: activeTab === 'language' ? '#2563eb' : '#4b5563', 
                  fontWeight: activeTab === 'language' ? 600 : 500, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  borderLeft: activeTab === 'language' ? '4px solid #2563eb' : '4px solid transparent',
                  transition: 'all 0.1s'
              }}
            >
                <Globe size={18} /> Language
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
            
            {/* LANGUAGE TAB */}
            {activeTab === 'language' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '30px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Language Selection</h2>
                        <p style={{ color: '#666' }}>Choose your preferred interface language.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                        {languages.map((lang) => (
                            <div 
                                key={lang.code}
                                onClick={() => setLanguage(lang.code)}
                                style={{ 
                                    background: 'white', 
                                    border: language === lang.code ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                    borderRadius: '12px', 
                                    padding: '24px', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    boxShadow: language === lang.code ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                }}
                            >
                                {language === lang.code && (
                                    <div style={{ position: 'absolute', top: '12px', right: '12px', color: '#2563eb' }}>
                                        <Check size={20} />
                                    </div>
                                )}
                                <div style={{ fontSize: '48px' }}>{lang.flag}</div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 700, fontSize: '18px', color: '#111827' }}>{lang.name}</div>
                                    <div style={{ color: '#6b7280', fontSize: '14px' }}>{lang.englishName}</div>
                                </div>
                            </div>
                        ))}
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
