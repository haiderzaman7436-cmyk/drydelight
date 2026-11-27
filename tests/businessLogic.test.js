import { describe, it, expect } from 'vitest';
import {
  calculateSaleTotals,
  computeSaleEditDeltas,
  computeSaleDeleteRestorations,
  validateAndBuildReturn,
  aggregatePeriodSummary,
} from '../src/utils/calculations';
import {
  generateInternalBarcode,
  isValidEan13,
  calculateEan13CheckDigit,
} from '../src/utils/barcode';
import { shiftDateKey, toLocalMonthKey } from '../src/utils/formatters';
import { buildEscPosReceipt, padRow, wrapText } from '../src/utils/escpos';
import { DEFAULT_PROFIT_PIN, hashProfitPin, verifyProfitPin } from '../src/utils/profitLock';
import { DEFAULT_SETTINGS, normalizeBrandSettings } from '../src/services/settingsService';
import {
  getProductImage,
  isValidProductImageUrl,
  matchProductImageByName,
} from '../src/utils/productImages';

describe('Sales Calculation & Payment Integrity', () => {
  it('calculates subtotal, grand total, paid, remaining, and change accurately', () => {
    const res = calculateSaleTotals({
      items: [
        { productId: 'p1', productName: 'Tea 1kg', quantity: 2, unitPrice: 1200, purchasePrice: 900 },
        { productId: 'p2', productName: 'Sugar 1kg', quantity: 3, unitPrice: 150, purchasePrice: 120 },
      ],
      paidAmount: 2000,
    });

    expect(res.subtotal).toBe(2850);
    expect(res.totalCost).toBe(2160);
    expect(res.grossProfit).toBe(690);
    expect(res.grandTotal).toBe(2850);
    expect(res.paidAmount).toBe(2000);
    expect(res.remainingAmount).toBe(850);
    expect(res.changeAmount).toBe(0);
    expect(res.paymentStatus).toBe('partial');
  });

  it('computes change when overpaid', () => {
    const res = calculateSaleTotals({
      items: [{ productId: 'p1', productName: 'Water', quantity: 1, unitPrice: 100 }],
      paidAmount: 500,
    });

    expect(res.grandTotal).toBe(100);
    expect(res.remainingAmount).toBe(0);
    expect(res.changeAmount).toBe(400);
    expect(res.paymentStatus).toBe('paid');
  });

  it('defaults paidAmount to grandTotal when omitted', () => {
    const res = calculateSaleTotals({
      items: [{ productId: 'p1', productName: 'Juice', quantity: 2, unitPrice: 250 }],
    });

    expect(res.grandTotal).toBe(500);
    expect(res.paidAmount).toBe(500);
    expect(res.remainingAmount).toBe(0);
    expect(res.paymentStatus).toBe('paid');
  });
});

