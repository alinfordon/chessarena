export function sanitizeText(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return '';
  let clean = text
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  return clean;
}

export function isValidId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(id);
}

export function isPositiveInteger(n) {
  return Number.isInteger(n) && n > 0;
}

export function validateTimeControl(initialTime, increment) {
  const errors = [];
  if (!isPositiveInteger(initialTime)) {
    errors.push('Initial time must be a positive integer (seconds)');
  }
  if (!Number.isInteger(increment) || increment < 0) {
    errors.push('Increment must be a non-negative integer (seconds)');
  }
  return errors;
}
