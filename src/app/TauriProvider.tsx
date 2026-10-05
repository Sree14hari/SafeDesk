'use client';

import React, { useEffect } from 'react';
import { initTauriBridge } from '../lib/tauriBridge';

export function TauriProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTauriBridge();
  }, []);

  return <>{children}</>;
}
