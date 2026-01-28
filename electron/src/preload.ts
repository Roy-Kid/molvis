import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Add API methods here
});
