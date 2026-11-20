import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  calculateSaleTotals,
  computeSaleEditDeltas,
  computeSaleDeleteRestorations,
} from '../utils/calculations';
import { toLocalDateKey, toLocalMonthKey } from '../utils/formatters';
import { cachedQuery, invalidateCachePrefix } from './queryCache';

const SALES_COL = () => collection(db, 'sales');
const MOVEMENTS_COL = () => collection(db, 'stockMovements');
const AUDIT_COL = () => collection(db, 'auditLogs');

function buildInvoiceNumber(seq, dateKey) {
  const compactDate = dateKey.replace(/-/g, '');
  return `INV-${compactDate}-${String(seq).padStart(4, '0')}`;
}

export async function createSale(
  {
    items,
    customerName = 'Walk-in Customer',
    paidAmount,
    notes = '',
    clientRequestId,
  },
  user
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cannot create an empty sale. Add at least one product to the cart.');
  }

  const mergedItemsMap = new Map();
  for (const item of items) {
    const qty = Math.floor(Number(item.quantity) || 0);
    if (qty <= 0) {
      throw new Error(`Invalid quantity for "${item.productName || item.productId}".`);
    }
    const existing = mergedItemsMap.get(item.productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      mergedItemsMap.set(item.productId, { ...item, quantity: qty });
    }
  }
  const mergedItems = Array.from(mergedItemsMap.values());

  const now = new Date();
  const saleDate = toLocalDateKey(now);
  const saleMonth = toLocalMonthKey(now);
  const saleRef = clientRequestId ? doc(db, 'sales', clientRequestId) : doc(SALES_COL());
  const counterRef = doc(db, 'counters', `invoice_${saleDate}`);

  const result = await runTransaction(db, async (transaction) => {
    const [existingSaleSnap, counterSnap, ...productSnaps] = await Promise.all([
      transaction.get(saleRef),
      transaction.get(counterRef),
      ...mergedItems.map((item) => transaction.get(doc(db, 'products', item.productId))),
    ]);

    if (existingSaleSnap.exists()) {
      return { id: existingSaleSnap.id, ...existingSaleSnap.data(), alreadyProcessed: true };
    }

    const verifiedItems = [];
    const stockUpdates = [];

    for (let i = 0; i < mergedItems.length; i += 1) {
      const requested = mergedItems[i];
      const pSnap = productSnaps[i];
      if (!pSnap.exists()) {
        throw new Error(`Product "${requested.productName || requested.productId}" no longer exists.`);
      }
      const productData = pSnap.data();
      const currentStock = Number(productData.availableQuantity || 0);
      if (requested.quantity > currentStock) {
        throw new Error(
          `Insufficient stock for "${productData.name}". Available: ${currentStock}, Requested: ${requested.quantity}.`
        );
      }

      const unitPrice = Number(productData.sellingPrice ?? requested.unitPrice ?? 0);
      const purchasePrice = Number(productData.purchasePrice ?? 0);

      verifiedItems.push({
        productId: pSnap.id,
        productName: productData.name,
        sku: productData.sku || '',
        barcode: productData.barcode || '',
        quantity: requested.quantity,
        returnedQuantity: 0,
        unitPrice,
        purchasePrice,
      });

      stockUpdates.push({
        ref: pSnap.ref,
        productId: pSnap.id,
        productName: productData.name,
        sku: productData.sku || '',
        previousStock: currentStock,
        newStock: currentStock - requested.quantity,
        quantityChanged: -requested.quantity,
      });
    }

    const totals = calculateSaleTotals({
      items: verifiedItems,
      paidAmount,
    });

    const nextSeq = counterSnap.exists() ? Number(counterSnap.data().current || 0) + 1 : 1;
    const invoiceNumber = buildInvoiceNumber(nextSeq, saleDate);
    const cleanCustomer = String(customerName || '').trim() || 'Walk-in Customer';

    const salePayload = {
      invoiceNumber,
      customerName: cleanCustomer,
      customerNameLower: cleanCustomer.toLowerCase(),
      saleDate,
      saleMonth,
      items: totals.items,
      totalItems: totals.totalItems,
      subtotal: totals.subtotal,
      totalCost: totals.totalCost,
      grossProfit: totals.grossProfit,
      grandTotal: totals.grandTotal,
      paidAmount: totals.paidAmount,
      remainingAmount: totals.remainingAmount,
      changeAmount: totals.changeAmount,
      paymentStatus: totals.paymentStatus,
      paymentMethod: 'cash',
      returnStatus: 'none',
      totalReturnedAmount: 0,
      notes: String(notes || '').trim(),
      createdBy: user?.uid || null,
      createdByEmail: user?.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(
      counterRef,
      { current: nextSeq, updatedAt: serverTimestamp() },
      { merge: true }
    );

    transaction.set(saleRef, salePayload);

    for (const upd of stockUpdates) {
      transaction.update(upd.ref, {
        availableQuantity: upd.newStock,
        updatedAt: serverTimestamp(),
      });

      const movementRef = doc(MOVEMENTS_COL());
      transaction.set(movementRef, {
        productId: upd.productId,
        productName: upd.productName,
        sku: upd.sku,
        transactionType: 'SALE',
        quantityChanged: upd.quantityChanged,
        previousStock: upd.previousStock,
        newStock: upd.newStock,
        referenceInvoice: invoiceNumber,
        notes: `Sold to ${cleanCustomer}`,
        performedBy: user?.email || user?.uid || 'system',
        createdAt: serverTimestamp(),
      });
    }

    return {
      id: saleRef.id,
      ...salePayload,
      createdAt: now,
      stockUpdates: stockUpdates.map((u) => ({
        productId: u.productId,
        newStock: u.newStock,
      })),
    };
  });

  invalidateCachePrefix('sales:');
  invalidateCachePrefix('movements:');
  return result;
}

