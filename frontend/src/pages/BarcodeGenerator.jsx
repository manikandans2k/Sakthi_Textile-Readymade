import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import { Barcode, Printer, Plus, Grid, Layers, Download, Check } from 'lucide-react';

// ========================================================
// 1. MATHEMATICALLY EXACT BARCODE ENCODERS (PURE REACT/JS)
// ========================================================

// EAN-13 Digit Binary Maps
const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000011", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
];

// EAN-13 Checksum calculator
const calculateEan13Checksum = (numStr) => {
  const digits = numStr.slice(0, 12).split('').map(Number);
  if (digits.length < 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const nextTen = Math.ceil(sum / 10) * 10;
  return nextTen - sum;
};

// EAN-13 Binary string compiler
const encodeEAN13 = (codeStr) => {
  const clean = codeStr.replace(/\D/g, '').slice(0, 13);
  if (clean.length < 12) return null;
  
  // Calculate or append check digit
  const finalCode = clean.length === 12 
    ? clean + calculateEan13Checksum(clean) 
    : clean;

  const firstDigit = parseInt(finalCode[0]);
  const leftDigits = finalCode.slice(1, 7);
  const rightDigits = finalCode.slice(7, 13);
  
  const parityPattern = EAN_PARITY[firstDigit];
  
  let binary = "101"; // Left Guard

  // Left half
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(leftDigits[i]);
    const isL = parityPattern[i] === 'L';
    binary += isL ? EAN_L[digit] : EAN_G[digit];
  }

  binary += "01010"; // Center Guard

  // Right half
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(rightDigits[i]);
    binary += EAN_R[digit];
  }

  binary += "101"; // Right Guard
  return { binary, display: finalCode };
};

// Code 128 Subset B Width Maps
const CODE128_WIDTHS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "221222", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "233111" // 100-106
];

// Code 128 binary compiler
const encodeCode128B = (codeStr) => {
  if (!codeStr) return null;
  
  // Start symbol B (Index 104)
  let charIndices = [104];
  
  // Translate ASCII character to subset B index
  for (let i = 0; i < codeStr.length; i++) {
    const code = codeStr.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      charIndices.push(code - 32);
    } else {
      charIndices.push(0); // fallback for unsupported chars
    }
  }

  // Calculate Check Digit
  let checksum = charIndices[0];
  for (let i = 1; i < charIndices.length; i++) {
    checksum += charIndices[i] * i;
  }
  const checkDigit = checksum % 103;
  charIndices.push(checkDigit);

  // Stop character (Index 106)
  charIndices.push(106);

  // Compile to widths
  let binary = "";
  charIndices.forEach((idx, step) => {
    const widthStr = CODE128_WIDTHS[idx];
    for (let j = 0; j < widthStr.length; j++) {
      const width = parseInt(widthStr[j]);
      const value = j % 2 === 0 ? "1" : "0"; // Alternating black/white
      binary += value.repeat(width);
    }
  });

  // Final terminating bar of width 2
  binary += "11";
  
  return { binary, display: codeStr };
};

// ========================================================
// 2. VECTOR RENDER COMPONENT
// ========================================================
const VectorBarcode = ({ value, format, width = 2, height = 75 }) => {
  const enc = format === 'EAN13' ? encodeEAN13(value) : encodeCode128B(value);
  if (!enc) {
    return (
      <div className="text-danger p-3 border rounded text-center bg-light" style={{ fontSize: '0.8rem' }}>
        Invalid inputs for format: {format}
      </div>
    );
  }

  const { binary, display } = enc;
  const totalModules = binary.length;
  const svgWidth = totalModules * width;
  const pad = 15;

  return (
    <div className="text-center bg-white p-2 d-inline-block rounded border border-light">
      <svg width={svgWidth + pad * 2} height={height + 25} style={{ display: 'block', margin: '0 auto' }}>
        <g transform={`translate(${pad}, 5)`}>
          {binary.split('').map((val, idx) => {
            if (val === '0') return null;
            return (
              <rect
                key={idx}
                x={idx * width}
                y={0}
                width={width}
                height={height}
                fill="#000000"
              />
            );
          })}
        </g>
        <text 
          x={svgWidth / 2 + pad} 
          y={height + 20} 
          textAnchor="middle" 
          fontFamily="Poppins, sans-serif" 
          fontWeight="bold"
          fontSize="11" 
          letterSpacing="2"
          fill="#0F172A"
        >
          {display}
        </text>
      </svg>
    </div>
  );
};

