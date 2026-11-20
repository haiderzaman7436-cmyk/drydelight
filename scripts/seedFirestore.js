import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

// Read .env if present
const envPath = path.resolve('.env');
const env = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const catalogPath = path.resolve('src/data/scrapedCatalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

async function seed() {
  console.log(`Starting Firestore catalog seeder for ${catalog.products.length} products...`);

  // Optional: Sign in if credentials are provided in arguments or env
  const adminEmail = process.env.ADMIN_EMAIL || process.argv[2];
  const adminPassword = process.env.ADMIN_PASSWORD || process.argv[3];

  let user = null;
  if (adminEmail && adminPassword) {
    console.log(`Authenticating as ${adminEmail}...`);
    const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    user = cred.user;
    console.log(`Authenticated UID: ${user.uid}`);
  } else {
    console.log('Running without explicit CLI credentials (ensure firestore.rules permit writes or provide email/pwd as arguments: node scripts/seedFirestore.js <email> <pwd>)');
  }

  const CATEGORIES_COL = collection(db, 'categories');
  const PRODUCTS_COL = collection(db, 'products');
  const MOVEMENTS_COL = collection(db, 'stockMovements');

  console.log('Fetching existing categories and products...');
  const [existingCatsSnap, existingProdsSnap] = await Promise.all([
    getDocs(CATEGORIES_COL),
    getDocs(PRODUCTS_COL),
  ]);

  const existingCategories = existingCatsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingProducts = existingProdsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  console.log(`Existing in Firestore: ${existingCategories.length} categories, ${existingProducts.length} products`);

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

  // 1. Categories
  const resolvedCategoryMap = new Map();
  const catBatch = writeBatch(db);
  let catsCreated = 0;

  for (const cat of catalog.categories) {
    const existing = categoryByName.get(cat.name.trim().toLowerCase());
    if (existing) {
      resolvedCategoryMap.set(cat.id, existing);
    } else {
      const ref = doc(CATEGORIES_COL);
      const catData = {
        name: cat.name.trim(),
        description: cat.description || '',
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      catBatch.set(ref, catData);
      resolvedCategoryMap.set(cat.id, { id: ref.id, ...catData });
      catsCreated++;
    }
  }

  if (catsCreated > 0) {
    console.log(`Creating ${catsCreated} new categories...`);
    await catBatch.commit();
  }

  // 2. Products
  const BATCH_SIZE = 150;
  let batch = writeBatch(db);
  let batchCount = 0;
  let prodsCreated = 0;
  let skipped = 0;

  for (let i = 0; i < catalog.products.length; i++) {
    const item = catalog.products[i];
    const cat = resolvedCategoryMap.get(item.categoryId);
    const categoryId = cat?.id || item.categoryId;
    const categoryName = cat?.name || item.categoryName;

    const existing =
      productByBarcode.get(item.barcode) ||
      productBySku.get(item.sku.toUpperCase()) ||
      productByName.get(item.name.trim().toLowerCase());

    if (existing) {
      skipped++;
      continue;
    }

    const prodRef = doc(PRODUCTS_COL);
    batch.set(prodRef, {
      name: item.name.trim(),
      sku: item.sku.trim().toUpperCase(),
      barcode: item.barcode.trim(),
      categoryId,
      categoryName,
      purchasePrice: Number(item.purchasePrice) || 0,
      sellingPrice: Number(item.sellingPrice) || 0,
      availableQuantity: Math.max(0, Number(item.availableQuantity) || 0),
      minStockLevel: Math.max(0, Number(item.minStockLevel) || 5),
      description: '',
      createdBy: user?.uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batchCount++;
    prodsCreated++;

    if (item.availableQuantity > 0) {
      const movRef = doc(MOVEMENTS_COL);
      batch.set(movRef, {
        productId: prodRef.id,
        productName: item.name.trim(),
        sku: item.sku.trim().toUpperCase(),
        transactionType: 'INITIAL_STOCK',
        quantityChanged: item.availableQuantity,
        previousStock: 0,
        newStock: item.availableQuantity,
        referenceInvoice: 'INITIAL_IMPORT',
        notes: 'Initial opening stock',
        performedBy: user?.email || user?.uid || 'admin',
        createdAt: serverTimestamp(),
      });
      batchCount++;
    }

    if (batchCount >= BATCH_SIZE) {
      console.log(`Committing batch at ${i + 1}/${catalog.products.length}...`);
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    console.log('Committing final batch...');
    await batch.commit();
  }

  console.log(`\n--- Seeding Complete ---`);
  console.log(`Categories Created: ${catsCreated}`);
  console.log(`Products Created: ${prodsCreated}`);
  console.log(`Products Skipped (already exist): ${skipped}`);
  console.log(`Total Scraped Catalog Items: ${catalog.products.length}`);
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
