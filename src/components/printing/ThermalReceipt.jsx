import { formatCurrency, formatDateTime, roundMoney } from '../../utils/formatters';

function formatPlainNumber(val) {
  const num = roundMoney(val);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export default function ThermalReceipt({ documentData, type = 'sale', settings = {} }) {
  if (!documentData) return null;

  const isReturn = type === 'return';
  const currency = settings.currency || 'PKR';
  const is80mm = settings.paperWidth !== '58mm';
  const items = documentData.items || [];

  const totalUnits = items.reduce(
    (sum, item) => sum + Number(isReturn ? item.returnQuantity || 0 : item.quantity || 0),
    0
  );

  const metaFontSize = is80mm ? '12.5px' : '11px';
  const totalRowFontSize = is80mm ? '13px' : '11.5px';
  const grandTotalFontSize = is80mm ? '16px' : '13.5px';

  return (
    <div className={`thermal-receipt ${is80mm ? 'thermal-80mm' : ''}`}>
      {/* Store Header */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <div
          style={{
            fontSize: is80mm ? '20px' : '16px',
            fontWeight: 900,
            letterSpacing: '0.5px',
            lineHeight: 1.18,
            textTransform: 'uppercase',
          }}
        >
          {settings.businessName || 'Dry Delight'}
        </div>
        {settings.businessAddress && (
          <div style={{ fontSize: is80mm ? '12px' : '10.5px', fontWeight: 700, marginTop: '3px' }}>
            {settings.businessAddress}
          </div>
        )}
        {settings.contactNumber && (
          <div style={{ fontSize: is80mm ? '12px' : '10.5px', fontWeight: 700, marginTop: '2px' }}>
            Tel: {settings.contactNumber}
          </div>
        )}
        {settings.invoiceHeader && (
          <div style={{ fontSize: is80mm ? '11.5px' : '10px', fontWeight: 700, marginTop: '3px' }}>
            {settings.invoiceHeader}
          </div>
        )}
      </div>

      {/* Receipt Title Banner */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 900,
          fontSize: is80mm ? '14px' : '12px',
          letterSpacing: '1px',
          padding: '4px 0',
          margin: '4px 0 6px 0',
          borderTop: '2px solid #000',
          borderBottom: '2px solid #000',
        }}
      >
        {isReturn ? 'SALES RETURN RECEIPT' : 'SALES INVOICE'}
      </div>

      {/* Invoice Meta Info */}
      <div style={{ fontSize: metaFontSize, fontWeight: 700, lineHeight: 1.48, marginBottom: '5px' }}>
        {isReturn ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
              <span>Return #:</span>
              <span style={{ textAlign: 'right', fontWeight: 900 }}>
                {documentData.returnInvoiceNumber}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
              <span>Orig Inv #:</span>
              <span style={{ textAlign: 'right', fontWeight: 800 }}>
                {documentData.originalInvoiceNumber}
              </span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
            <span>Invoice #:</span>
            <span style={{ textAlign: 'right', fontWeight: 900 }}>
              {documentData.invoiceNumber}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
          <span>Date:</span>
          <span style={{ textAlign: 'right', fontWeight: 700 }}>
            {formatDateTime(documentData.createdAt || new Date())}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
          <span>Customer:</span>
          <span style={{ textAlign: 'right', fontWeight: 800 }}>
            {documentData.customerName || 'Walk-in Customer'}
          </span>
        </div>
      </div>

      {/* Items Table */}
      {is80mm ? (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '4px',
            marginBottom: '4px',
            fontWeight: 700,
          }}
        >
          <thead>
            <tr
              style={{
                borderTop: '2px solid #000',
                borderBottom: '2px solid #000',
                fontSize: '11.5px',
                fontWeight: 900,
              }}
            >
              <th style={{ textAlign: 'left', padding: '5px 2px', width: '46%', fontWeight: 900 }}>
                ITEM
              </th>
              <th style={{ textAlign: 'center', padding: '5px 2px', width: '12%', fontWeight: 900 }}>
                QTY
              </th>
              <th style={{ textAlign: 'right', padding: '5px 2px', width: '19%', fontWeight: 900 }}>
                RATE
              </th>
              <th style={{ textAlign: 'right', padding: '5px 2px', width: '23%', fontWeight: 900 }}>
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const qty = isReturn ? item.returnQuantity : item.quantity;
              const total = isReturn ? item.lineReturnTotal : item.lineTotal;
              return (
                <tr
                  key={`${item.productId}-${idx}`}
                  style={{
                    borderBottom: '1px dashed #000',
                    verticalAlign: 'top',
                    fontSize: '12.5px',
                    fontWeight: 700,
                  }}
                >
                  <td style={{ padding: '5px 3px 5px 1px', textAlign: 'left', fontWeight: 800 }}>
                    <div>
                      {idx + 1}. {item.productName}
                    </div>
                    {settings.showBarcodeOnReceipt && item.barcode && (
                      <div style={{ fontSize: '10.5px', fontWeight: 700, marginTop: '1px' }}>
                        #{item.barcode}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '5px 2px', textAlign: 'center', fontWeight: 800 }}>
                    {qty}
                  </td>
                  <td style={{ padding: '5px 2px', textAlign: 'right', fontWeight: 700 }}>
                    {formatPlainNumber(item.unitPrice)}
                  </td>
                  <td style={{ padding: '5px 1px 5px 2px', textAlign: 'right', fontWeight: 900 }}>
                    {formatPlainNumber(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <>
          <div className="thermal-divider-solid" />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 900,
              fontSize: '11px',
              marginBottom: '2px',
            }}
          >
            <span>ITEM (QTY x RATE)</span>
            <span>TOTAL</span>
          </div>
          <div className="thermal-divider-solid" />
          <div>
            {items.map((item, idx) => {
              const qty = isReturn ? item.returnQuantity : item.quantity;
              const total = isReturn ? item.lineReturnTotal : item.lineTotal;
              return (
                <div
                  key={`${item.productId}-${idx}`}
                  style={{
                    paddingBottom: '4px',
                    marginBottom: '4px',
                    borderBottom: '1px dashed #000',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '11.5px' }}>
                    {idx + 1}. {item.productName}
                  </div>
                  {settings.showBarcodeOnReceipt && item.barcode && (
                    <div style={{ fontSize: '9.5px', fontWeight: 700 }}>#{item.barcode}</div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontWeight: 700,
                      paddingLeft: '4px',
                      marginTop: '1px',
                    }}
                  >
                    <span>
                      {qty} x {formatPlainNumber(item.unitPrice)}
                    </span>
                    <span style={{ fontWeight: 900 }}>{formatCurrency(total, currency)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Item & Qty summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: is80mm ? '11.5px' : '10.5px',
          fontWeight: 800,
          padding: '3px 0',
        }}
      >
        <span>Items: {items.length}</span>
        <span>Total Qty: {totalUnits}</span>
      </div>

      {/* Totals Breakdown */}
      {isReturn ? (
        <div style={{ fontSize: totalRowFontSize, fontWeight: 700 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 900,
              fontSize: grandTotalFontSize,
              padding: '5px 0',
              margin: '4px 0',
              borderTop: '2px solid #000',
              borderBottom: '2px solid #000',
            }}
          >
            <span>TOTAL REFUND</span>
            <span>{formatCurrency(documentData.totalReturnAmount, currency)}</span>
          </div>
          {documentData.reason && (
            <div style={{ fontSize: is80mm ? '12px' : '10.5px', fontWeight: 700, marginTop: '4px' }}>
              <span style={{ fontWeight: 900 }}>Reason:</span> {documentData.reason}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: totalRowFontSize, fontWeight: 700, lineHeight: 1.45 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>Subtotal</span>
            <span>{formatCurrency(documentData.subtotal, currency)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 900,
              fontSize: grandTotalFontSize,
              margin: '5px 0',
              padding: '5px 0',
              borderTop: '2px solid #000',
              borderBottom: '2px solid #000',
            }}
          >
            <span>GRAND TOTAL</span>
            <span>{formatCurrency(documentData.grandTotal, currency)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>Paid Amount</span>
            <span>{formatCurrency(documentData.paidAmount, currency)}</span>
          </div>
          {Number(documentData.remainingAmount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
              <span>Remaining Balance</span>
              <span>{formatCurrency(documentData.remainingAmount, currency)}</span>
            </div>
          )}
          {Number(documentData.changeAmount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Change Due</span>
              <span>{formatCurrency(documentData.changeAmount, currency)}</span>
            </div>
          )}
        </div>
      )}

      <div className="thermal-divider-solid" style={{ marginTop: '6px' }} />

      {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          fontSize: is80mm ? '11.5px' : '10px',
          fontWeight: 700,
          lineHeight: 1.4,
          marginTop: '5px',
        }}
      >
        {settings.invoiceFooter || 'Thank you for your business!'}
      </div>
    </div>
  );
}
