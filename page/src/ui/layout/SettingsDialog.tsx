import React from 'react';
import { Molvis } from '@molvis/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings } from 'lucide-react';
import { RenderTab } from '../modes/view/RenderTab';

interface SettingsDialogProps {
  app: Molvis | null;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ app }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="py-4">
           {/* Reuse RenderTab content or creating specific settings content */}
           <RenderTab app={app} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
