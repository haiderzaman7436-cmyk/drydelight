/**
 * Barcode generation and validation utilities.
 * Generates valid EAN-13 barcodes with proper GS1 check digit for products without existing barcodes.
 */

export function normalizeBarcode(raw) {
  if (raw == null) return '';
  return String(raw).trim();
}

export function calculateEan13CheckDigit(twelveDigits) {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error('EAN-13 base must be exactly 12 numeric digits');
  }
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

export function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  const expected = calculateEan13CheckDigit(code.slice(0, 12));
  return Number(code[12]) === expected;
}

/**
 * Generates an internal in-store EAN-13 barcode (prefix "20" is reserved by GS1 for in-store use).
 */
export function generateInternalBarcode() {
  const prefix = '20';
  const timestampPart = String(Date.now()).slice(-7);
  const randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const base12 = `${prefix}${timestampPart}${randomPart}`;
  const check = calculateEan13CheckDigit(base12);
  return `${base12}${check}`;
}

export function generateSku(name = '') {
  const clean = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(3, 'X');
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${clean}-${suffix}`;
}
