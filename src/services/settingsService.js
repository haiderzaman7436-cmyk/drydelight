import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { hashProfitPin } from '../utils/profitLock';

export const DEFAULT_SETTINGS = {
  businessName: 'Dry Delight',
  businessAddress: 'Main Commercial Market, City',
  contactNumber: '+92 300 0000000',
  invoiceHeader: 'Dry Delight — Quality Products & Trusted Service',
  invoiceFooter: 'Thank you for shopping at Dry Delight! Goods once sold can be returned with original receipt.',
  currency: 'PKR',
  defaultMinStockLevel: 5,
  printerMode: 'browser', // 'browser' | 'qz_tray' | 'serial'
  printerName: '',
  serialBaudRate: 9600,
  paperWidth: '80mm', // '80mm' | '58mm'
  paperWidthExplicit: false,
  autoPrintAfterSale: true,
  showBarcodeOnReceipt: false,
  profitLockEnabled: true,
  profitLockPinHash: '',
  profitLockPinCustomized: false,
};

const SETTINGS_DOC_REF = () => doc(db, 'settings', 'storeConfig');

export function normalizeBrandSettings(raw = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  if (!merged.businessName || merged.businessName === 'My Retail Store') {
    merged.businessName = 'Dry Delight';
  }
  if (merged.invoiceHeader === 'Quality Products & Trusted Service') {
    merged.invoiceHeader = DEFAULT_SETTINGS.invoiceHeader;
  }
  if (
    merged.invoiceFooter ===
    'Thank you for shopping with us! Goods once sold can be returned with original receipt.'
  ) {
    merged.invoiceFooter = DEFAULT_SETTINGS.invoiceFooter;
  }
  // Upgrade legacy default 58mm receipts to 80mm unless explicitly saved by admin
  if (!raw?.paperWidthExplicit) {
    merged.paperWidth = '80mm';
  } else {
    merged.paperWidth = merged.paperWidth === '58mm' ? '58mm' : '80mm';
  }
  if (typeof raw?.profitLockEnabled !== 'boolean') {
    merged.profitLockEnabled = true;
  }
  return merged;
}

export async function getStoreSettings() {
  const snap = await getDoc(SETTINGS_DOC_REF());
  if (!snap.exists()) {
    return { ...DEFAULT_SETTINGS };
  }
  return normalizeBrandSettings(snap.data());
}

export async function saveStoreSettings(settingsData, userId) {
  let profitLockPinHash = String(settingsData.profitLockPinHash || '');
  let profitLockPinCustomized = Boolean(settingsData.profitLockPinCustomized);

  const incomingPin = String(settingsData.newProfitPin || '').trim();
  if (incomingPin) {
    if (incomingPin.length < 4) {
      throw new Error('Profit Lock PIN must be at least 4 characters or digits.');
    }
    profitLockPinHash = hashProfitPin(incomingPin);
    profitLockPinCustomized = true;
  }

  const payload = {
    businessName: String(settingsData.businessName || DEFAULT_SETTINGS.businessName).trim(),
    businessAddress: String(settingsData.businessAddress || '').trim(),
    contactNumber: String(settingsData.contactNumber || '').trim(),
    invoiceHeader: String(settingsData.invoiceHeader || '').trim(),
    invoiceFooter: String(settingsData.invoiceFooter || DEFAULT_SETTINGS.invoiceFooter).trim(),
    currency: String(settingsData.currency || 'PKR').trim().toUpperCase(),
    defaultMinStockLevel: Math.max(0, Math.floor(Number(settingsData.defaultMinStockLevel) || 0)),
    printerMode: ['qz_tray', 'serial'].includes(settingsData.printerMode)
      ? settingsData.printerMode
      : 'browser',
    printerName: String(settingsData.printerName || '').trim(),
    serialBaudRate: [9600, 19200, 38400, 57600, 115200].includes(Number(settingsData.serialBaudRate))
      ? Number(settingsData.serialBaudRate)
      : 9600,
    paperWidth: settingsData.paperWidth === '58mm' ? '58mm' : '80mm',
    paperWidthExplicit: true,
    autoPrintAfterSale: Boolean(settingsData.autoPrintAfterSale),
    showBarcodeOnReceipt: Boolean(settingsData.showBarcodeOnReceipt),
    profitLockEnabled: Boolean(settingsData.profitLockEnabled),
    profitLockPinHash,
    profitLockPinCustomized,
    updatedBy: userId || null,
    updatedAt: serverTimestamp(),
  };

  await setDoc(SETTINGS_DOC_REF(), payload, { merge: true });
  const { updatedAt: _ignoredTs, ...cleanPayload } = payload;
  return normalizeBrandSettings(cleanPayload);
}
