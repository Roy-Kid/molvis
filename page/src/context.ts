import type { Molvis } from "@molvis/core";
import { createContext, useContext } from "react";

export const MolvisContext = createContext<Molvis | null>(null);

export const useMolvis = () => useContext(MolvisContext);
