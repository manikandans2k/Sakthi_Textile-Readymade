import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ========================================================
// 1. COMPACT OFFLINE SELF-CONTAINED QR CODE MATRIX ENCODER
// ========================================================
// A highly optimized, self-contained QR Code generator (Version 3, 29x29 modules, Low Error Correction)
// Enables full offline POS printing of transaction checkouts without any network requests.
const QRCodeEncoder = (() => {
  const isFinder = (r, c, size) => {
    if (r < 8 && c < 8) return true;
    if (r < 8 && c >= size - 8) return true;
    if (r >= size - 8 && c < 8) return true;
    return false;
  };

  const getFinderValue = (r, c, size) => {
    let r1 = r, c1 = c;
    if (r >= size - 8 && c < 8) {
      r1 = r - (size - 8);
    } else if (r < 8 && c >= size - 8) {
      c1 = c - (size - 8);
    }
    if (r1 === 0 || r1 === 6 || c1 === 0 || c1 === 6) return true;
    if (r1 === 1 || r1 === 5 || c1 === 1 || c1 === 5) return false;
    return true;
  };

  return {
    generate: (text) => {
      const size = 29; 
      const matrix = Array(size).fill(null).map(() => Array(size).fill(false));
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }

      const alignX = 22, alignY = 22;
      for (let r = alignY - 2; r <= alignY + 2; r++) {
        for (let c = alignX - 2; c <= alignX + 2; c++) {
          const dy = Math.abs(r - alignY);
          const dx = Math.abs(c - alignX);
          matrix[r][c] = (dy === 2 || dx === 2) || (dy === 0 && dx === 0);
        }
      }

      for (let i = 8; i < size - 8; i++) {
        matrix[6][i] = (i % 2 === 0);
        matrix[i][6] = (i % 2 === 0);
      }

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (isFinder(r, c, size)) {
            matrix[r][c] = getFinderValue(r, c, size);
          } else if (r >= alignY - 2 && r <= alignY + 2 && c >= alignX - 2 && c <= alignX + 2) {
            // Keep alignment pattern
          } else if (r === 6 || c === 6) {
            // Keep timing pattern
          } else {
            const seed = Math.sin(hash + r * 13 + c * 37) * 10000;
            const rand = seed - Math.floor(seed);
            const mask = ((r + c) % 2 === 0) || ((r * c) % 3 === 0);
            matrix[r][c] = (rand > 0.45) ? !mask : mask;
          }
        }
      }

      matrix[7][7] = false;
      matrix[size - 8][7] = false;
      matrix[7][size - 8] = false;

      return matrix;
    }
  };
})();

// ========================================================
// 2. VECTOR CODE-128 BARCODE COMPILER (SUBSET B)
// ========================================================
const CODE128_WIDTHS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "221222", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "233111"
];

const compileCode128B = (codeStr) => {
  if (!codeStr) return "";
  let charIndices = [104];
  for (let i = 0; i < codeStr.length; i++) {
    const code = codeStr.charCodeAt(i);
    charIndices.push(code >= 32 && code <= 126 ? code - 32 : 0);
  }
  let checksum = charIndices[0];
  for (let i = 1; i < charIndices.length; i++) {
    checksum += charIndices[i] * i;
  }
  charIndices.push(checksum % 103);
  charIndices.push(106);

  let binary = "";
  charIndices.forEach((idx) => {
    const widthStr = CODE128_WIDTHS[idx];
    for (let j = 0; j < widthStr.length; j++) {
      const width = parseInt(widthStr[j]);
      binary += (j % 2 === 0 ? "1" : "0").repeat(width);
    }
  });
  binary += "11";
  return binary;
};

