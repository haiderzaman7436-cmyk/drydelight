import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { isValidProductImageUrl, matchProductImageByName } from '../utils/productImages';
import { normalizeBarcode } from '../utils/barcode';
import { roundMoney } from '../utils/formatters';
import { invalidateCachePrefix } from './queryCache';

const PRODUCTS_COL = () => collection(db, 'products');
const MOVEMENTS_COL = () => collection(db, 'stockMovements');

export async function getAllProducts() {
  const q = query(PRODUCTS_COL(), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProductById(productId) {
  const snap = await getDoc(doc(db, 'products', productId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function findProductByBarcode(rawBarcode) {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return null;

  const snap = await getDocs(
    query(PRODUCTS_COL(), where('barcode', '==', barcode), limit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function assertUniqueIdentifiers({ barcode, sku, excludeProductId = null }) {
  const normalizedBarcode = normalizeBarcode(barcode);
  const normalizedSku = String(sku || '').trim().toUpperCase();

  // Run uniqueness checks in parallel instead of sequentially
  const checks = [];
  if (normalizedBarcode) {
    checks.push(
      getDocs(query(PRODUCTS_COL(), where('barcode', '==', normalizedBarcode), limit(2))).then(
        (snap) => {
          const conflict = snap.docs.find((d) => d.id !== excludeProductId);
          if (conflict) {
            throw new Error(
              `Barcode "${normalizedBarcode}" is already assigned to "${conflict.data().name}".`
            );
          }
        }
      )
    );
  }
  if (normalizedSku) {
    checks.push(
      getDocs(query(PRODUCTS_COL(), where('sku', '==', normalizedSku), limit(2))).then(
        (snap) => {
          const conflict = snap.docs.find((d) => d.id !== excludeProductId);
          if (conflict) {
            throw new Error(
              `SKU "${normalizedSku}" is already assigned to "${conflict.data().name}".`
            );
          }
        }
      )
    );
  }

  if (checks.length > 0) {
    await Promise.all(checks);
  }
}

function validateProductFields(data) {
  const name = String(data.name || '').trim();
  const sku = String(data.sku || '').trim().toUpperCase();
  const barcode = normalizeBarcode(data.barcode);
  const categoryId = String(data.categoryId || '').trim();
  const categoryName = String(data.categoryName || '').trim();
  const purchasePrice = roundMoney(data.purchasePrice);
  const sellingPrice = roundMoney(data.sellingPrice);
  const availableQuantity = Math.floor(Number(data.availableQuantity ?? 0));
  const minStockLevel = Math.floor(Number(data.minStockLevel ?? 0));
  const description = String(data.description || '').trim();
  const rawImageUrl = String(data.imageUrl || '').trim();

  if (rawImageUrl && !isValidProductImageUrl(rawImageUrl)) {
    throw new Error('Please provide a valid image URL or choose a studio image.');
  }

  const imageUrl = rawImageUrl || matchProductImageByName({ name, categoryName });

  if (!name) throw new Error('Product name is required.');
  if (!sku) throw new Error('Product SKU / Code is required.');
  if (!categoryId) throw new Error('Category is required.');
  if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
    throw new Error('Purchase price must be 0 or greater.');
  }
  if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
    throw new Error('Selling price must be 0 or greater.');
  }
  if (Number.isNaN(availableQuantity) || availableQuantity < 0) {
    throw new Error('Available quantity cannot be negative.');
  }
  if (Number.isNaN(minStockLevel) || minStockLevel < 0) {
    throw new Error('Minimum stock level cannot be negative.');
  }

  return {
    name,
    sku,
    barcode,
    categoryId,
    categoryName,
    purchasePrice,
    sellingPrice,
    availableQuantity,
    minStockLevel,
    description,
    imageUrl,
  };
}

export async function createProduct(data, user) {
  const validated = validateProductFields(data);
  await assertUniqueIdentifiers({
    barcode: validated.barcode,
    sku: validated.sku,
  });

  // Use a single atomic writeBatch (1 network round-trip) instead of a read-write transaction
  const productRef = doc(PRODUCTS_COL());
  const batch = writeBatch(db);
  const now = new Date();

  batch.set(productRef, {
    ...validated,
    createdBy: user?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (validated.availableQuantity > 0) {
    const movementRef = doc(MOVEMENTS_COL());
    batch.set(movementRef, {
      productId: productRef.id,
      productName: validated.name,
      sku: validated.sku,
      transactionType: 'INITIAL_STOCK',
      quantityChanged: validated.availableQuantity,
      previousStock: 0,
      newStock: validated.availableQuantity,
      referenceInvoice: 'INITIAL',
      notes: 'Initial opening stock',
      performedBy: user?.email || user?.uid || 'system',
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
  invalidateCachePrefix('movements:');

  return {
    id: productRef.id,
    ...validated,
    createdBy: user?.uid || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateProduct(productId, data, user, previousProduct = null) {
  const validated = validateProductFields(data);

  // Skip remote uniqueness checks if barcode & SKU did not change
  const barcodeChanged = !previousProduct || previousProduct.barcode !== validated.barcode;
  const skuChanged = !previousProduct || previousProduct.sku !== validated.sku;
  if (barcodeChanged || skuChanged) {
    await assertUniqueIdentifiers({
      barcode: barcodeChanged ? validated.barcode : '',
      sku: skuChanged ? validated.sku : '',
      excludeProductId: productId,
    });
  }

  const productRef = doc(db, 'products', productId);
  const stockChanged =
    !previousProduct ||
    Number(previousProduct.availableQuantity || 0) !== validated.availableQuantity;

  if (!stockChanged) {
    // Fast single write when stock wasn't changed
    const batch = writeBatch(db);
    batch.update(productRef, {
      ...validated,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } else {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(productRef);
      if (!snap.exists()) {
        throw new Error('Product no longer exists.');
      }

      const prev = snap.data();
      const previousStock = Number(prev.availableQuantity || 0);
      const stockDiff = validated.availableQuantity - previousStock;

      transaction.update(productRef, {
        ...validated,
        updatedAt: serverTimestamp(),
      });

      if (stockDiff !== 0) {
        const movementRef = doc(MOVEMENTS_COL());
        transaction.set(movementRef, {
          productId,
          productName: validated.name,
          sku: validated.sku,
          transactionType: 'MANUAL_ADJUSTMENT',
          quantityChanged: stockDiff,
          previousStock,
          newStock: validated.availableQuantity,
          referenceInvoice: 'PRODUCT_EDIT',
          notes: 'Stock updated from Product Management',
          performedBy: user?.email || user?.uid || 'system',
          createdAt: serverTimestamp(),
        });
      }
    });
    invalidateCachePrefix('movements:');
  }

  return {
    ...(previousProduct || {}),
    id: productId,
    ...validated,
    updatedAt: new Date(),
  };
}

export async function adjustProductStock(
  { productId, delta, reason = '', reference = 'ADJUSTMENT' },
  user
) {
  const qtyDelta = Math.floor(Number(delta) || 0);
  if (qtyDelta === 0) {
    throw new Error('Stock adjustment quantity cannot be 0.');
  }

  const productRef = doc(db, 'products', productId);

  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(productRef);
    if (!snap.exists()) {
      throw new Error('Product not found.');
    }
    const product = snap.data();
    const previousStock = Number(product.availableQuantity || 0);
    const newStock = previousStock + qtyDelta;

    if (newStock < 0) {
      throw new Error(
        `Cannot reduce stock below 0. Current available stock is ${previousStock}.`
      );
    }

    transaction.update(productRef, {
      availableQuantity: newStock,
      updatedAt: serverTimestamp(),
    });

    const movementRef = doc(MOVEMENTS_COL());
    transaction.set(movementRef, {
      productId,
      productName: product.name,
      sku: product.sku || '',
      transactionType: qtyDelta > 0 ? 'RESTOCK' : 'STOCK_DEDUCTION',
      quantityChanged: qtyDelta,
      previousStock,
      newStock,
      referenceInvoice: reference,
      notes: String(reason || '').trim() || (qtyDelta > 0 ? 'Manual restock' : 'Manual deduction'),
      performedBy: user?.email || user?.uid || 'system',
      createdAt: serverTimestamp(),
    });

    return { previousStock, newStock };
  });

  invalidateCachePrefix('movements:');
  return result;
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, 'products', productId));
}
