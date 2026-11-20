import { formatCurrency, formatDateTime, roundMoney } from '../../utils/formatters';

export default function ThermalReceipt({ documentData, type = 'sale', settings = {} }) {
  if (!documentData) return null;

  const isReturn = type === 'return';
  const currency = settings.currency || 'PKR';
  const is80mm = settings.paperWidth === '80mm';
  const items = documentData.items || [];

  return (
    <div className={`thermal-receipt ${is80mm ? 'thermal-80mm' : ''}`}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: is80mm ? '15px' : '13px', fontWeight: 700, letterSpacing: '0.3px' }}>
          {settings.businessName || 'Dry Delight'}
        </div>
        {settings.businessAddress && (
          <div style={{ fontSize: '9.5px', marginTop: '1px' }}>{settings.businessAddress}</div>
        )}
        {settings.contactNumber && (
          <div style={{ fontSize: '9.5px' }}>Tel: {settings.contactNumber}</div>
        )}
        {settings.invoiceHeader && (
          <div style={{ fontSize: '9px', marginTop: '2px', fontStyle: 'italic' }}>
            {settings.invoiceHeader}
          </div>
        )}
      </div>

      <div className="thermal-divider-solid" />

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '11px', margin: '2px 0' }}>
        {isReturn ? 'SALES RETURN RECEIPT' : 'SALES INVOICE'}
      </div>

      <div className="thermal-divider" />

      {/* Meta info */}
      <div style={{ fontSize: '9.5px' }}>
        {isReturn ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
              <span>Return #:</span>
              <strong style={{ textAlign: 'right' }}>{documentData.returnInvoiceNumber}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
              <span>Orig Inv:</span>
              <span style={{ textAlign: 'right' }}>{documentData.originalInvoiceNumber}</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
            <span>Invoice:</span>
            <strong style={{ textAlign: 'right' }}>{documentData.invoiceNumber}</strong>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
          <span>Date:</span>
          <span style={{ textAlign: 'right' }}>
            {formatDateTime(documentData.createdAt || new Date())}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
          <span>Customer:</span>
          <span style={{ textAlign: 'right' }}>
            {documentData.customerName || 'Walk-in Customer'}
          </span>
        </div>
      </div>

      <div className="thermal-divider" />

      {/* Items table */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '9.5px',
          marginBottom: '2px',
        }}
      >
        <span>Item / Qty x Rate</span>
        <span>Total</span>
      </div>

      <div className="thermal-divider" />

      <div>
        {items.map((item, idx) => {
          const qty = isReturn ? item.returnQuantity : item.quantity;
          const total = isReturn ? item.lineReturnTotal : item.lineTotal;
          return (
            <div key={`${item.productId}-${idx}`} style={{ marginBottom: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '10px' }}>{item.productName}</div>
              {settings.showBarcodeOnReceipt && item.barcode && (
                <div style={{ fontSize: '8.5px' }}>#{item.barcode}</div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '9.5px',
                  paddingLeft: '4px',
                }}
              >
                <span>
                  {qty} x {roundMoney(item.unitPrice)}
                </span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="thermal-divider" />

      {/* Totals */}
      {isReturn ? (
        <div style={{ fontSize: '10px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: '11.5px',
              marginTop: '2px',
            }}
          >
            <span>TOTAL REFUND</span>
            <span>{formatCurrency(documentData.totalReturnAmount, currency)}</span>
          </div>
          {documentData.reason && (
            <div style={{ fontSize: '9px', marginTop: '4px' }}>
              <strong>Reason:</strong> {documentData.reason}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span>{formatCurrency(documentData.subtotal, currency)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: '11.5px',
              marginTop: '3px',
              paddingTop: '2px',
              borderTop: '1px solid #000',
            }}
          >
            <span>GRAND TOTAL</span>
            <span>{formatCurrency(documentData.grandTotal, currency)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span>Paid</span>
            <span>{formatCurrency(documentData.paidAmount, currency)}</span>
          </div>
          {Number(documentData.remainingAmount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Remaining</span>
              <span>{formatCurrency(documentData.remainingAmount, currency)}</span>
            </div>
          )}
          {Number(documentData.changeAmount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Change</span>
              <span>{formatCurrency(documentData.changeAmount, currency)}</span>
            </div>
          )}
        </div>
      )}

      <div className="thermal-divider-solid" />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '4px' }}>
        {settings.invoiceFooter || 'Thank you for your business!'}
      </div>
    </div>
  );
}
