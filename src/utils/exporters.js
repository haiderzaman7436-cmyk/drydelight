import { formatCurrency } from './formatters';

function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv({ filename, headers, rows }) {
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Dynamically imports jsPDF & jspdf-autotable on demand (~400 KB saved from initial/page load).
 */
export async function exportSalesReportPdf({
  title,
  subtitle,
  businessName = 'Dry Delight',
  currency = 'PKR',
  summary,
  tableTitle,
  columns,
  rows,
  filename = 'sales-report.pdf',
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(businessName, 40, 44);

  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text(title, 40, 64);

  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 40, 80);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 94);

  let yPos = 112;

  if (summary) {
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value', 'Metric', 'Value']],
      body: [
        [
          'Gross Sales',
          formatCurrency(summary.grossSales, currency),
          'Total Returns',
          formatCurrency(summary.totalReturns, currency),
        ],
        [
          'Net Sales',
          formatCurrency(summary.netSales, currency),
          'Net Cost (COGS)',
          formatCurrency(summary.netCost ?? 0, currency),
        ],
        [
          'Net Profit',
          `${formatCurrency(summary.netProfit ?? 0, currency)} (${summary.profitMargin ?? 0}%)`,
          'Total Invoices / Items',
          `${summary.invoiceCount} / ${summary.totalItemsSold}`,
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 6 },
      margin: { left: 40, right: 40 },
    });
    yPos = doc.lastAutoTable.finalY + 20;
  }

  if (tableTitle) {
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(tableTitle, 40, yPos);
    yPos += 10;
  }

  autoTable(doc, {
    startY: yPos,
    head: [columns],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 5 },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
