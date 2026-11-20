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
import { validateAndBuildReturn } from '../utils/calculations';
import { toLocalDateKey, toLocalMonthKey } from '../utils/formatters';
import { cachedQuery, invalidateCachePrefix } from './queryCache';

const RETURNS_COL = () => collection(db, 'salesReturns');
const MOVEMENTS_COL = () => collection(db, 'stockMovements');

function buildReturnNumber(seq, dateKey) {
  const compactDate = dateKey.replace(/-/g, '');
  return `RET-${compactDate}-${String(seq).padStart(4, '0')}`;
}

export async function createSalesReturn(
  { originalSaleId, requestedReturns, reason = '', clientRequestId },
  user
) {
  const now = new Date();
  const returnDate = toLocalDateKey(now);
  const returnMonth = toLocalMonthKey(now);

  const saleRef = doc(db, 'sales', originalSaleId);
  const returnRef = clientRequestId
    ? doc(db, 'salesReturns', clientRequestId)
    : doc(RETURNS_COL());
  const counterRef = doc(db, 'counters', `return_${returnDate}`);

  const result = await runTransaction(db, async (transaction) => {
    const [existingReturnSnap, saleSnap, counterSnap] = await Promise.all([
      transaction.get(returnRef),
      transaction.get(saleRef),
      transaction.get(counterRef),
    ]);

    if (existingReturnSnap.exists()) {
      return {
        returnDoc: { id: existingReturnSnap.id, ...existingReturnSnap.data() },
        updatedSale: saleSnap.exists() ? { id: saleSnap.id, ...saleSnap.data() } : null,
        stockUpdates: [],
        alreadyProcessed: true,
      };
    }

    if (!saleSnap.exists()) {
      throw new Error('Original sale invoice no longer exists.');
    }

    const originalSale = { id: saleSnap.id, ...saleSnap.data() };
    const validated = validateAndBuildReturn({ originalSale, requestedReturns });

    const productSnaps = await Promise.all(
      validated.returnedItems.map((item) => transaction.get(doc(db, 'products', item.productId)))
    );

    const nextSeq = counterSnap.exists() ? Number(counterSnap.data().current || 0) + 1 : 1;
    const returnInvoiceNumber = buildReturnNumber(nextSeq, returnDate);

    const returnPayload = {
      returnInvoiceNumber,
      originalSaleId: originalSale.id,
      originalInvoiceNumber: originalSale.invoiceNumber,
      customerName: originalSale.customerName || 'Walk-in Customer',
      returnDate,
      returnMonth,
      items: validated.returnedItems,
      totalReturnedQty: validated.totalReturnedQty,
      totalReturnAmount: validated.totalReturnAmount,
      totalReturnCost: validated.totalReturnCost,
      totalReturnProfit: validated.totalReturnProfit,
      reason: String(reason || '').trim(),
      createdBy: user?.uid || null,
      createdByEmail: user?.email || '',
      createdAt: serverTimestamp(),
    };

    transaction.set(
      counterRef,
      { current: nextSeq, updatedAt: serverTimestamp() },
      { merge: true }
    );

    transaction.set(returnRef, returnPayload);

    const salePatch = {
      items: validated.updatedOriginalItems,
      returnStatus: validated.returnStatus,
      totalReturnedAmount: validated.newSaleTotalReturnedAmount,
      updatedAt: serverTimestamp(),
    };
    transaction.update(saleRef, salePatch);

    const stockUpdates = [];

    for (let i = 0; i < validated.returnedItems.length; i += 1) {
      const retItem = validated.returnedItems[i];
      const pSnap = productSnaps[i];
      if (!pSnap.exists()) continue;

      const prod = pSnap.data();
      const previousStock = Number(prod.availableQuantity || 0);
      const newStock = previousStock + retItem.returnQuantity;

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
        transactionType: 'SALE_RETURN',
        quantityChanged: retItem.returnQuantity,
        previousStock,
        newStock,
        referenceInvoice: returnInvoiceNumber,
        notes: `Returned from ${originalSale.invoiceNumber}${reason ? ` — ${reason}` : ''}`,
        performedBy: user?.email || user?.uid || 'system',
        createdAt: serverTimestamp(),
      });
    }

    return {
      returnDoc: { id: returnRef.id, ...returnPayload, createdAt: now },
      updatedSale: { ...originalSale, ...salePatch, updatedAt: now },
      stockUpdates,
    };
  });

  invalidateCachePrefix('returns:');
  invalidateCachePrefix('sales:');
  invalidateCachePrefix('movements:');
  return result;
}

export async function getRecentReturns(maxCount = 200) {
  return cachedQuery(`returns:recent:${maxCount}`, async () => {
    const q = query(RETURNS_COL(), orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function getReturnsByDate(dateKey) {
  return cachedQuery(`returns:date:${dateKey}`, async () => {
    const q = query(
      RETURNS_COL(),
      where('returnDate', '==', dateKey),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function getReturnsByMonth(monthKey) {
  return cachedQuery(`returns:month:${monthKey}`, async () => {
    const q = query(
      RETURNS_COL(),
      where('returnMonth', '==', monthKey),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function getReturnsByDateRange(startDateKey, endDateKey) {
  return cachedQuery(`returns:range:${startDateKey}:${endDateKey}`, async () => {
    const q = query(
      RETURNS_COL(),
      where('returnDate', '>=', startDateKey),
      where('returnDate', '<=', endDateKey),
      orderBy('returnDate', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  });
}

export async function getReturnsForSale(originalSaleId) {
  return cachedQuery(`returns:sale:${originalSaleId}`, async () => {
    const q = query(
      RETURNS_COL(),
      where('originalSaleId', '==', originalSaleId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}