export async function updateSale(
  saleId,
  { items, customerName, paidAmount, notes = '', editReason = '' },
  user
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Sale must have at least one item.');
  }

  const saleRef = doc(db, 'sales', saleId);

  const result = await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) {
      throw new Error('Sale record not found.');
    }
    const originalSale = { id: saleSnap.id, ...saleSnap.data() };

    const allProductIds = Array.from(
      new Set([
        ...(originalSale.items || []).map((i) => i.productId),
        ...items.map((i) => i.productId),
      ])
    );

    const productSnaps = await Promise.all(
      allProductIds.map((pid) => transaction.get(doc(db, 'products', pid)))
    );

    const productMap = new Map();
    const stockMap = {};
    for (let i = 0; i < allProductIds.length; i += 1) {
      const pSnap = productSnaps[i];
      if (pSnap.exists()) {
        const data = pSnap.data();
        productMap.set(pSnap.id, { ref: pSnap.ref, data });
        stockMap[pSnap.id] = Number(data.availableQuantity || 0);
      } else {
        stockMap[allProductIds[i]] = 0;
      }
    }

    const originalItemByPid = new Map(
      (originalSale.items || []).map((it) => [it.productId, it])
    );

    const normalizedUpdatedItems = items.map((item) => {
      const orig = originalItemByPid.get(item.productId);
      const prod = productMap.get(item.productId)?.data;
      return {
        productId: item.productId,
        productName: item.productName || orig?.productName || prod?.name || 'Product',
        sku: item.sku || orig?.sku || prod?.sku || '',
        barcode: item.barcode || orig?.barcode || prod?.barcode || '',
        quantity: Math.floor(Number(item.quantity) || 0),
        returnedQuantity: Number(orig?.returnedQuantity || 0),
        unitPrice: Number(item.unitPrice ?? orig?.unitPrice ?? prod?.sellingPrice ?? 0),
        purchasePrice: Number(orig?.purchasePrice ?? prod?.purchasePrice ?? 0),
      };
    });

    const deltas = computeSaleEditDeltas(
      originalSale.items || [],
      normalizedUpdatedItems,
      stockMap
    );

    const totals = calculateSaleTotals({
      items: normalizedUpdatedItems,
      paidAmount,
    });

    const cleanCustomer =
      String(customerName || originalSale.customerName || 'Walk-in Customer').trim() ||
      'Walk-in Customer';

    const allReturned = totals.items.every(
      (i) => Number(i.returnedQuantity || 0) >= Number(i.quantity || 0)
    );
    const anyReturned = totals.items.some((i) => Number(i.returnedQuantity || 0) > 0);
    const returnStatus = allReturned ? 'full' : anyReturned ? 'partial' : 'none';

    const updatedPayload = {
      customerName: cleanCustomer,
      customerNameLower: cleanCustomer.toLowerCase(),
      items: totals.items,
      totalItems: totals.totalItems,
      subtotal: totals.subtotal,
      totalCost: totals.totalCost,
      grossProfit: totals.grossProfit,
      grandTotal: totals.grandTotal,
      paidAmount: totals.paidAmount,
      remainingAmount: totals.remainingAmount,
      changeAmount: totals.changeAmount,
      paymentStatus: totals.paymentStatus,
      returnStatus,
      notes: String(notes ?? originalSale.notes ?? '').trim(),
      lastEditedBy: user?.email || user?.uid || 'system',
      lastEditedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.update(saleRef, updatedPayload);

    for (const d of deltas) {
      const prodEntry = productMap.get(d.productId);
      if (!prodEntry) continue;

      transaction.update(prodEntry.ref, {
        availableQuantity: d.newStock,
        updatedAt: serverTimestamp(),
      });

      const movementRef = doc(MOVEMENTS_COL());
      transaction.set(movementRef, {
        productId: d.productId,
        productName: prodEntry.data.name,
        sku: prodEntry.data.sku || '',
        transactionType: 'SALE_EDIT',
        quantityChanged: d.stockDelta,
        previousStock: d.previousStock,
        newStock: d.newStock,
        referenceInvoice: originalSale.invoiceNumber,
        notes: editReason ? `Sale edited: ${editReason}` : 'Sale invoice edited',
        performedBy: user?.email || user?.uid || 'system',
        createdAt: serverTimestamp(),
      });
    }

    const auditRef = doc(AUDIT_COL());
    transaction.set(auditRef, {
      action: 'SALE_EDITED',
      entityType: 'sale',
      entityId: saleId,
      referenceInvoice: originalSale.invoiceNumber,
      reason: String(editReason || '').trim() || 'Invoice updated',
      previousTotal: originalSale.grandTotal,
      newTotal: totals.grandTotal,
      previousItems: originalSale.items,
      newItems: totals.items,
      performedBy: user?.email || user?.uid || 'system',
      createdAt: serverTimestamp(),
    });

    return {
      sale: { ...originalSale, ...updatedPayload, updatedAt: new Date() },
      stockUpdates: deltas.map((d) => ({ productId: d.productId, newStock: d.newStock })),
    };
  });

  invalidateCachePrefix('sales:');
  invalidateCachePrefix('movements:');
  return result;
}