describe('Sale Editing & Deletion Stock Integrity', () => {
  it('computes net stock deltas correctly when editing quantities and adding/removing items', () => {
    const originalItems = [
      { productId: 'p1', productName: 'Item A', quantity: 5, returnedQuantity: 0 },
      { productId: 'p2', productName: 'Item B', quantity: 3, returnedQuantity: 0 },
    ];
    const updatedItems = [
      { productId: 'p1', productName: 'Item A', quantity: 2 },
      { productId: 'p3', productName: 'Item C', quantity: 4 },
    ];
    const currentStock = { p1: 10, p2: 0, p3: 6 };

    const deltas = computeSaleEditDeltas(originalItems, updatedItems, currentStock);
    const byId = Object.fromEntries(deltas.map((d) => [d.productId, d]));

    expect(byId.p1).toMatchObject({ previousStock: 10, stockDelta: 3, newStock: 13 });
    expect(byId.p2).toMatchObject({ previousStock: 0, stockDelta: 3, newStock: 3 });
    expect(byId.p3).toMatchObject({ previousStock: 6, stockDelta: -4, newStock: 2 });
  });

  it('prevents negative stock when editing sale increases quantity beyond available inventory', () => {
    const originalItems = [{ productId: 'p1', productName: 'Item A', quantity: 2, returnedQuantity: 0 }];
    const updatedItems = [{ productId: 'p1', productName: 'Item A', quantity: 8 }];
    const currentStock = { p1: 3 };

    expect(() => computeSaleEditDeltas(originalItems, updatedItems, currentStock)).toThrow(
      /Insufficient stock/i
    );
  });

  it('prevents reducing edited quantity below already-returned quantity', () => {
    const originalItems = [{ productId: 'p1', productName: 'Item A', quantity: 5, returnedQuantity: 3 }];
    const updatedItems = [{ productId: 'p1', productName: 'Item A', quantity: 2 }];

    expect(() => computeSaleEditDeltas(originalItems, updatedItems, { p1: 10 })).toThrow(
      /already returned/i
    );
  });

  it('restores only net (sold - returned) quantities when deleting a sale', () => {
    const restorations = computeSaleDeleteRestorations([
      { productId: 'p1', quantity: 5, returnedQuantity: 2 },
      { productId: 'p2', quantity: 3, returnedQuantity: 3 },
      { productId: 'p3', quantity: 4, returnedQuantity: 0 },
    ]);

    expect(restorations).toEqual([
      { productId: 'p1', quantityToRestore: 3 },
      { productId: 'p3', quantityToRestore: 4 },
    ]);
  });
});

describe('Sales Return Validation (Partial & Complete)', () => {
  const baseSale = {
    id: 'sale-1',
    invoiceNumber: 'INV-20261118-0001',
    subtotal: 1000,
    grandTotal: 1000,
    totalReturnedAmount: 0,
    items: [
      { productId: 'p1', productName: 'Shirt', quantity: 2, returnedQuantity: 0, unitPrice: 300, purchasePrice: 200 },
      { productId: 'p2', productName: 'Cap', quantity: 4, returnedQuantity: 1, unitPrice: 100, purchasePrice: 60 },
    ],
  };

  it('processes a partial return accurately with cost and profit reversal', () => {
    const res = validateAndBuildReturn({
      originalSale: baseSale,
      requestedReturns: [{ productId: 'p1', returnQuantity: 1 }],
    });

    expect(res.totalReturnedQty).toBe(1);
    expect(res.totalReturnAmount).toBe(300);
    expect(res.totalReturnCost).toBe(200);
    expect(res.totalReturnProfit).toBe(100);
    expect(res.returnStatus).toBe('partial');
    expect(res.updatedOriginalItems[0].returnedQuantity).toBe(1);
  });

  it('rejects returns exceeding (sold - previously returned)', () => {
    expect(() =>
      validateAndBuildReturn({
        originalSale: baseSale,
        requestedReturns: [{ productId: 'p2', returnQuantity: 4 }],
      })
    ).toThrow(/exceeds returnable quantity/i);
  });

  it('marks sale returnStatus as full when all remaining quantities are returned', () => {
    const res = validateAndBuildReturn({
      originalSale: baseSale,
      requestedReturns: [
        { productId: 'p1', returnQuantity: 2 },
        { productId: 'p2', returnQuantity: 3 },
      ],
    });

    expect(res.returnStatus).toBe('full');
    expect(res.totalReturnedQty).toBe(5);
    expect(res.totalReturnAmount).toBe(900);
  });
});

