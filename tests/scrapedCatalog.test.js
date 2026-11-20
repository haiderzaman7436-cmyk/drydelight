import { describe, it, expect } from 'vitest';
import scrapedCatalog from '../src/data/scrapedCatalog.json';
import { isValidEan13, calculateEan13CheckDigit } from '../src/utils/barcode';

describe('Scraped Inventory & Product Catalog Verification', () => {
  it('contains the scraped catalog with 11 categories and all transcribed products', () => {
    expect(scrapedCatalog.categories.length).toBe(11);
    expect(scrapedCatalog.products.length).toBeGreaterThanOrEqual(100);
    expect(scrapedCatalog.totalProducts).toBe(scrapedCatalog.products.length);
  });

  it('all categories have required valid id, name, and description', () => {
    for (const cat of scrapedCatalog.categories) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.description).toBeTruthy();
    }
  });

  it('all products have required non-empty fields and numeric stock/pricing', () => {
    for (const p of scrapedCatalog.products) {
      expect(p.name).toBeTruthy();
      expect(p.sku).toBeTruthy();
      expect(p.barcode).toBeTruthy();
      expect(p.categoryId).toBeTruthy();
      expect(p.categoryName).toBeTruthy();
      expect(typeof p.purchasePrice).toBe('number');
      expect(p.purchasePrice).toBeGreaterThanOrEqual(0);
      expect(typeof p.sellingPrice).toBe('number');
      expect(p.sellingPrice).toBeGreaterThanOrEqual(0);
      expect(typeof p.availableQuantity).toBe('number');
      expect(p.availableQuantity).toBeGreaterThanOrEqual(0);
      expect(typeof p.minStockLevel).toBe('number');
      expect(p.minStockLevel).toBeGreaterThanOrEqual(0);
    }
  });

  it('all assigned barcodes are strictly valid EAN-13 barcodes with correct GS1 check digits', () => {
    for (const p of scrapedCatalog.products) {
      expect(p.barcode).toMatch(/^\d{13}$/);
      const base12 = p.barcode.slice(0, 12);
      const checkDigit = calculateEan13CheckDigit(base12);
      expect(Number(p.barcode[12])).toBe(checkDigit);
      expect(isValidEan13(p.barcode)).toBe(true);
    }
  });

  it('every product barcode is strictly unique across the entire catalog', () => {
    const seenBarcodes = new Set();
    for (const p of scrapedCatalog.products) {
      expect(seenBarcodes.has(p.barcode)).toBe(false);
      seenBarcodes.add(p.barcode);
    }
    expect(seenBarcodes.size).toBe(scrapedCatalog.products.length);
  });

  it('every product SKU is strictly unique across the entire catalog', () => {
    const seenSkus = new Set();
    for (const p of scrapedCatalog.products) {
      expect(seenSkus.has(p.sku)).toBe(false);
      seenSkus.add(p.sku);
    }
    expect(seenSkus.size).toBe(scrapedCatalog.products.length);
  });

  it('every product references a valid category in the categories list', () => {
    const validCatIds = new Set(scrapedCatalog.categories.map((c) => c.id));
    for (const p of scrapedCatalog.products) {
      expect(validCatIds.has(p.categoryId)).toBe(true);
    }
  });

  it('products are alphabetically sorted by name for instant discoverability', () => {
    for (let i = 0; i < scrapedCatalog.products.length - 1; i++) {
      const current = scrapedCatalog.products[i].name;
      const next = scrapedCatalog.products[i + 1].name;
      expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
    }
  });
});
