import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseSMILES } from "@molvis/core";
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
    <div className="flex flex-col gap-1.5">
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder="e.g. CCO"
        className="h-7 text-xs font-mono"
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-[10px]"
        onClick={handleParse}
        disabled={disabled || !value.trim()}
      >
        Place
      </Button>

      {error && (
        <p className="text-[10px] text-destructive leading-tight">{error}</p>
      )}
    </div>
  );
};
