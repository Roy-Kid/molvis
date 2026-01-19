import { createContext, useContext } from 'react';
import type { Molvis } from '@molvis/core';

export const MolvisContext = createContext<Molvis | null>(null);

export const useMolvis = () => useContext(MolvisContext);
