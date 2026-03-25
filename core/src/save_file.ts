// File System Access API — not yet in lib.dom.d.ts
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<{
      createWritable(): Promise<{
        write(data: Blob): Promise<void>;
        close(): Promise<void>;
      }>;
    }>;
  }
}

export async function defaultSaveFile(
  blob: Blob,
  suggestedName: string,
): Promise<void> {
  if (typeof window.showSaveFilePicker !== "function") {
    throw new Error(
      "Save dialog not available in this environment. Override app.saveFile to provide a custom implementation.",
    );
  }

  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: "Molecular structure files",
        accept: {
          "chemical/x-pdb": [".pdb"],
          "chemical/x-xyz": [".xyz"],
          "text/plain": [".lammps"],
        },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}
