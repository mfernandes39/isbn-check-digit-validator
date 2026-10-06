/**
 * Public entry point. Re-exports the ISBN check-digit helpers from core.js
 * so consumers import from one place.
 */
export {
  normalize,
  computeIsbn10CheckDigit,
  computeIsbn13CheckDigit,
  validateIsbn,
  validateIsbn10,
  validateIsbn13,
  appendIsbn10CheckDigit,
  appendIsbn13CheckDigit,
} from './core.js';