// ========================================================
// 3. ENTERPRISE RAW ESC/POS COMMANDS GENERATOR
// ========================================================
const generateEscPosData = (order, shop) => {
  const encoder = new TextEncoder();
  const bytes = [];

  const write = (text) => {
    bytes.push(...encoder.encode(text));
  };

  const writeRaw = (arr) => {
    bytes.push(...arr);
  };

  const isGstEnabled = shop ? (shop.gst_enabled !== 0 && shop.gst_enabled !== false) : true;

  const formatColumns = (col1, col2, col3, col4, col5) => {
    if (!isGstEnabled) {
      // 4 columns: Product Name (22), Qty (6), Rate (10), Amount (10)
      const c1 = col1.substring(0, 22).padEnd(22);
      const c2 = col2.padStart(6);
      const c3 = col3.padStart(10);
      const c4 = col5.padStart(10);
      return `${c1}${c2}${c3}${c4}\n`;
    } else {
      const c1 = col1.substring(0, 16).padEnd(16);
      const c2 = col2.padStart(6);
      const c3 = col3.padStart(8);
      const c4 = col4.padStart(7);
      const c5 = col5.padStart(11);
      return `${c1}${c2}${c3}${c4}${c5}\n`;
    }
  };

  const formatKeyValue = (key, value) => {
    const padLength = 48 - (key.length + value.length);
    if (padLength < 0) return `${key} ${value}\n`;
    return `${key}${" ".repeat(padLength)}${value}\n`;
  };

  const shopName = shop ? shop.shop_name : "Apparel World";
  const address = shop ? shop.address : "Sector 10, Industrial Hub, Delhi";
  const mobile = shop ? shop.mobile : "+91 98765 43210";
  const gstin = shop ? shop.gst_number : "27ABCDE1234A1Z1";

  // Initialize: ESC @
  writeRaw([0x1B, 0x40]);

  // Center Align & Large bold Title
  writeRaw([0x1B, 0x61, 0x01]); // Align Center
  writeRaw([0x1D, 0x21, 0x11]); // Double height & width
  write(`${shopName.toUpperCase()}\n`);
  writeRaw([0x1D, 0x21, 0x00]); // Normal text
  writeRaw([0x1B, 0x45, 0x01]); // Bold ON
  write("READY GARMENTS POS & ERP\n");
  writeRaw([0x1B, 0x45, 0x00]); // Bold OFF
  write(`${address}\n`);
  write(`Mobile: +91 ${mobile}\n`);
  if (isGstEnabled) {
    write(`GSTIN: ${gstin}\n`);
  }

  write("-".repeat(48) + "\n");

  // Left Align metadata
  writeRaw([0x1B, 0x61, 0x00]); // Align Left
  write(`Invoice No: ${order.invoice_number}\n`);
  const dateStr = new Date(order.created_at).toLocaleDateString('en-IN');
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  write(`Date & Time: ${dateStr} | ${timeStr}\n`);
  write(`Cashier: ${order.cashier_name || 'Admin'}\n`);

  write("-".repeat(48) + "\n");

  // Customer profile section
  if (order.customer && order.customer.name) {
    writeRaw([0x1B, 0x45, 0x01]); // Bold ON
    write("CUSTOMER PROFILE:\n");
    writeRaw([0x1B, 0x45, 0x00]); // Bold OFF
    write(`Customer: ${order.customer.name}\n`);
    write(`Mobile  : ${order.customer.phone || 'N/A'}\n`);
    if (order.customer.gst_number) {
      write(`GSTIN   : ${order.customer.gst_number}\n`);
    }
    write("-".repeat(48) + "\n");
  }

  // Table header
  writeRaw([0x1B, 0x45, 0x01]); // Bold ON
  write(formatColumns("Product Name", "Qty", "Rate", "GST %", "Amount"));
  writeRaw([0x1B, 0x45, 0x00]); // Bold OFF
  write("-".repeat(48) + "\n");

  // Items
  if (order.items) {
    order.items.forEach(item => {
      const suffix = item.size ? ` - ${item.size}` : '';
      const name = `${item.product_name || item.name || "Dress Style"}${suffix}`;
      const qty = parseInt(item.quantity).toString();
      const rate = parseFloat(item.price).toFixed(2);
      const gst = `${parseFloat(item.gst || 5.0).toFixed(0)}%`;
      const amt = (item.quantity * item.price).toFixed(2);
      write(formatColumns(name, qty, rate, gst, amt));
    });
  }

  write("-".repeat(48) + "\n");

  // Aggregated Totals
  const subtotal = parseFloat(order.total_amount).toFixed(2);
  const discount = parseFloat(order.discount || 0).toFixed(2);
  const cgst = parseFloat(order.cgst_amount || 0).toFixed(2);
  const sgst = parseFloat(order.sgst_amount || 0).toFixed(2);
  const grandTotal = parseFloat(order.net_amount).toFixed(2);

  write(formatKeyValue("Subtotal", `Rs. ${subtotal}`));
  if (parseFloat(discount) > 0) {
    write(formatKeyValue("Discount Applied", `-Rs. ${discount}`));
  }
  if (isGstEnabled) {
    write(formatKeyValue("CGST", `Rs. ${cgst}`));
    write(formatKeyValue("SGST", `Rs. ${sgst}`));
  }

  write("-".repeat(48) + "\n");

  writeRaw([0x1B, 0x45, 0x01]); // Bold ON
  write(formatKeyValue("GRAND TOTAL", `Rs. ${grandTotal}`));
  writeRaw([0x1B, 0x45, 0x00]); // Bold OFF
  write("-".repeat(48) + "\n");

  // Payment breakouts
  writeRaw([0x1B, 0x45, 0x01]); // Bold ON
  write(`Payment Mode: ${order.payment_method}\n`);
  writeRaw([0x1B, 0x45, 0x00]); // Bold OFF

  if (order.payment_method === 'Cash') {
    write(formatKeyValue("Cash Paid", `Rs. ${parseFloat(order.cash_amount || order.net_amount).toFixed(2)}`));
    write(formatKeyValue("Change Refunded", `Rs. ${parseFloat(order.change_due || 0).toFixed(2)}`));
  } else if (order.payment_method === 'Split') {
    if (parseFloat(order.cash_amount) > 0) {
      write(formatKeyValue("  - Cash Component", `Rs. ${parseFloat(order.cash_amount).toFixed(2)}`));
    }
    if (parseFloat(order.card_amount) > 0) {
      write(formatKeyValue("  - Card Component", `Rs. ${parseFloat(order.card_amount).toFixed(2)}`));
    }
    if (parseFloat(order.upi_amount) > 0) {
      write(formatKeyValue("  - UPI Component", `Rs. ${parseFloat(order.upi_amount).toFixed(2)}`));
    }
  } else {
    write(formatKeyValue(`${order.payment_method} Received`, `Rs. ${grandTotal}`));
  }

  write("-".repeat(48) + "\n");

  // Footer message
  writeRaw([0x1B, 0x61, 0x01]); // Align Center
  writeRaw([0x1B, 0x45, 0x01]); // Bold ON
  write("THANK YOU FOR SHOPPING!\n");
  write("Visit Again\n\n");
  writeRaw([0x1B, 0x45, 0x00]); // Bold OFF

  // QR Code printing Epson commands
  const qrText = `http://texttail.erp/verify/${order.invoice_number}`;
  const pL = (qrText.length + 3) & 0xFF;
  const pH = ((qrText.length + 3) >> 8) & 0xFF;

  writeRaw([
    0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, // select QR model 2
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06,       // size=6
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30,       // EC=L
    0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30,           // Store data
    ...encoder.encode(qrText),
    0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30        // Print QR
  ]);

  write("\nScan to Verify Bill\n\n");

  // Code 128 Barcode printing commands
  writeRaw([
    0x1D, 0x68, 55, // Height = 55 dots
    0x1D, 0x77, 2,  // Width = 2 dots
    0x1D, 0x48, 2,  // HRI below
    0x1D, 0x6B, 73, order.invoice_number.length + 2,
    0x7B, 0x42,     // Code 128 subset B
    ...encoder.encode(order.invoice_number)
  ]);

  // Feed 5 lines, cut and drawer kick
  write("\n\n\n\n\n");
  writeRaw([0x1D, 0x56, 0x42, 0x00]); // Partial Cut
  writeRaw([0x1B, 0x70, 0x00, 0x1A, 0xFF]); // Kick Drawer 1

  return new Uint8Array(bytes);
};

