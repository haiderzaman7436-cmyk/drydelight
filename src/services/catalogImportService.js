import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import scrapedCatalog from '../data/scrapedCatalog.json';
import { invalidateCachePrefix } from './queryCache';
import { isValidProductImageUrl, matchProductImageByName } from '../utils/productImages';

const CATEGORIES_COL = () => collection(db, 'categories');
const PRODUCTS_COL = () => collection(db, 'products');
const MOVEMENTS_COL = () => collection(db, 'stockMovements');

/**
 * Imports or synchronizes the scraped catalog (from 32 register notebook images) into Firestore.
 * 
 * @param {Object} options
 * @param {Object} options.user Current logged-in user (admin/manager)
 * @param {Function} [options.onProgress] Callback for tracking progress (0-100, status message)
 * @param {boolean} [options.updateExistingStock=false] Whether to update stock on existing products
 * @returns {Promise<{ categoriesCreated: number, productsCreated: number, productsUpdated: number, skipped: number }>}
 */
export async function importScrapedCatalog({
  user,
  onProgress = () => {},
  updateExistingStock = false,
} = {}) {
  onProgress(5, 'Fetching existing categories and products...');

  // 1. Fetch current remote database
  const [existingCatsSnap, existingProdsSnap] = await Promise.all([
    getDocs(CATEGORIES_COL()),
    getDocs(PRODUCTS_COL()),
  ]);

  const existingCategories = existingCatsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingProducts = existingProdsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const categoryByName = new Map();
  for (const c of existingCategories) {
    if (c.name) categoryByName.set(c.name.trim().toLowerCase(), c);
  }

  const productByBarcode = new Map();
  const productBySku = new Map();
  const productByName = new Map();

  for (const p of existingProducts) {
    if (p.barcode) productByBarcode.set(p.barcode, p);
    if (p.sku) productBySku.set(p.sku.toUpperCase(), p);
    if (p.name) productByName.set(p.name.trim().toLowerCase(), p);
  }

  // 2. Ensure all 11 Categories exist
  onProgress(15, 'Ensuring categories exist...');
  let categoriesCreated = 0;
  const categoryBatch = writeBatch(db);
  const resolvedCategoryMap = new Map(); // catalog catId -> Firestore category doc

  for (const cat of scrapedCatalog.categories) {
    const existing = categoryByName.get(cat.name.trim().toLowerCase());
    if (existing) {
      resolvedCategoryMap.set(cat.id, existing);
    } else {
      const newCatRef = doc(CATEGORIES_COL());
      const catData = {
        name: cat.name.trim(),
        description: cat.description || '',
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      categoryBatch.set(newCatRef, catData);
      resolvedCategoryMap.set(cat.id, { id: newCatRef.id, ...catData });
      categoriesCreated++;
    }
  }

  if (categoriesCreated > 0) {
    await categoryBatch.commit();
  }

  // 3. Process products in chunks of 200 (Firestore writeBatch limit is 500)
  onProgress(30, 'Preparing products to import...');
  let productsCreated = 0;
  let productsUpdated = 0;
  let skipped = 0;

  const BATCH_SIZE = 200;
  let currentBatch = writeBatch(db);
  let batchOpsCount = 0;

  const totalProducts = scrapedCatalog.products.length;

  for (let i = 0; i < totalProducts; i++) {
    const item = scrapedCatalog.products[i];
    const targetCategory = resolvedCategoryMap.get(item.categoryId);
    const categoryId = targetCategory?.id || item.categoryId;
    const categoryName = targetCategory?.name || item.categoryName;

    // Check conflict by barcode, sku, or exact name
    const existing =
      productByBarcode.get(item.barcode) ||
      productBySku.get(item.sku.toUpperCase()) ||
      productByName.get(item.name.trim().toLowerCase());

    if (existing) {
      if (updateExistingStock && existing.id) {
        const prodRef = doc(db, 'products', existing.id);
        currentBatch.update(prodRef, {
          availableQuantity: item.availableQuantity,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          imageUrl: existing.imageUrl || item.imageUrl || matchProductImageByName({ name: item.name, categoryName }),
          description: '',
          updatedAt: serverTimestamp(),
        });
        batchOpsCount++;
        productsUpdated++;
      } else {
        skipped++;
      }
    } else {
      const prodRef = doc(PRODUCTS_COL());
      const productData = {
        name: item.name.trim(),
        sku: item.sku.trim().toUpperCase(),
        barcode: item.barcode.trim(),
        categoryId,
        categoryName,
        purchasePrice: Number(item.purchasePrice) || 0,
        sellingPrice: Number(item.sellingPrice) || 0,
        availableQuantity: Math.max(0, Number(item.availableQuantity) || 0),
        minStockLevel: Math.max(0, Number(item.minStockLevel) || 5),
        imageUrl: item.imageUrl || matchProductImageByName({ name: item.name, categoryName }),
        description: '',
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      currentBatch.set(prodRef, productData);
      batchOpsCount++;
      productsCreated++;

      // Create initial stock movement ledger entry if available quantity > 0
      if (productData.availableQuantity > 0) {
        const movRef = doc(MOVEMENTS_COL());
        currentBatch.set(movRef, {
          productId: prodRef.id,
          productName: productData.name,
          sku: productData.sku,
          transactionType: 'INITIAL_STOCK',
          quantityChanged: productData.availableQuantity,
          previousStock: 0,
          newStock: productData.availableQuantity,
          referenceInvoice: 'INITIAL_IMPORT',
          notes: 'Initial opening stock',
          performedBy: user?.email || user?.uid || 'admin',
          createdAt: serverTimestamp(),
        });
        batchOpsCount++;
      }
    }

    // Flush batch if reaching batch size limit
    if (batchOpsCount >= BATCH_SIZE) {
      const percent = Math.round(30 + ((i + 1) / totalProducts) * 65);
      onProgress(percent, `Writing batch to database (${i + 1}/${totalProducts})...`);
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      batchOpsCount = 0;
    }
  }

  // Commit remaining ops
  if (batchOpsCount > 0) {
    onProgress(95, 'Finalizing catalog updates...');
    await currentBatch.commit();
  }

  invalidateCachePrefix('movements:');
  onProgress(100, 'Import completed successfully!');

  return {
    categoriesCreated,
    productsCreated,
    productsUpdated,
    skipped,
    totalCatalogItems: totalProducts,
  };
}

/**
 * Automatically assigns and persists matched studio imageUrl onto any Firestore
 * product documents that do not yet have a valid imageUrl.
 *
 * @param {Array<Object>} products Current product list loaded from Firestore
 * @returns {Promise<Array<{ id: string, imageUrl: string }>>} Updated product patches
 */
export async function syncMissingProductImages(products = []) {
  const missing = products.filter((p) => p?.id && !isValidProductImageUrl(p.imageUrl));
  if (missing.length === 0) return [];

  const BATCH_SIZE = 250;
  const applied = [];

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const p of chunk) {
      const imageUrl = matchProductImageByName(p);
      batch.update(doc(db, 'products', p.id), {
        imageUrl,
        updatedAt: serverTimestamp(),
      });
      applied.push({ id: p.id, imageUrl });
    }
    await batch.commit();
  }

  invalidateCachePrefix('products:');
  return applied;
}
