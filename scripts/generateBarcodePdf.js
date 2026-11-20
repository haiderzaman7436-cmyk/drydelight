import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

function getBarcodeData(barcode) {
  const obj = {};
  const isEan13 = /^\d{13}$/.test(barcode);
  try {
    JsBarcode(obj, String(barcode), {
      format: isEan13 ? 'EAN13' : 'CODE128',
      displayValue: false,
    });
  } catch {
    JsBarcode(obj, String(barcode), {
      format: 'CODE128',
      displayValue: false,
    });
  }
  return obj.encodings;
}

function renderBarcodeVector(doc, barcode, x, y, width, height) {
  const enc = getBarcodeData(barcode);
  if (!enc) return false;

  let binary = '';
  for (const e of enc) binary += e.data;
  if (!binary) return false;

  const moduleWidth = width / binary.length;
  doc.setFillColor(0, 0, 0);

  let i = 0;
  while (i < binary.length) {
    if (binary[i] === '1') {
      const start = i;
      while (i < binary.length && binary[i] === '1') i++;
      doc.rect(x + start * moduleWidth, y, (i - start) * moduleWidth, height, 'F');
    } else {
      i++;
    }
  }
  return true;
}

export function generateProductBarcodesPdf(products, options = {}) {
  const {
    storeName = 'DRY DELIGHT',
    currency = 'Rs.',
  } = options;

  // A4 Page Setup (in mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // 3 Columns x 8 Rows = 24 Labels per A4 sheet
  const cols = 3;
  const rows = 8;
  const labelsPerPage = cols * rows;

  const labelWidth = 62;
  const labelHeight = 32;
  const marginLeft = 9;
  const marginTop = 10;
  const gapX = 3;
  const gapY = 3;

  const totalPages = Math.ceil(products.length / labelsPerPage);

  products.forEach((prod, idx) => {
    const pageIndex = Math.floor(idx / labelsPerPage);
    const itemInPage = idx % labelsPerPage;

    if (idx > 0 && itemInPage === 0) {
      doc.addPage();
    }

    const col = itemInPage % cols;
    const row = Math.floor(itemInPage / cols);

    const x = marginLeft + col * (labelWidth + gapX);
    const y = marginTop + row * (labelHeight + gapY);

    // Label boundary / cut guide (subtle light border)
    doc.setDrawColor(210, 215, 225);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, labelWidth, labelHeight, 1.5, 1.5, 'S');

    // 1. Store brand & Price Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(storeName, x + 2.5, y + 4);

    if (prod.sellingPrice) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const priceText = `${currency} ${Number(prod.sellingPrice).toLocaleString()}`;
      doc.text(priceText, x + labelWidth - 2.5, y + 4, { align: 'right' });
    }

    // 2. Product Name (Clean 1-2 lines)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    const maxNameWidth = labelWidth - 5;
    const nameLines = doc.splitTextToSize(prod.name, maxNameWidth);
    const displayName = nameLines.slice(0, 2);
    doc.text(displayName, x + 2.5, y + 7.5);

    // 3. Barcode Vector Graphics (Lines)
    const barcodeWidth = 46;
    const barcodeHeight = 11;
    const barcodeX = x + (labelWidth - barcodeWidth) / 2;
    const barcodeY = y + 13.5;

    const rendered = renderBarcodeVector(doc, prod.barcode, barcodeX, barcodeY, barcodeWidth, barcodeHeight);

    // 4. Barcode Numeric String under the bars
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const barcodeText = String(prod.barcode || '');
    // Format EAN-13 visually with standard spaces: "2 000000 000015"
    const formattedBarcode = barcodeText.length === 13
      ? `${barcodeText[0]}  ${barcodeText.slice(1, 7)}  ${barcodeText.slice(7)}`
      : barcodeText;

    doc.text(formattedBarcode, x + labelWidth / 2, y + 28, { align: 'center' });

    // 5. SKU & Category indicator at bottom
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    if (prod.sku) {
      doc.text(prod.sku, x + 2.5, y + 30.5);
    }
    if (prod.categoryName) {
      const catText = doc.splitTextToSize(prod.categoryName, 26)[0];
      doc.text(catText, x + labelWidth - 2.5, y + 30.5, { align: 'right' });
    }
  });

  return doc;
}

// CLI execution
const catalogPath = path.resolve('src/data/scrapedCatalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

console.log(`Generating Barcode Sticker Labels PDF for ${catalog.products.length} products...`);

const doc = generateProductBarcodesPdf(catalog.products, {
  storeName: 'DRY DELIGHT',
  currency: 'PKR',
});

const outputPath = path.resolve('Dry_Delight_Product_Barcodes.pdf');
const buffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(outputPath, buffer);

console.log(`Successfully generated: ${outputPath}`);
console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
console.log(`Total Pages: ${Math.ceil(catalog.products.length / 24)} (24 labels per A4 page)`);