// ========================================================
// 3. MAIN COMPONENT
// ========================================================
const BarcodeGenerator = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Custom properties
  const [barcodeVal, setBarcodeVal] = useState('8901001');
  const [barcodeFormat, setBarcodeFormat] = useState('Code128'); // Code128, EAN13
  const [printCopies, setPrintCopies] = useState(12); // Number of labels
  const [showPriceOnLabel, setShowPriceOnLabel] = useState(true);
  const [showNameOnLabel, setShowNameOnLabel] = useState(true);

  // Sticker size roll layout options
  const [labelSize, setLabelSize] = useState('sticker-2x1'); // sticker-2x1, sticker-3x2

  // Backend real-time validation status
  const [validationReport, setValidationReport] = useState({ isValid: true, error: null, checkDigit: null });
  const [validationLoading, setValidationLoading] = useState(false);
  
  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const validate = async () => {
      if (!barcodeVal) {
        setValidationReport({ isValid: false, error: 'Barcode value cannot be empty.', checkDigit: null });
        return;
      }
      setValidationLoading(true);
      try {
        const response = await axios.post('/barcodes/validate', {
          value: barcodeVal,
          format: barcodeFormat
        });
        setValidationReport({
          isValid: response.data.isValid,
          error: response.data.error,
          checkDigit: response.data.checkDigit
        });
      } catch (err) {
        console.error('Barcode validation error:', err);
        setValidationReport({
          isValid: false,
          error: err.response?.data?.message || 'Failed to connect to validation backend.',
          checkDigit: null
        });
      } finally {
        setValidationLoading(false);
      }
    };

    const delayDebounce = setTimeout(validate, 300);
    return () => clearTimeout(delayDebounce);
  }, [barcodeVal, barcodeFormat]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/products');
      setProducts(response.data);
      if (response.data.length > 0) {
        handleProductSelect(response.data[0]);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
    }
  };

  const handleProductSelect = (prod) => {
    setSelectedProduct(prod);
    setBarcodeVal(prod.barcode);
    
    // Auto-detect format from product barcode length
    const digitsOnly = prod.barcode.replace(/\D/g, '');
    if (digitsOnly.length >= 12 && digitsOnly.length <= 13) {
      setBarcodeFormat('EAN13');
    } else {
      setBarcodeFormat('Code128');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container-fluid py-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      
      {/* Dynamic Style Injection for printable sheets */}
      <style>{`
        @media print {
          /* Hide whole ERP system layout wrappers */
          body * {
            visibility: hidden;
          }
          #print-layout-area, #print-layout-area * {
            visibility: visible;
          }
          #print-layout-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #FFFFFF !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Page Header */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4 no-print">
        <div>
          <h1 className="h3 font-heading fw-bold m-0" style={{ color: '#0F172A' }}>
            Barcode Sticker Printer
          </h1>
          <p className="text-muted m-0" style={{ fontSize: '0.9rem' }}>
            Encode Code128 / EAN13 values into vector SVG stickers and configure batch print layouts.
          </p>
        </div>
        
        <button 
          className="btn text-white d-flex align-items-center gap-2 px-4 py-2 border-0 shadow-sm"
          style={{ backgroundColor: '#2563EB', borderRadius: '8px' }}
          onClick={handlePrint}
        >
          <Printer size={18} />
          <span className="fw-semibold">Print Label Sheet</span>
        </button>
      </div>

      <div className="row g-4 no-print">
        
        {/* Left Side: Parameters Form */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-3 p-4 bg-white mb-4">
            <h5 className="fw-bold font-heading text-dark mb-3.5 d-flex align-items-center gap-2">
              <Layers size={18} className="text-primary" />
              <span>Select Product to Print</span>
            </h5>
            
            <div className="mb-4">
              <label htmlFor="prod-select" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Choose Product</label>
              <select 
                id="prod-select"
                className="form-select py-2.5 border-light-subtle"
                style={{ borderRadius: '8px', fontSize: '0.9rem' }}
                value={selectedProduct ? selectedProduct.id : ''}
                onChange={(e) => {
                  const prod = products.find(p => p.id == e.target.value);
                  if (prod) handleProductSelect(prod);
                }}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <hr className="my-4 text-light-subtle" />

            <h5 className="fw-bold font-heading text-dark mb-3.5 d-flex align-items-center gap-2">
              <Grid size={18} className="text-primary" />
              <span>Custom Layout Configurations</span>
            </h5>

            <div className="row g-3">
              
              <div className="col-md-6 mb-3">
                <label htmlFor="bc-format" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Symbology Format</label>
                <select 
                  id="bc-format"
                  className="form-select py-2 border-light-subtle"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                  value={barcodeFormat}
                  onChange={(e) => setBarcodeFormat(e.target.value)}
                >
                  <option value="Code128">Code 128 Subset B (Alphanumeric)</option>
                  <option value="EAN13">EAN-13 Standard (12-13 Digits)</option>
                </select>
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="bc-copies" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Stickers Quantity</label>
                <input
                  id="bc-copies"
                  type="number"
                  className="form-control py-2 border-light-subtle"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div className="col-12 mb-3">
                <label htmlFor="bc-custom-val" className="form-label text-muted fw-semibold" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Custom Value Override</label>
                <input
                  id="bc-custom-val"
                  type="text"
                  className="form-control py-2 border-light-subtle"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                  value={barcodeVal}
                  onChange={(e) => setBarcodeVal(e.target.value)}
                />
                
                {/* Real-time backend validation feedback */}
                <div className="mt-2.5">
                  {validationLoading ? (
                    <div className="d-flex align-items-center gap-1.5 text-muted" style={{ fontSize: '0.8rem' }}>
                      <div className="spinner-border spinner-border-sm text-secondary" role="status" style={{ width: '12px', height: '12px' }} />
                      <span>Verifying symbology parities...</span>
                    </div>
                  ) : validationReport.isValid ? (
                    <div className="d-flex align-items-center gap-2 py-1.5 px-3 bg-success bg-opacity-10 border-0 rounded text-success" style={{ fontSize: '0.8rem' }}>
                      <Check size={14} className="text-success" />
                      <span className="fw-semibold">
                        Scan-Ready & Validated {barcodeFormat === 'EAN13' && validationReport.checkDigit !== null && `(Calculated check-digit: ${validationReport.checkDigit})`}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 bg-warning bg-opacity-10 border-0 rounded text-warning-emphasis" style={{ fontSize: '0.8rem' }}>
                      <span className="fw-bold d-block mb-0.5">⚠️ Symbology Check Warning:</span>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{validationReport.error}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="col-12">
                <div className="form-check mb-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="showNameChk"
                    checked={showNameOnLabel}
                    onChange={(e) => setShowNameOnLabel(e.target.checked)}
                  />
                  <label className="form-check-label text-dark fw-semibold" htmlFor="showNameChk" style={{ fontSize: '0.85rem' }}>
                    Print garments details on sticker header
                  </label>
                </div>

                <div className="form-check mb-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="showPriceChk"
                    checked={showPriceOnLabel}
                    onChange={(e) => setShowPriceOnLabel(e.target.checked)}
                  />
                  <label className="form-check-label text-dark fw-semibold" htmlFor="showPriceChk" style={{ fontSize: '0.85rem' }}>
                    Print retail price tag on label margins
                  </label>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Right Side: Live Interactive Mockup Sticker */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-3 p-4 bg-white text-center h-100 d-flex flex-column justify-content-center align-items-center">
            <h6 className="text-muted fw-bold font-heading text-uppercase mb-4" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              Sticker Visualizer (Thermal Tape Mockup)
            </h6>

            {/* Visual Sticker Card Container */}
            <div 
              className="p-4 bg-white border shadow-sm rounded d-flex flex-column align-items-center justify-content-center"
              style={{ 
                minWidth: '280px', 
                maxWidth: '320px', 
                border: '1.5px dashed #CBD5E1',
                borderRadius: '8px'
              }}
            >
              {showNameOnLabel && selectedProduct && (
                <div className="fw-bold font-heading mb-1 text-truncate" style={{ fontSize: '0.9rem', maxWidth: '240px', color: '#0F172A' }}>
                  {selectedProduct.name}
                </div>
              )}
              {selectedProduct && (
                <div className="text-muted fw-semibold font-heading mb-3" style={{ fontSize: '0.75rem' }}>
                  SKU: {selectedProduct.sku}
                </div>
              )}

              {/* crisp SVG vector render */}
              <VectorBarcode 
                value={barcodeVal} 
                format={barcodeFormat}
                width={2}
                height={70}
              />

              {showPriceOnLabel && selectedProduct && (
                <div className="fw-bold font-heading mt-3 text-dark" style={{ fontSize: '1rem' }}>
                  Retail: ₹{parseFloat(selectedProduct.price).toFixed(2)}
                </div>
              )}
            </div>

            <div className="mt-4 p-3 rounded bg-light border-0 text-start w-100" style={{ maxWidth: '420px', fontSize: '0.8rem' }}>
              <span className="fw-bold text-dark d-block mb-1">💡 Thermal Label Tips:</span>
              <span className="text-muted">Use standard 2 inch x 1 inch thermal sticky tags. SVG is scaling perfectly, preventing scanner reading errors caused by pixel scaling fuzziness.</span>
            </div>

          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 4. PRINTOUT ISOLATED STICKER SHEETS AREA */}
      {/* ======================================================== */}
      <div 
        id="print-layout-area" 
        className="d-none d-print-block"
      >
        <div className="row g-4" style={{ padding: '10px' }}>
          {Array.from({ length: printCopies }).map((_, idx) => (
            <div key={idx} className="col-4 mb-4 text-center">
              <div 
                className="p-3 bg-white text-center d-flex flex-column align-items-center justify-content-center"
                style={{ 
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  pageBreakInside: 'avoid',
                  width: '210px',
                  margin: '0 auto'
                }}
              >
                {showNameOnLabel && selectedProduct && (
                  <div className="fw-bold font-heading text-dark mb-0.5 text-truncate" style={{ fontSize: '11px', width: '180px' }}>
                    {selectedProduct.name}
                  </div>
                )}
                {selectedProduct && (
                  <div className="text-muted fw-semibold font-heading mb-2.5" style={{ fontSize: '9px' }}>
                    SKU: {selectedProduct.sku}
                  </div>
                )}

                <VectorBarcode 
                  value={barcodeVal} 
                  format={barcodeFormat}
                  width={1.6}
                  height={50}
                />

                {showPriceOnLabel && selectedProduct && (
                  <div className="fw-bold font-heading mt-2.5 text-dark" style={{ fontSize: '12px' }}>
                    MRP: ₹{parseFloat(selectedProduct.price).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default BarcodeGenerator;
