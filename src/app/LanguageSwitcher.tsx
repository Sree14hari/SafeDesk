'use client';

import React, { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { Language } from './i18n';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
    { code: 'ml', name: 'മലയാളം', flag: '🌴' },
  ];

  return (
    <div className="language-dropdown">
      <button 
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="current-flag">{languages.find(l => l.code === language)?.flag}</span>
        <span className="current-code">{language.toUpperCase()}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: 4, opacity: 0.5 }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isOpen && (
        <>
            <div className="dropdown-backdrop" onClick={() => setIsOpen(false)} />
            <div className="dropdown-menu">
                {languages.map((lang) => (
                    <button
                    key={lang.code}
                    onClick={() => {
                        setLanguage(lang.code);
                        setIsOpen(false);
                    }}
                    className={`dropdown-item ${language === lang.code ? 'active' : ''}`}
                    >
                    <span className="flag">{lang.flag}</span>
                    <span className="lang-name">{lang.name}</span>
                    {language === lang.code && <span className="check">✓</span>}
                    </button>
                ))}
            </div>
        </>
      )}
      
      <style jsx>{`
        .language-dropdown {
          position: relative;
          z-index: 50;
        }

        .dropdown-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 45;
            cursor: default;
        }
        
        .dropdown-trigger {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          color: rgba(0, 0, 0, 0.8);
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          position: relative;
          z-index: 50; /* Ensure button stays above backdrop */
        }
        
        .dropdown-trigger:hover {
            background: rgba(0, 0, 0, 0.08);
        }

        .dropdown-menu {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 4px;
            background: white;
            border: 1px solid rgba(0,0,0,0.1);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            padding: 4px;
            min-width: 140px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            animation: slideIn 0.1s ease-out;
            z-index: 50; /* Ensure menu stays above backdrop */
        }

        .dropdown-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: none;
            background: transparent;
            width: 100%;
            text-align: left;
            cursor: pointer;
            border-radius: 8px;
            font-family: inherit;
            font-size: 14px;
            color: #333;
            transition: background 0.1s;
        }

        .dropdown-item:hover {
            background: #f5f5f5;
        }

        .dropdown-item.active {
            background: #eef2ff;
            color: #3b82f6;
            font-weight: 500;
        }

        .flag { font-size: 16px; }
        .check { margin-left: auto; font-weight: bold; }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