export async function deleteSale(saleId, reason = '', user) {
  const saleRef = doc(db, 'sales', saleId);

  const result = await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) {
      throw new Error('Sale record no longer exists.');
    }

    const saleData = { id: saleSnap.id, ...saleSnap.data() };
    const restorations = computeSaleDeleteRestorations(saleData.items || []);

    const productSnaps = await Promise.all(
      restorations.map((r) => transaction.get(doc(db, 'products', r.productId)))
    );

    const stockUpdates = [];

    for (let i = 0; i < restorations.length; i += 1) {
      const rest = restorations[i];
      const pSnap = productSnaps[i];
      if (!pSnap.exists()) continue;

      const prod = pSnap.data();
      const previousStock = Number(prod.availableQuantity || 0);
      const newStock = previousStock + rest.quantityToRestore;

      transaction.update(pSnap.ref, {
        availableQuantity: newStock,
        updatedAt: serverTimestamp(),
      });

      stockUpdates.push({ productId: pSnap.id, newStock });

      const movementRef = doc(MOVEMENTS_COL());
      transaction.set(movementRef, {
        productId: pSnap.id,
        productName: prod.name,
        sku: prod.sku || '',
        transactionType: 'SALE_DELETE',
        quantityChanged: rest.quantityToRestore,
        previousStock,
        newStock,
        referenceInvoice: saleData.invoiceNumber,
        notes: reason ? `Sale deleted: ${reason}` : 'Sale deleted — stock restored',
        performedBy: user?.email || user?.uid || 'system',
        createdAt: serverTimestamp(),
      });
    }

    const auditRef = doc(AUDIT_COL());
    transaction.set(auditRef, {
      action: 'SALE_DELETED',
      entityType: 'sale',
      entityId: saleId,
      referenceInvoice: saleData.invoiceNumber,
      reason: String(reason || '').trim() || 'Invoice deleted',
      deletedSnapshot: {
        invoiceNumber: saleData.invoiceNumber,
        customerName: saleData.customerName,
        saleDate: saleData.saleDate,
        grandTotal: saleData.grandTotal,
        totalReturnedAmount: saleData.totalReturnedAmount || 0,
        items: saleData.items || [],
      },
      performedBy: user?.email || user?.uid || 'system',
      createdAt: serverTimestamp(),
    });

    transaction.delete(saleRef);

    return {
      invoiceNumber: saleData.invoiceNumber,
      restoredItems: restorations.length,
      stockUpdates,
    };
  });

  invalidateCachePrefix('sales:');
  invalidateCachePrefix('movements:');
  return result;
}

export async function getSaleByInvoiceNumber(invoiceNumber) {
  const clean = String(invoiceNumber || '').trim().toUpperCase();
  if (!clean) return null;
  const snap = await getDocs(
    query(SALES_COL(), where('invoiceNumber', '==', clean), limit(1))
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getRecentSales(maxCount = 200) {
  return cachedQuery(`sales:recent:${maxCount}`, async () => {
    const q = query(SALES_COL(), orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function getSalesByDate(dateKey) {
  return cachedQuery(`sales:date:${dateKey}`, async () => {
    const q = query(
      SALES_COL(),
      where('saleDate', '==', dateKey),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function getSalesByMonth(monthKey) {
  return cachedQuery(`sales:month:${monthKey}`, async () => {
    const q = query(
      SALES_COL(),
      where('saleMonth', '==', monthKey),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function getSalesByDateRange(startDateKey, endDateKey) {
  return cachedQuery(`sales:range:${startDateKey}:${endDateKey}`, async () => {
    const q = query(
      SALES_COL(),
      where('saleDate', '>=', startDateKey),
      where('saleDate', '<=', endDateKey),
      orderBy('saleDate', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  });
}

export async function getSaleAuditLogs(saleId) {
  const q = query(AUDIT_COL(), where('entityId', '==', saleId), limit(20));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}
