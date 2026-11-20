import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const CATEGORIES_COL = () => collection(db, 'categories');
const PRODUCTS_COL = () => collection(db, 'products');

export async function getAllCategories() {
  const q = query(CATEGORIES_COL(), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCategory({ name, description = '' }, userId, existingCategories = null) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Category name is required.');
  }

  const list = Array.isArray(existingCategories) ? existingCategories : await getAllCategories();
  const duplicate = list.find(
    (c) => c.name?.toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A category named "${duplicate.name}" already exists.`);
  }

  const now = new Date();
  const ref = await addDoc(CATEGORIES_COL(), {
    name: trimmedName,
    description: String(description || '').trim(),
    createdBy: userId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    name: trimmedName,
    description: String(description || '').trim(),
    createdBy: userId || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCategory(
  categoryId,
  { name, description = '' },
  existingCategories = null
) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Category name is required.');
  }

  const list = Array.isArray(existingCategories) ? existingCategories : await getAllCategories();
  const prevCat = list.find((c) => c.id === categoryId);
  const duplicate = list.find(
    (c) => c.id !== categoryId && c.name?.toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`Another category named "${duplicate.name}" already exists.`);
  }

  await updateDoc(doc(db, 'categories', categoryId), {
    name: trimmedName,
    description: String(description || '').trim(),
    updatedAt: serverTimestamp(),
  });

  // Only query/update products if the category name actually changed
  if (!prevCat || prevCat.name !== trimmedName) {
    const prodSnap = await getDocs(
      query(PRODUCTS_COL(), where('categoryId', '==', categoryId))
    );
    if (!prodSnap.empty) {
      const batch = writeBatch(db);
      prodSnap.docs.forEach((pDoc) => {
        batch.update(pDoc.ref, {
          categoryName: trimmedName,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  return {
    id: categoryId,
    name: trimmedName,
    description: String(description || '').trim(),
    updatedAt: new Date(),
  };
}

export async function deleteCategorySafely(categoryId, reassignTargetCategory = null) {
  const prodSnap = await getDocs(
    query(PRODUCTS_COL(), where('categoryId', '==', categoryId))
  );

  if (!prodSnap.empty) {
    if (!reassignTargetCategory || !reassignTargetCategory.id) {
      throw new Error(
        `Cannot delete this category because ${prodSnap.size} product(s) are assigned to it. Reassign them to another category first.`
      );
    }

    if (reassignTargetCategory.id === categoryId) {
      throw new Error('Please choose a different category for reassignment.');
    }

    const docs = prodSnap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const chunk = docs.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach((pDoc) => {
        batch.update(pDoc.ref, {
          categoryId: reassignTargetCategory.id,
          categoryName: reassignTargetCategory.name,
          updatedAt: serverTimestamp(),
        });
      });
      if (i + 450 >= docs.length) {
        batch.delete(doc(db, 'categories', categoryId));
      }
      await batch.commit();
    }
    return { reassignedCount: docs.length };
  }

  await deleteDoc(doc(db, 'categories', categoryId));
  return { reassignedCount: 0 };
}
