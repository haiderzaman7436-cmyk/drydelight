import { roundMoney } from './formatters';

/**
 * Pure, deterministic business-logic calculations shared between UI previews,
 * Firestore atomic transactions, and automated unit tests.
 */

export function calculateSaleTotals({ items = [], paidAmount }) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      items: [],
      totalItems: 0,
      subtotal: 0,
      totalCost: 0,
      grossProfit: 0,
      grandTotal: 0,
      paidAmount: 0,
      remainingAmount: 0,
      changeAmount: 0,
      paymentStatus: 'paid',
    };
  }

  const normalizedItems = items.map((item) => {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    const unitPrice = Math.max(0, roundMoney(item.unitPrice));
    const purchasePrice = Math.max(0, roundMoney(item.purchasePrice || 0));
    const returnedQuantity = Math.max(0, Math.floor(Number(item.returnedQuantity) || 0));
    const lineTotal = roundMoney(quantity * unitPrice);
    const lineCost = roundMoney(quantity * purchasePrice);
    const lineProfit = roundMoney(lineTotal - lineCost);

    return {
      productId: item.productId,
      productName: item.productName || '',
      sku: item.sku || '',
      barcode: item.barcode || '',
      quantity,
      returnedQuantity,
      unitPrice,
      purchasePrice,
      lineTotal,
      lineCost,
      lineProfit,
    };
  });

  const subtotal = roundMoney(
    normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const totalCost = roundMoney(
    normalizedItems.reduce((sum, item) => sum + item.lineCost, 0)
  );
  const totalItems = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = subtotal;
  const grossProfit = roundMoney(grandTotal - totalCost);

  const effectivePaid =
    paidAmount === '' || paidAmount === undefined || paidAmount === null
      ? grandTotal
      : Math.max(0, roundMoney(paidAmount));

  const remainingAmount = roundMoney(Math.max(0, grandTotal - effectivePaid));
  const changeAmount = roundMoney(Math.max(0, effectivePaid - grandTotal));

  let paymentStatus = 'paid';
  if (grandTotal === 0 || remainingAmount === 0) {
    paymentStatus = 'paid';
  } else if (effectivePaid > 0) {
    paymentStatus = 'partial';
  } else {
    paymentStatus = 'unpaid';
  }

  return {
    items: normalizedItems,
    totalItems,
    subtotal,
    totalCost,
    grossProfit,
    grandTotal,
    paidAmount: effectivePaid,
    remainingAmount,
    changeAmount,
    paymentStatus,
  };
}

/**
 * Computes per-product stock adjustments when editing an existing sale.
 * Positive delta means stock increases (restored to inventory).
 * Negative delta means stock decreases (deducted from inventory).
 */
export function computeSaleEditDeltas(originalItems = [], updatedItems = [], currentStockByProductId = {}) {
  if (!Array.isArray(updatedItems) || updatedItems.length === 0) {
    throw new Error('A sale must contain at least one item.');
  }

  const originalMap = new Map();
  for (const item of originalItems) {
    const prev = originalMap.get(item.productId) || { quantity: 0, returnedQuantity: 0, productName: item.productName };
    originalMap.set(item.productId, {
      quantity: prev.quantity + Number(item.quantity || 0),
      returnedQuantity: prev.returnedQuantity + Number(item.returnedQuantity || 0),
      productName: item.productName || prev.productName,
    });
  }

  const updatedMap = new Map();
  for (const item of updatedItems) {
    const qty = Math.floor(Number(item.quantity) || 0);
    if (qty <= 0) {
      throw new Error(`Quantity for "${item.productName || item.productId}" must be at least 1.`);
    }
    const prev = updatedMap.get(item.productId) || { quantity: 0, productName: item.productName };
    updatedMap.set(item.productId, {
      quantity: prev.quantity + qty,
      productName: item.productName || prev.productName,
    });
  }

  for (const [productId, orig] of originalMap.entries()) {
    const newQty = updatedMap.get(productId)?.quantity || 0;
    if (orig.returnedQuantity > 0 && newQty < orig.returnedQuantity) {
      throw new Error(
        `Cannot reduce "${orig.productName}" below already returned quantity (${orig.returnedQuantity}).`
      );
    }
  }

  const allProductIds = new Set([...originalMap.keys(), ...updatedMap.keys()]);
  const deltas = [];

  for (const productId of allProductIds) {
    const oldQty = originalMap.get(productId)?.quantity || 0;
    const newQty = updatedMap.get(productId)?.quantity || 0;
    const stockDelta = oldQty - newQty;
    if (stockDelta === 0) continue;

    const currentStock = Number(currentStockByProductId[productId] ?? 0);
    const newStock = currentStock + stockDelta;
    if (newStock < 0) {
      const name = updatedMap.get(productId)?.productName || originalMap.get(productId)?.productName || productId;
      throw new Error(
        `Insufficient stock for "${name}". Available: ${currentStock}, additional needed: ${Math.abs(stockDelta)}.`
      );
    }

    deltas.push({
      productId,
      previousStock: currentStock,
      stockDelta,
      newStock,
    });
  }

  return deltas;
}

