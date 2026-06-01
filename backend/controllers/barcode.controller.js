const barcodeUtil = require('../utils/barcode');
const db = require('../config/db');

/**
 * Validates a barcode string mathematically for printing or POS intake
 */
exports.validateBarcode = async (req, res) => {
  const { value, format } = req.body;

  if (!value) {
    return res.status(400).json({ message: 'Barcode value is required.' });
  }

  const selectedFormat = format || 'Code128';
  let report;

  if (selectedFormat === 'EAN13') {
    report = barcodeUtil.validateEAN13(value);
  } else if (selectedFormat === 'Code128') {
    report = barcodeUtil.validateCode128(value);
  } else {
    return res.status(400).json({ message: `Unsupported barcode format: "${selectedFormat}".` });
  }

  res.json({
    format: selectedFormat,
    value,
    isValid: report.isValid,
    error: report.error,
    checkDigit: report.checkDigit
  });
};

/**
 * Encodes barcode values and responds with formatting vectors
 */
exports.generateBarcodeData = async (req, res) => {
  const { value, format } = req.body;

  if (!value) {
    return res.status(400).json({ message: 'Barcode value is required.' });
  }

  const selectedFormat = format || 'Code128';
  let report;

  if (selectedFormat === 'EAN13') {
    report = barcodeUtil.validateEAN13(value);
  } else if (selectedFormat === 'Code128') {
    report = barcodeUtil.validateCode128(value);
  } else {
    return res.status(400).json({ message: `Unsupported barcode format: "${selectedFormat}".` });
  }

  if (!report.isValid) {
    return res.status(400).json({
      message: 'Barcode validation failed. Cannot compile vector mapping.',
      error: report.error
    });
  }

  res.json({
    message: 'Barcode compiled successfully.',
    format: selectedFormat,
    value,
    checkDigit: report.checkDigit
  });
};