describe('Daily/Monthly Aggregation & Next/Previous Day Navigation', () => {
  it('shifts dates cleanly across month and leap-year boundaries without mutating records', () => {
    expect(shiftDateKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2024-02-28', 1)).toBe('2024-02-29');
    expect(toLocalMonthKey('2026-12-01')).toBe('2026-12');
  });

  it('aggregates net sales and net profit accurately accounting for returns', () => {
    const summary = aggregatePeriodSummary({
      sales: [
        {
          customerName: 'Ali',
          grandTotal: 2000,
          paidAmount: 1500,
          remainingAmount: 500,
          items: [
            { productId: 'p1', productName: 'Rice', quantity: 2, unitPrice: 1000, purchasePrice: 700, lineTotal: 2000 },
          ],
        },
        {
          customerName: 'Walk-in Customer',
          grandTotal: 500,
          paidAmount: 500,
          remainingAmount: 0,
          items: [
            { productId: 'p2', productName: 'Oil', quantity: 1, unitPrice: 500, purchasePrice: 350, lineTotal: 500 },
          ],
        },
      ],
      returns: [
        {
          customerName: 'Ali',
          totalReturnAmount: 1000,
          items: [{ productId: 'p1', productName: 'Rice', returnQuantity: 1, purchasePrice: 700, lineReturnTotal: 1000 }],
        },
      ],
    });

    expect(summary.grossSales).toBe(2500);
    expect(summary.grossCost).toBe(1750);
    expect(summary.totalReturns).toBe(1000);
    expect(summary.returnedCost).toBe(700);
    expect(summary.netSales).toBe(1500);
    expect(summary.netCost).toBe(1050);
    expect(summary.netProfit).toBe(450);
    expect(summary.profitMargin).toBe(30);
    expect(summary.invoiceCount).toBe(2);
    expect(summary.totalItemsSold).toBe(3);
    expect(summary.totalItemsReturned).toBe(1);
    expect(summary.productReports[0]).toMatchObject({
      productId: 'p1',
      quantitySold: 2,
      quantityReturned: 1,
      netQuantity: 1,
      netCost: 700,
      netRevenue: 1000,
      netProfit: 300,
    });
  });
});

describe('Barcode Generation & 58mm ESC/POS Receipt Formatting', () => {
  it('generates valid 13-digit EAN-13 internal barcodes', () => {
    const code = generateInternalBarcode();
    expect(code).toMatch(/^20\d{11}$/);
    expect(isValidEan13(code)).toBe(true);
    expect(calculateEan13CheckDigit(code.slice(0, 12))).toBe(Number(code[12]));
  });

  it('formats 58mm ESC/POS receipt lines strictly within 32-column paper width', () => {
    const row = padRow('Very Long Product Label Name', 'PKR 1,250', 32);
    expect(row.length).toBeLessThanOrEqual(32);

    const wrapped = wrapText('Thank you for shopping at our retail store!', 32);
    for (const line of wrapped) {
      expect(line.length).toBeLessThanOrEqual(32);
    }

    const receiptLines = buildEscPosReceipt({
      type: 'sale',
      settings: { businessName: 'Dry Delight', currency: 'PKR', paperWidth: '58mm' },
      documentData: {
        invoiceNumber: 'INV-20261118-0001',
        customerName: 'Walk-in Customer',
        subtotal: 500,
        grandTotal: 500,
        paidAmount: 500,
        remainingAmount: 0,
        changeAmount: 0,
        items: [{ productName: 'Premium Coffee 250g', quantity: 1, unitPrice: 500, lineTotal: 500 }],
      },
    });

    const fullText = receiptLines.join('');
    expect(fullText).toContain('Dry Delight');
    expect(fullText).toContain('INV-20261118-0001');
    expect(fullText).toContain('GRAND TOTAL:');
    expect(fullText).toContain('PKR 500');
  });

  it('defaults POS receipt to 80mm (42 columns) with bold commands active throughout', () => {
    const receiptLines = buildEscPosReceipt({
      type: 'sale',
      settings: { businessName: 'Dry Delight', currency: 'PKR' },
      documentData: {
        invoiceNumber: 'INV-20261125-0002',
        customerName: 'Ali',
        subtotal: 1250,
        grandTotal: 1250,
        paidAmount: 1500,
        remainingAmount: 0,
        changeAmount: 250,
        items: [{ productName: 'Almond Giri 500g', quantity: 1, unitPrice: 1250, lineTotal: 1250 }],
      },
    });

    const fullText = receiptLines.join('');
    expect(fullText).toContain('='.repeat(42));
    expect(fullText).toContain('\x1BE\x01'); // ESC E 1 (BOLD_ON)
    expect(fullText).toContain('1. Almond Giri 500g');
    expect(fullText).toContain('Items: 1');
    expect(fullText).toContain('Qty: 1');
    // BOLD_OFF only emitted right before FEED_AND_CUT
    const boldOffIndex = fullText.indexOf('\x1BE\x00');
    expect(boldOffIndex).toBeGreaterThan(fullText.indexOf('INV-20261125-0002'));
  });
});

describe('Profit Lock PIN & Store Settings Defaults', () => {
  it('verifies default PIN and hashed custom PINs accurately', () => {
    expect(verifyProfitPin(DEFAULT_PROFIT_PIN, '')).toBe(true);
    expect(verifyProfitPin('0000', '')).toBe(false);
    expect(verifyProfitPin('', '')).toBe(false);

    const customHash = hashProfitPin('7890');
    expect(customHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyProfitPin('7890', customHash)).toBe(true);
    expect(verifyProfitPin(DEFAULT_PROFIT_PIN, customHash)).toBe(false);
  });

  it('defaults store settings to 80mm receipt width and profit lock enabled', () => {
    expect(DEFAULT_SETTINGS.paperWidth).toBe('80mm');
    expect(DEFAULT_SETTINGS.profitLockEnabled).toBe(true);

    // Legacy 58mm setting without explicit choice upgrades automatically to 80mm
    const upgraded = normalizeBrandSettings({ paperWidth: '58mm' });
    expect(upgraded.paperWidth).toBe('80mm');
    expect(upgraded.profitLockEnabled).toBe(true);

    // Explicit 58mm choice by admin is respected
    const explicit58 = normalizeBrandSettings({ paperWidth: '58mm', paperWidthExplicit: true });
    expect(explicit58.paperWidth).toBe('58mm');
  });
});

describe('Product Image Resolution & Validation', () => {
  it('matches inventory product names accurately across categories', () => {
    expect(matchProductImageByName('Acha Mozzarella Crush', 'Cheese & Dairy')).toBe(
      '/product-images/cheese-shredded.webp'
    );
    expect(matchProductImageByName('Adam Cheddar Block', 'Cheese & Dairy')).toBe(
      '/product-images/cheese-block.webp'
    );
    expect(matchProductImageByName('2 Sher Maida', 'Atta, Maida & Flours')).toBe(
      '/product-images/flour-sack.webp'
    );
    expect(matchProductImageByName('Dawn Bread Crumbs 250g', 'Bakery, Buns & Breads')).toBe(
      '/product-images/bread-crumbs.webp'
    );
    expect(matchProductImageByName('Large Pizza Boxes', 'Packaging, Disposables & Boxes')).toBe(
      '/product-images/packaging-pizza-box.webp'
    );
    expect(matchProductImageByName('Arizona Black Olives Can', 'Canned & Preserved Foods')).toBe(
      '/product-images/canned-olives.webp'
    );
  });

  it('prefers valid custom imageUrl and validates safe formats', () => {
    expect(isValidProductImageUrl('/product-images/cheese-block.webp')).toBe(true);
    expect(isValidProductImageUrl('https://example.com/item.webp')).toBe(true);
    expect(isValidProductImageUrl('javascript:alert(1)')).toBe(false);
    expect(isValidProductImageUrl('not-a-valid-path')).toBe(false);

    expect(
      getProductImage({
        name: 'Adam Cheddar Block',
        imageUrl: 'https://cdn.example.com/custom-cheddar.webp',
      })
    ).toBe('https://cdn.example.com/custom-cheddar.webp');

    expect(
      getProductImage({
        name: 'Adam Cheddar Block',
        imageUrl: 'javascript:bad',
      })
    ).toBe('/product-images/cheese-block.webp');
  });
});
