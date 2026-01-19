import React, { useEffect, useRef } from 'react';
import { Molvis, MolvisOptions, mountMolvis } from '@molvis/core';

// Molvis wrapper: create / destroy core instance. Pure rendering area.
interface MolvisWrapperProps {
  onMount?: (app: Molvis) => void;
}

const MolvisWrapper: React.FC<MolvisWrapperProps> = ({ onMount }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const molvisRef = useRef<Molvis | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    console.log('[MolvisWrapper] Mounting...', containerRef.current.getBoundingClientRect());

    const options: MolvisOptions = {
      fitContainer: true,
      showUI: true,
      grid: {
        enabled: true,
        mainColor: '#444',
        lineColor: '#666',
        opacity: 0.25,
        size: 10,
      },
    };
    try {
      molvisRef.current = mountMolvis(containerRef.current, options);
      console.log('[MolvisWrapper] Mounted successfully', molvisRef.current);
      molvisRef.current.start();
      if (onMount) onMount(molvisRef.current);
    } catch (e) {
      console.error('[MolvisWrapper] Mount failed', e);
      throw e;
    }

    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            console.log('[MolvisWrapper] Resizing', entry.contentRect);
            molvisRef.current?.resize();
        }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      console.log('[MolvisWrapper] Unmounting...');
      resizeObserver.disconnect();
      try {
        molvisRef.current?.destroy();
      } catch (e) {
        console.error('[MolvisWrapper] Destroy failed', e);
        throw e;
      }
      molvisRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="molvis-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000',
        border: 'none',
        zIndex: 0
      }}
    />
  );
};

export default MolvisWrapper;