/**
 * When deleting a sale, only restore quantities not already returned via Sales Returns.
 */
export function computeSaleDeleteRestorations(saleItems = []) {
  const byProduct = new Map();
  for (const item of saleItems) {
    const soldQty = Number(item.quantity || 0);
    const returnedQty = Number(item.returnedQuantity || 0);
    const netToRestore = Math.max(0, soldQty - returnedQty);
    if (netToRestore <= 0) continue;
    byProduct.set(item.productId, (byProduct.get(item.productId) || 0) + netToRestore);
  }
  return Array.from(byProduct.entries()).map(([productId, quantityToRestore]) => ({
    productId,
    quantityToRestore,
  }));
}

/**
 * Validates return quantities against original sale items minus previous returns,
 * calculates return revenue, cost, and profit reversals, and produces updated sale items.
 */
export function validateAndBuildReturn({ originalSale, requestedReturns = [] }) {
  if (!originalSale || !Array.isArray(originalSale.items)) {
    throw new Error('Original sale record is invalid.');
  }

  const requestedByProductId = new Map();
  for (const req of requestedReturns) {
    const qty = Math.floor(Number(req.returnQuantity) || 0);
    if (qty > 0) {
      requestedByProductId.set(req.productId, (requestedByProductId.get(req.productId) || 0) + qty);
    }
  }

  if (requestedByProductId.size === 0) {
    throw new Error('Select at least one item with a return quantity greater than 0.');
  }

  const returnedItems = [];
  const updatedOriginalItems = originalSale.items.map((item) => {
    const reqQty = requestedByProductId.get(item.productId) || 0;
    if (reqQty <= 0) return { ...item };

    const soldQty = Number(item.quantity || 0);
    const alreadyReturned = Number(item.returnedQuantity || 0);
    const remainingReturnable = soldQty - alreadyReturned;

    if (reqQty > remainingReturnable) {
      throw new Error(
        `Return quantity (${reqQty}) for "${item.productName}" exceeds returnable quantity (${remainingReturnable}).`
      );
    }

    const unitPrice = Number(item.unitPrice || 0);
    const purchasePrice = Number(item.purchasePrice || 0);
    const lineReturnTotal = roundMoney(reqQty * unitPrice);
    const lineReturnCost = roundMoney(reqQty * purchasePrice);
    const lineReturnProfit = roundMoney(lineReturnTotal - lineReturnCost);

    returnedItems.push({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku || '',
      barcode: item.barcode || '',
      returnQuantity: reqQty,
      unitPrice,
      purchasePrice,
      lineReturnTotal,
      lineReturnCost,
      lineReturnProfit,
    });

    requestedByProductId.delete(item.productId);

    return {
      ...item,
      returnedQuantity: alreadyReturned + reqQty,
    };
  });

  if (requestedByProductId.size > 0) {
    throw new Error('One or more selected return products were not found in the original invoice.');
  }

  const totalReturnAmount = roundMoney(
    returnedItems.reduce((sum, item) => sum + item.lineReturnTotal, 0)
  );
  const totalReturnCost = roundMoney(
    returnedItems.reduce((sum, item) => sum + item.lineReturnCost, 0)
  );
  const totalReturnProfit = roundMoney(totalReturnAmount - totalReturnCost);
  const totalReturnedQty = returnedItems.reduce((sum, item) => sum + item.returnQuantity, 0);

  const allFullyReturned = updatedOriginalItems.every(
    (item) => Number(item.returnedQuantity || 0) >= Number(item.quantity || 0)
  );
  const anyReturned = updatedOriginalItems.some(
    (item) => Number(item.returnedQuantity || 0) > 0
  );

  const returnStatus = allFullyReturned ? 'full' : anyReturned ? 'partial' : 'none';

  return {
    returnedItems,
    totalReturnedQty,
    totalReturnAmount,
    totalReturnCost,
    totalReturnProfit,
    updatedOriginalItems,
    returnStatus,
    newSaleTotalReturnedAmount: roundMoney(
      Number(originalSale.totalReturnedAmount || 0) + totalReturnAmount
    ),
  };
}

