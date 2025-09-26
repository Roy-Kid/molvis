import React, { useEffect, useRef } from 'react';
import { Molvis, MolvisOptions } from '@molvis/core';

// Molvis wrapper: create / destroy core instance. Pure rendering area.
const MolvisWrapper: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const molvisRef = useRef<Molvis | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
  // Default options: adaptive to container size
    const options: MolvisOptions = {
      fitContainer: true,
      showUI: false,
      grid: {
        enabled: true,
        mainColor: '#444',
        lineColor: '#666',
        opacity: 0.25,
        size: 10,
      },
    };
    try {
      molvisRef.current = new Molvis(containerRef.current, options);
    } catch (e) {
  console.error('Failed to init Molvis', e);
    }
    const handleResize = () => {
      if (!containerRef.current || !molvisRef.current) return;
      molvisRef.current.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      try {
        molvisRef.current?.destroy();
      } catch (e) {
  console.error('Failed to destroy Molvis', e);
      }
      molvisRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000',
        border: 'none',
        zIndex: 0,
      }}
    />
  );
};

export default MolvisWrapper;