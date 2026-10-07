import { createContext, useContext } from 'react';
import type { Catalog } from '../domain/catalog';

export const CatalogContext = createContext<Catalog | null>(null);

export function useCatalog(): Catalog {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error('useCatalog must be used inside CatalogContext');
  return catalog;
}
