/**
 * Mathematically exact Barcode Validation Engine
 * Supports EAN-13 standard check-digits and Code 128 Character Set limits.
 */

/**
 * Calculates modulo-10 check digit for a 12-digit EAN-13 sequence
 * @param {string} numStr 
 * @returns {number} 13th checksum digit
 */
function calculateEan13Checksum(numStr) {
  const digits = numStr.slice(0, 12).split('').map(Number);
  if (digits.length < 12) return 0;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    // Alternating weights: 1 for odd index, 3 for even index (0-indexed logic: 0 is 1st, 1 is 2nd)
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  
  const nextTen = Math.ceil(sum / 10) * 10;
  return nextTen - sum;
}

/**
 * Validates EAN-13 format & checksum mathematical consistency
 * @param {string} barcode 
 * @returns {object} { isValid: boolean, error: string|null, checkDigit: number|null }
 */
function validateEAN13(barcode) {
  const clean = barcode.replace(/\D/g, '');
  
  if (clean.length !== 12 && clean.length !== 13) {
    return {
      isValid: false,
      error: 'EAN-13 barcode must be exactly 12 or 13 numerical digits.',
      checkDigit: null
    };
  }
  
  const expectedCheck = calculateEan13Checksum(clean);
  
  if (clean.length === 13) {
    const actualCheck = parseInt(clean[12]);
    if (actualCheck !== expectedCheck) {
      return {
        isValid: false,
        error: `Invalid EAN-13 check digit. Found: ${actualCheck}, Expected: ${expectedCheck}`,
        checkDigit: expectedCheck
      };
    }
  }
  
  return {
    isValid: true,
    error: null,
    checkDigit: expectedCheck
  };
}

/**
 * Validates Code 128 Subset B character consistency
 * Subset B permits standard printable ASCII (characters 32 to 126)
 * @param {string} barcode 
 * @returns {object} { isValid: boolean, error: string|null }
 */
function validateCode128(barcode) {
  if (!barcode || barcode.trim().length === 0) {
    return {
      isValid: false,
      error: 'Barcode value cannot be empty.'
    };
  }
  
  for (let i = 0; i < barcode.length; i++) {
    const code = barcode.charCodeAt(i);
    if (code < 32 || code > 126) {
      return {
        isValid: false,
        error: `Character '${barcode[i]}' at position ${i + 1} is invalid. Code 128 Subset B only supports standard printable ASCII characters (char codes 32 to 126).`
      };
    }
  }
  
  return {
    isValid: true,
    error: null
  };
}

module.exports = {
  calculateEan13Checksum,
  validateEAN13,
  validateCode128
};
