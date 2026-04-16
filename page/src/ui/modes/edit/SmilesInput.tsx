import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseSMILES } from "@molvis/core";
import { AlertCircle, Wand2 } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface SmilesInputProps {
  onParsed: (smiles: string) => void;
  disabled?: boolean;
}

export const SmilesInput: React.FC<SmilesInputProps> = ({
  onParsed,
  disabled,
}) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleParse = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    try {
      const ir = parseSMILES(trimmed);
      ir.free();
      setError(null);
      onParsed(trimmed);
    } catch (err) {
      console.error("[SmilesInput] parseSMILES error:", err);
      setError(String(err));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="CCO"
          className="h-7 flex-1 min-w-0 text-xs font-mono"
          aria-label="SMILES string"
        />
        <Button
          variant="outline"
          size="icon-sm"
          className="h-7 w-7 shrink-0"
          onClick={handleParse}
          disabled={disabled || !value.trim()}
          title="Parse SMILES & place"
          aria-label="Parse SMILES & place"
        >
          <Wand2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {error && (
        <p className="flex items-start gap-1 text-[10px] text-destructive leading-tight">
          <AlertCircle className="h-3 w-3 shrink-0 mt-px" />
          <span className="truncate">{error}</span>
        </p>
      )}
    </div>
  );
};
