import React, { useState, useEffect } from 'react';
import { Molvis } from '@molvis/core';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ModeType } from '@molvis/core';

interface EditorPanelProps {
  app: Molvis | null;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ app }) => {
  const [activeElement, setActiveElement] = useState<string>('C');
  const [activeBondOrder, setActiveBondOrder] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Sync state with EditMode
  useEffect(() => {
    if (!app) return;

    const updateState = () => {
        const mode = app.mode;
        if (mode && mode.type === ModeType.Edit) {
            setIsEditMode(true);
            // We can cast to specific type if we had it imported, or use any
            const editMode = mode as any;
            if (editMode.element) setActiveElement(editMode.element);
            if (editMode.bondOrder) setActiveBondOrder(editMode.bondOrder);
        } else {
            setIsEditMode(false);
        }
    };

    updateState();

    // Subscribe to mode changes
    const onModeChange = () => updateState();
    
    // Check if events API is available and compatible
    if (app.events && typeof app.events.on === 'function') {
        app.events.on('mode-change', onModeChange);
    }
    
    // Also likely need to update when element/bond properties change from other sources
    // But currently core doesn't emit events for internal property changes of modes easily without more coupling.
    // For now, we assume this UI is the primary driver or sufficient.
    
    return () => {
        if (app.events && typeof app.events.off === 'function') {
            app.events.off('mode-change', onModeChange);
        }
    };
  }, [app]);

  const updateEditMode = (updates: { element?: string; bondOrder?: number }) => {
    if (!app) return;
    
    const mode = app.mode;
    if (mode && mode.type === ModeType.Edit) {
       const editMode = mode as any;
       if (updates.element) {
           editMode.element = updates.element;
           setActiveElement(updates.element);
       }
       if (updates.bondOrder) {
           editMode.bondOrder = updates.bondOrder;
           setActiveBondOrder(updates.bondOrder);
       }
    }
  };

  const handleUndo = () => {
      const mode = app?.mode;
      if (mode && typeof (mode as any).artist?.undo === 'function') {
          (mode as any).artist.undo();
      }
  };

  const handleRedo = () => {
    const mode = app?.mode;
    if (mode && typeof (mode as any).artist?.redo === 'function') {
        (mode as any).artist.redo();
    }
  };

  const handleSave = () => {
    const mode = app?.mode;
    if (mode) {
        // Try public or private access strategies
        if (typeof (mode as any)._on_press_ctrl_s === 'function') {
            (mode as any)._on_press_ctrl_s();
        } else if (typeof (mode as any).saveToFrame === 'function') {
             (mode as any).saveToFrame();
        }
    }
  };
  
  if (!app || !isEditMode) return null;

  return (
    <div className="flex flex-col gap-4 p-4 h-full pointer-events-auto">
      <div className="text-xs font-semibold mb-1">Elements</div>
      <div className="flex gap-1">
        {['C', 'N', 'O', 'H'].map((el) => (
          <Button
            key={el}
            variant={activeElement === el ? "default" : "outline"}
            size="icon"
            className="w-8 h-8 font-bold"
            onClick={() => updateEditMode({ element: el })}
          >
            {el}
          </Button>
        ))}
      </div>
      
      <Separator />
      
      <div className="text-xs font-semibold mb-1">Bonds</div>
      <div className="flex gap-1">
        {[1, 2, 3].map((order) => (
          <Button
            key={order}
            variant={activeBondOrder === order ? "default" : "outline"}
            size="icon"
            className="w-8 h-8 font-bold"
            onClick={() => updateEditMode({ bondOrder: order })}
          >
            {order === 1 ? '-' : order === 2 ? '=' : '≡'}
          </Button>
        ))}
      </div>

      <Separator />

      <div className="text-xs font-semibold mb-1">Actions</div>
      <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleUndo} title="Undo">
            ↩️
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleRedo} title="Redo">
            ↪️
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={handleSave} title="Save">
            💾
          </Button>
      </div>
    </div>
  );
};