/**
 * Helper to compute a single sale's net cost & profit (handles legacy sales without stored totalCost).
 */
export function computeSaleProfit(sale) {
  if (!sale) return { cost: 0, profit: 0 };
  const items = sale.items || [];
  const cost =
    typeof sale.totalCost === 'number'
      ? roundMoney(sale.totalCost)
      : roundMoney(
          items.reduce(
            (sum, it) => sum + Number(it.quantity || 0) * Number(it.purchasePrice || 0),
            0
          )
        );
  const revenue = Number(sale.grandTotal || 0);
  return {
    cost,
    profit: roundMoney(revenue - cost),
  };
}

/**
 * Aggregates sales and return records into financial summaries (including COGS, Net Profit, Margin %),
 * product-wise reports, best-selling products, and customer-wise reports.
 */
export function aggregatePeriodSummary({ sales = [], returns = [] }) {
  let grossSales = 0;
  let grossCost = 0;
  let totalItemsSold = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;

  const productMap = new Map();
  const customerMap = new Map();

  for (const sale of sales) {
    const grandTotal = Number(sale.grandTotal || 0);
    const paid = Number(sale.paidAmount || 0);
    const remaining = Number(sale.remainingAmount || 0);

    grossSales += grandTotal;
    totalCollected += Math.min(grandTotal, paid);
    totalOutstanding += remaining;

    const customerKey = (sale.customerName || 'Walk-in Customer').trim() || 'Walk-in Customer';
    const cust = customerMap.get(customerKey) || {
      customerName: customerKey,
      invoices: 0,
      itemsPurchased: 0,
      grossAmount: 0,
      grossCost: 0,
      returnAmount: 0,
      returnCost: 0,
      netAmount: 0,
      netProfit: 0,
      outstandingAmount: 0,
    };
    cust.invoices += 1;
    cust.grossAmount = roundMoney(cust.grossAmount + grandTotal);
    cust.outstandingAmount = roundMoney(cust.outstandingAmount + remaining);

    for (const item of sale.items || []) {
      const qty = Number(item.quantity || 0);
      const lineTotal = Number(item.lineTotal ?? qty * Number(item.unitPrice || 0));
      const costTotal = roundMoney(qty * Number(item.purchasePrice || 0));

      totalItemsSold += qty;
      grossCost += costTotal;
      cust.itemsPurchased += qty;
      cust.grossCost = roundMoney(cust.grossCost + costTotal);

      const prod = productMap.get(item.productId) || {
        productId: item.productId,
        productName: item.productName || 'Unknown Product',
        sku: item.sku || '',
        barcode: item.barcode || '',
        quantitySold: 0,
        quantityReturned: 0,
        netQuantity: 0,
        grossRevenue: 0,
        returnAmount: 0,
        netRevenue: 0,
        estimatedCost: 0,
        returnedCost: 0,
        netCost: 0,
        netProfit: 0,
        profitMargin: 0,
      };
      prod.quantitySold += qty;
      prod.grossRevenue = roundMoney(prod.grossRevenue + lineTotal);
      prod.estimatedCost = roundMoney(prod.estimatedCost + costTotal);
      productMap.set(item.productId, prod);
    }

    customerMap.set(customerKey, cust);
  }

  let totalReturns = 0;
  let returnedCost = 0;
  let totalItemsReturned = 0;

  for (const ret of returns) {
    const retAmt = Number(ret.totalReturnAmount || 0);
    totalReturns += retAmt;

    const customerKey = (ret.customerName || 'Walk-in Customer').trim() || 'Walk-in Customer';
    const cust = customerMap.get(customerKey) || {
      customerName: customerKey,
      invoices: 0,
      itemsPurchased: 0,
      grossAmount: 0,
      grossCost: 0,
      returnAmount: 0,
      returnCost: 0,
      netAmount: 0,
      netProfit: 0,
      outstandingAmount: 0,
    };
    cust.returnAmount = roundMoney(cust.returnAmount + retAmt);

    for (const item of ret.items || []) {
      const rQty = Number(item.returnQuantity || 0);
      const rAmt = Number(item.lineReturnTotal || 0);
      totalItemsReturned += rQty;

      const existingProd = productMap.get(item.productId);
      const fallbackUnitCost =
        existingProd && existingProd.quantitySold > 0
          ? existingProd.estimatedCost / existingProd.quantitySold
          : 0;
      const unitCost =
        item.purchasePrice !== undefined && item.purchasePrice !== null
          ? Number(item.purchasePrice)
          : fallbackUnitCost;
      const rCost = roundMoney(rQty * unitCost);

      returnedCost += rCost;
      cust.returnCost = roundMoney(cust.returnCost + rCost);

      const prod = existingProd || {
        productId: item.productId,
        productName: item.productName || 'Unknown Product',
        sku: item.sku || '',
        barcode: item.barcode || '',
        quantitySold: 0,
        quantityReturned: 0,
        netQuantity: 0,
        grossRevenue: 0,
        returnAmount: 0,
        netRevenue: 0,
        estimatedCost: 0,
        returnedCost: 0,
        netCost: 0,
        netProfit: 0,
        profitMargin: 0,
      };
      prod.quantityReturned += rQty;
      prod.returnAmount = roundMoney(prod.returnAmount + rAmt);
      prod.returnedCost = roundMoney(prod.returnedCost + rCost);
      productMap.set(item.productId, prod);
    }

    customerMap.set(customerKey, cust);
  }

  grossSales = roundMoney(grossSales);
  grossCost = roundMoney(grossCost);
  totalReturns = roundMoney(totalReturns);
  returnedCost = roundMoney(returnedCost);

  const netSales = roundMoney(grossSales - totalReturns);
  const netCost = roundMoney(grossCost - returnedCost);
  const grossProfit = roundMoney(grossSales - grossCost);
  const netProfit = roundMoney(netSales - netCost);
  const profitMargin = netSales > 0 ? roundMoney((netProfit / netSales) * 100) : 0;

  const productReports = Array.from(productMap.values())
    .map((p) => {
      const netQuantity = p.quantitySold - p.quantityReturned;
      const netRevenue = roundMoney(p.grossRevenue - p.returnAmount);
      const prodNetCost = roundMoney(p.estimatedCost - p.returnedCost);
      const prodNetProfit = roundMoney(netRevenue - prodNetCost);
      const prodMargin = netRevenue > 0 ? roundMoney((prodNetProfit / netRevenue) * 100) : 0;
      return {
        ...p,
        netQuantity,
        netRevenue,
        netCost: prodNetCost,
        netProfit: prodNetProfit,
        profitMargin: prodMargin,
      };
    })
    .sort((a, b) => b.netQuantity - a.netQuantity || b.netRevenue - a.netRevenue);

  const customerReports = Array.from(customerMap.values())
    .map((c) => {
      const netAmount = roundMoney(c.grossAmount - c.returnAmount);
      const cNetCost = roundMoney(c.grossCost - c.returnCost);
      return {
        ...c,
        netAmount,
        netProfit: roundMoney(netAmount - cNetCost),
      };
    })
    .sort((a, b) => b.netAmount - a.netAmount);

  return {
    grossSales,
    grossCost,
    grossProfit,
    invoiceCount: sales.length,
    totalItemsSold,
    totalReturns,
    returnedCost,
    returnCount: returns.length,
    totalItemsReturned,
    netSales,
    netCost,
    netProfit,
    profitMargin,
    totalCollected: roundMoney(totalCollected),
    totalOutstanding: roundMoney(totalOutstanding),
    productReports,
    bestSellingProducts: productReports.slice(0, 10),
    customerReports,
  };
}
