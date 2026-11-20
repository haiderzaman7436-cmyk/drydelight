import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { cachedQuery } from './queryCache';

const MOVEMENTS_COL = () => collection(db, 'stockMovements');

export async function getRecentStockMovements(maxCount = 150) {
  return cachedQuery(`movements:recent:${maxCount}`, async () => {
    const q = query(MOVEMENTS_COL(), orderBy('createdAt', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

export async function getStockMovementsByProduct(productId, maxCount = 50) {
  return cachedQuery(`movements:product:${productId}:${maxCount}`, async () => {
    const q = query(
      MOVEMENTS_COL(),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}
