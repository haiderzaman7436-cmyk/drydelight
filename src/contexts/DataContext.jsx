import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { getAllCategories } from '../services/categoryService';
import { getAllProducts } from '../services/productService';
import { clearAllQueryCache } from '../services/queryCache';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const refreshCatalog = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingCatalog(true);
    try {
      const [cats, prods] = await Promise.all([
        getAllCategories(),
        getAllProducts(),
      ]);
      cats.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      prods.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCategories(cats);
      setProducts(prods);
      setCatalogLoaded(true);
    } finally {
      setLoadingCatalog(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshCatalog().catch((err) => {
        console.error('Failed to preload catalog:', err);
      });
    } else {
      setCategories([]);
      setProducts([]);
      setCatalogLoaded(false);
      clearAllQueryCache();
    }
  }, [isAuthenticated, refreshCatalog]);

  // O(1) lookup maps for instant barcode scanning and cart/edit lookups
  const productByBarcode = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (p.barcode) map.set(p.barcode, p);
    }
    return map;
  }, [products]);

  const productById = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Instant in-memory mutations (0ms UI updates without re-downloading full collections)
  const upsertCategoryLocal = useCallback((cat) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === cat.id);
      const next = exists
        ? prev.map((c) => (c.id === cat.id ? { ...c, ...cat } : c))
        : [...prev, cat];
      return next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    // Also update denormalized categoryName on cached products
    setProducts((prev) =>
      prev.map((p) =>
        p.categoryId === cat.id ? { ...p, categoryName: cat.name } : p
      )
    );
  }, []);

  const removeCategoryLocal = useCallback((categoryId, reassignTarget = null) => {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    if (reassignTarget) {
      setProducts((prev) =>
        prev.map((p) =>
          p.categoryId === categoryId
            ? { ...p, categoryId: reassignTarget.id, categoryName: reassignTarget.name }
            : p
        )
      );
    }
  }, []);

  const upsertProductLocal = useCallback((prod) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === prod.id);
      const next = exists
        ? prev.map((p) => (p.id === prod.id ? { ...p, ...prod } : p))
        : [...prev, prod];
      return next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });
  }, []);

  const removeProductLocal = useCallback((productId) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const applyStockUpdatesLocal = useCallback((updates = []) => {
    if (!Array.isArray(updates) || updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.productId, u.newStock]));
    setProducts((prev) =>
      prev.map((p) =>
        byId.has(p.id)
          ? { ...p, availableQuantity: Math.max(0, Number(byId.get(p.id) || 0)) }
          : p
      )
    );
  }, []);

  const value = useMemo(
    () => ({
      categories,
      products,
      productByBarcode,
      productById,
      catalogLoaded,
      loadingCatalog,
      refreshCatalog,
      upsertCategoryLocal,
      removeCategoryLocal,
      upsertProductLocal,
      removeProductLocal,
      applyStockUpdatesLocal,
    }),
    [
      categories,
      products,
      productByBarcode,
      productById,
      catalogLoaded,
      loadingCatalog,
      refreshCatalog,
      upsertCategoryLocal,
      removeCategoryLocal,
      upsertProductLocal,
      removeProductLocal,
      applyStockUpdatesLocal,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