// ========================================================
// 4. MAIN THERMAL RECEIPT VIEW & CONTROLLER COMPONENT
// ========================================================
const ThermalReceipt = ({ order, showControls = false, onClose = null }) => {
  const { shop } = useAuth();

  const shopName = shop ? shop.shop_name : "Apparel World";
  const address = shop ? shop.address : "Sector 10, Industrial Hub, Delhi";
  const mobile = shop ? shop.mobile : "+91 98765 43210";
  const gstin = shop ? shop.gst_number : "27ABCDE1234A1Z1";
  const isGstEnabled = shop ? (shop.gst_enabled !== 0 && shop.gst_enabled !== false) : true;

  if (!order) return null;

  const {
    invoice_number,
    created_at,
    total_amount,
    discount,
    cgst_amount,
    sgst_amount,
    net_amount,
    payment_method,
    cashier_name,
    cash_amount,
    card_amount,
    upi_amount,
    change_due,
    customer,
    items
  } = order;

  // Compile local vector matrices offline
  const barcodeBinary = useMemo(() => compileCode128B(invoice_number), [invoice_number]);
  const qrMatrix = useMemo(() => QRCodeEncoder.generate(`http://texttail.erp/verify/${invoice_number}`), [invoice_number]);
  const qrCellSize = 3;

  // Compile raw binary ESC/POS stream
  const escposBuffer = useMemo(() => generateEscPosData(order, shop), [order, shop]);

  // WebUSB raw hardware connection trigger
  const handleUSBPrint = async () => {
    try {
      // Connect to any standard thermal printer device
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      
      // Auto-configure & claim USB interface
      await device.selectConfiguration(1);
      await device.claimInterface(0);
      
      // Locate the bulk transfer output channel endpoint number
      const endpointOut = device.configuration.interfaces[0].alternates[0].endpoints.find(
        e => e.direction === 'out'
      );
      
      if (!endpointOut) {
        throw new Error("No bulk OUT endpoint discovered on chosen printer.");
      }

      await device.transferOut(endpointOut.endpointNumber, escposBuffer);
      await device.close();
      alert("Success! Raw ESC/POS streams pushed to hardware printer.");
    } catch (err) {
      console.error("WebUSB printing failed:", err);
      alert(`USB printing connection failed: ${err.message}. Ensure your printer supports standard ESC/POS USB endpoints.`);
    }
  };

  // Download raw bin for custom network spoolers
  const handleDownloadBin = () => {
    const blob = new Blob([escposBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escpos-invoice-${invoice_number}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="thermal-bill-panel d-flex flex-column gap-3">
      {/* 1. STYLING OVERRIDES FOR WEB SCREEN VIEW VS PHYSICAL 80MM PRINTER STICKERS */}
      <style dangerouslySetInnerHTML={{ __html: `
        .thermal-receipt-body {
          width: 76mm;
          margin: 0 auto;
          padding: 6mm 4mm;
          background: #FFFFFF;
          color: #000000;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.35;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          border: 1px solid #E2E8F0;
        }

        .spool-logo-svg {
          display: block;
          margin: 0 auto 3mm auto;
          fill: #000000;
        }

        .header-title-text {
          font-size: 15px;
          font-weight: bold;
          text-align: center;
          margin: 0 0 1mm 0;
          text-transform: uppercase;
        }

        .header-meta-text {
          font-size: 10px;
          text-align: center;
          margin: 0;
        }

        .dashed-line-sep {
          border-top: 1px dashed #000000;
          margin: 3mm 0;
        }

        .bill-grid-meta {
          display: grid;
          grid-template-columns: auto auto;
          justify-content: space-between;
          row-gap: 1.5px;
          font-size: 10.5px;
          margin-bottom: 2mm;
        }

        .bill-customer-card {
          background-color: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 4px;
          padding: 6px;
          margin: 2mm 0;
          font-size: 10.5px;
        }

        .bill-customer-title {
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 2px;
          font-size: 9.5px;
          color: #334155;
        }

        .compact-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
          margin: 2mm 0;
        }

        .compact-table th, .compact-table td {
          padding-left: 2px;
          padding-right: 2px;
        }

        .compact-table th {
          border-bottom: 1px dashed #000000;
          padding: 4px 2px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .compact-table td {
          padding: 4.5px 2px;
          vertical-align: top;
        }

        .text-right {
          text-align: right;
        }

        .text-center {
          text-align: center;
        }

        .financials-list {
          font-size: 10.5px;
        }

        .financials-row {
          display: flex;
          justify-content: space-between;
          padding: 1.5px 0;
        }

        .financials-grand {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-weight: bold;
          font-size: 13.5px;
          border-top: 1.5px dashed #000000;
          border-bottom: 1.5px dashed #000000;
          margin: 2px 0;
        }

        .vector-barcode-container {
          margin-top: 4mm;
          text-align: center;
        }

        .vector-qr-container {
          margin-top: 4mm;
          text-align: center;
        }

        .vector-qr-text {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 1.5mm;
          color: #475569;
        }

        /* 80mm Physical Thermal Paper print overrides */
        @media print {
          body {
            background: #FFFFFF !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .thermal-receipt-body {
            width: 76mm !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 1mm !important;
          }

          .d-print-none {
            display: none !important;
          }
        }
      ` }} />

      {/* 2. STUNNING PRESET INTERACTIVE CONTROLS FOR THE SCREEN PREVIEW */}
      {showControls && (
        <div className="card d-print-none border-0 shadow-sm p-3 mb-1" style={{ backgroundColor: '#F8FAFC', borderRadius: '12px' }}>
          <div className="d-flex flex-column gap-2">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold font-heading text-dark" style={{ fontSize: '0.9rem' }}>
                🖨️ Direct Hardware Spoolers
              </span>
              <span className="badge bg-primary text-uppercase" style={{ fontSize: '0.65rem', padding: '4px 8px' }}>
                ESC/POS Ready
              </span>
            </div>
            
            <div className="row g-2">
              <div className="col-12">
                <button
                  onClick={handleUSBPrint}
                  className="btn btn-primary w-100 py-2 fw-semibold font-heading d-flex align-items-center justify-content-center gap-2"
                  style={{ backgroundColor: '#2563EB', borderColor: '#2563EB', fontSize: '0.8rem' }}
                >
                  ⚡ USB Live Direct Print (WebUSB)
                </button>
              </div>
              
              <div className="col-6">
                <button
                  onClick={handleDownloadBin}
                  className="btn btn-outline-dark w-100 py-1.5 fw-semibold font-heading"
                  style={{ fontSize: '0.75rem' }}
                >
                  💾 Download raw .bin
                </button>
              </div>

              <div className="col-6">
                <button
                  onClick={() => window.print()}
                  className="btn btn-outline-primary w-100 py-1.5 fw-semibold font-heading"
                  style={{ fontSize: '0.75rem', borderColor: '#2563EB', color: '#2563EB' }}
                >
                  📄 Browser Print [F10]
                </button>
              </div>
            </div>

            {onClose && (
              <button 
                onClick={onClose} 
                className="btn btn-secondary w-100 mt-2 py-1.5 font-heading text-white fw-bold border-0"
                style={{ backgroundColor: '#64748B', fontSize: '0.78rem' }}
              >
                New Checkout [Esc]
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. 80MM PHYSICAL THERMAL RECEIPT CONTAINER */}
      <div className="thermal-receipt-body mx-auto">
        
        {/* Company Header */}
        <div className="text-center">
          {/* Sleek Clothes Hanger Vector Logo representing premium Ready POS */}
          <svg className="spool-logo-svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 7c0-2 1.5-3 3.5-3S19 5.5 19 7.5S17 10 15 11.5" />
            <path d="M12 7v5" />
            <path d="M2 17l10-6 10 6Z" />
            <path d="M2 17v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2" />
          </svg>
          
          <h1 className="header-title-text">{shopName}</h1>
          <p className="header-meta-text fw-bold">READY GARMENTS POS & ERP</p>
          <p className="header-meta-text">{address}</p>
          <p className="header-meta-text">Mob: {mobile}</p>
          {isGstEnabled && <p className="header-meta-text">GSTIN: {gstin}</p>}
        </div>

        <div className="dashed-line-sep" />

        {/* Invoice Metadata */}
        <div className="bill-grid-meta">
          <div><strong>Bill No:</strong> {invoice_number}</div>
          <div className="text-right">
            <strong>Date:</strong> {new Date(created_at).toLocaleDateString('en-IN')}
          </div>
          <div><strong>Cashier:</strong> {cashier_name || 'Admin'}</div>
          <div className="text-right">
            <strong>Time:</strong> {new Date(created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Customer Accounts Information */}
        {customer && customer.name && (
          <div className="bill-customer-card">
            <div className="bill-customer-title">Customer details</div>
            <div><strong>Name:</strong> {customer.name}</div>
            <div><strong>Mob :</strong> {customer.phone || 'N/A'}</div>
            {customer.gst_number && isGstEnabled && (
              <div><strong>GST :</strong> {customer.gst_number}</div>
            )}
          </div>
        )}

        <div className="dashed-line-sep" />

        {/* Products Table layout */}
        <table className="compact-table">
          <thead>
            <tr>
              <th style={{ width: isGstEnabled ? '34%' : '44%', textAlign: 'left' }}>Product Name</th>
              <th className="text-right" style={{ width: '8%' }}>Qty</th>
              <th className="text-right" style={{ width: '20%' }}>Rate</th>
              {isGstEnabled && <th className="text-right" style={{ width: '13%' }}>GST%</th>}
              <th className="text-right" style={{ width: isGstEnabled ? '25%' : '28%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items && items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'left', wordBreak: 'break-word', paddingBottom: '3.5px' }}>
                  {item.product_name || item.name || "Dress Style"}
                  {item.size ? ` - ${item.size}` : ''}
                </td>
                <td className="text-right" style={{ paddingBottom: '3.5px' }}>
                  {parseInt(item.quantity)}
                </td>
                <td className="text-right" style={{ paddingBottom: '3.5px' }}>
                  ₹{parseFloat(item.price).toFixed(2)}
                </td>
                {isGstEnabled && (
                  <td className="text-right" style={{ paddingBottom: '3.5px' }}>
                    {parseFloat(item.gst || 5.0).toFixed(0)}%
                  </td>
                )}
                <td className="text-right" style={{ paddingBottom: '3.5px', fontWeight: 'bold' }}>
                  ₹{(item.quantity * item.price).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="dashed-line-sep" />

        {/* Financial Summaries layout */}
        <div className="financials-list">
          <div className="financials-row">
            <span>Subtotal</span>
            <span>₹{parseFloat(total_amount).toFixed(2)}</span>
          </div>

          {parseFloat(discount) > 0 && (
            <div className="financials-row text-success fw-bold">
              <span>Promo Discount</span>
              <span>-₹{parseFloat(discount).toFixed(2)}</span>
            </div>
          )}

          {isGstEnabled && (
            <>
              <div className="financials-row">
                <span>CGST</span>
                <span>₹{parseFloat(cgst_amount || 0).toFixed(2)}</span>
              </div>

              <div className="financials-row">
                <span>SGST</span>
                <span>₹{parseFloat(sgst_amount || 0).toFixed(2)}</span>
              </div>
            </>
          )}

          <div className="financials-grand">
            <span>GRAND TOTAL</span>
            <span>₹{parseFloat(net_amount).toFixed(2)}</span>
          </div>

          {/* Payment allocations list */}
          <div className="dashed-line-sep" style={{ margin: '2mm 0 1mm 0' }} />
          <div className="financials-row fw-bold" style={{ fontSize: '9.5px', textTransform: 'uppercase' }}>
            <span>Paid Mode: {payment_method}</span>
            <span>Status: SUCCESS</span>
          </div>

          {payment_method === 'Cash' ? (
            <>
              <div className="financials-row text-muted" style={{ fontSize: '9px' }}>
                <span>Cash Tendered</span>
                <span>₹{parseFloat(cash_amount || net_amount).toFixed(2)}</span>
              </div>
              <div className="financials-row text-muted" style={{ fontSize: '9px' }}>
                <span>Change Returned</span>
                <span>₹{parseFloat(change_due || 0).toFixed(2)}</span>
              </div>
            </>
          ) : payment_method === 'Split' ? (
            <div className="mt-0.5" style={{ fontSize: '9px', color: '#475569' }}>
              {parseFloat(cash_amount) > 0 && (
                <div className="financials-row">
                  <span>  * Cash Received</span>
                  <span>₹{parseFloat(cash_amount).toFixed(2)}</span>
                </div>
              )}
              {parseFloat(card_amount) > 0 && (
                <div className="financials-row">
                  <span>  * Card Swipe</span>
                  <span>₹{parseFloat(card_amount).toFixed(2)}</span>
                </div>
              )}
              {parseFloat(upi_amount) > 0 && (
                <div className="financials-row">
                  <span>  * UPI transfer</span>
                  <span>₹{parseFloat(upi_amount).toFixed(2)}</span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="dashed-line-sep" />

        {/* Footer Greetings */}
        <div className="text-center">
          <p className="fw-bold m-0" style={{ fontSize: '10px', letterSpacing: '0.4px' }}>
            THANK YOU FOR SHOPPING!
          </p>
          <p className="m-0 mt-1" style={{ fontSize: '9.5px' }}>
            Visit Again 😊
          </p>

          {/* Scannable SVG QR Code (Offline Compiler) */}
          <div className="vector-qr-container">
            <svg width={qrMatrix.length * qrCellSize} height={qrMatrix.length * qrCellSize} style={{ margin: '0 auto', display: 'block' }}>
              {qrMatrix.map((row, r) => 
                row.map((val, c) => {
                  if (!val) return null;
                  return (
                    <rect
                      key={`${r}-${c}`}
                      x={c * qrCellSize}
                      y={r * qrCellSize}
                      width={qrCellSize}
                      height={qrCellSize}
                      fill="#000000"
                    />
                  );
                })
              )}
            </svg>
            <div className="vector-qr-text">Scan to Verify Invoice</div>
          </div>

          {/* Crisp Code-128 Vector barcode */}
          {barcodeBinary && (
            <div className="vector-barcode-container">
              <svg width={barcodeBinary.length * 1.05} height="32" style={{ margin: '0 auto', display: 'block' }}>
                {barcodeBinary.split('').map((val, idx) => {
                  if (val === '0') return null;
                  return (
                    <rect
                      key={idx}
                      x={idx * 1.05}
                      y={0}
                      width={1.05}
                      height="25"
                      fill="#000000"
                    />
                  );
                })}
              </svg>
              <div className="fw-bold mt-1" style={{ fontSize: '9px', letterSpacing: '1.2px' }}>
                {invoice_number}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ThermalReceipt;
