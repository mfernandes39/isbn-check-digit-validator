/**
 * ISBN check-digit core logic.
 *
 * Design choices made up front (stated plainly so the tests and README agree):
 *
 * - Input is normalised before any work happens: hyphens and ASCII spaces are
 *   stripped, and ASCII-uppercase is applied. This means "0-306-40615-2",
 *   "0 306 40615 2" and "0-306-40615-2" all map to the same canonical string.
 *   We deliberately do NOT strip other whitespace characters (tabs, newlines,
 *   NBSP) because doing so would let "0 306\n40615 2" pass, which is almost
 *   always a data-entry bug rather than a real ISBN. If a caller wants to trim
 *   those, they can .trim() themselves first.
 *
 * - "ISBN-10" and "ISBN-13" are detected by raw digit length AFTER normalisation
 *   (10 vs 13). The 'X' check digit of ISBN-10 is only permitted in the final
 *   position; an 'X' anywhere else is invalid. We do not try to be permissive
 *   about this — a leading or middle X is a corruption.
 *
 * - The check digit is computed from the first n-1 digits; the last character is
 *   always treated as the claimed check digit when validating, never fed back
 *   into the sum.
 *
 * - We never throw. Every public function returns a result object so callers
 *   can branch without try/catch. This was a trade-off: it makes the API a
 *   little more verbose than a throwing library, but it keeps the failure modes
 *   enumerable and testable.
 */

/**
 * @typedef {Object} IsbnResult
 * @property {boolean} valid      - True iff the supplied check digit is correct.
 * @property {string|null} normalized - The cleaned ISBN string, or null if normalisation failed.
 * @property {('isbn10'|'isbn13'|null)} type - Which ISBN family was detected.
 * @property {string|null} checkDigit - The computed correct check digit, or null if it couldn't be computed.
 * @property {string|null} suppliedCheckDigit - The check digit the caller supplied.
 * @property {string|null} error - A short machine-readable error code, or null.
 */

/**
 * Strip hyphens and spaces, and uppercase, so the parser sees one canonical form.
 * Returns null if the input contains characters we refuse to normalise away
 * (control chars, tabs, newlines) — we want those to fail loudly.
 *
 * @param {string} raw
 * @returns {string|null}
 */
export function normalize(raw) {
  if (typeof raw !== 'string') return null;
  if (raw.length === 0) return null;
  // Reject control characters and other whitespace we don't auto-strip.
  // This is the "awkward edge": a tab in the input will fail validation,
  // even though many ISBN libraries happily trim it.
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null; // control chars
  }
  return raw.replace(/[- ]/g, '').toUpperCase();
}

/**
 * Compute the ISBN-10 check digit. The ISBN-10 scheme is sum of d_i * (10 - i)
 * for i in 0..8, mod 11, with result 10 written as 'X'.
 *
 * @param {string} nineDigits - Exactly 9 digit characters.
 * @returns {string|null} The check digit character ('0'-'9' or 'X'), or null on malformed input.
 */
export function computeIsbn10CheckDigit(nineDigits) {
  if (typeof nineDigits !== 'string' || nineDigits.length !== 9) return null;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ch = nineDigits[i];
    if (ch < '0' || ch > '9') return null;
    const d = ch.charCodeAt(0) - 48;
    sum += d * (10 - i);
  }
  const r = (11 - (sum % 11)) % 11;
  return r === 10 ? 'X' : String(r);
}

/**
 * Compute the ISBN-13 check digit. The ISBN-13 scheme is alternating 1/3 weights,
 * sum mod 10, check digit = (10 - r) mod 10.
 *
 * @param {string} twelveDigits - Exactly 12 digit characters.
 * @returns {string|null} The check digit character ('0'-'9'), or null on malformed input.
 */
export function computeIsbn13CheckDigit(twelveDigits) {
  if (typeof twelveDigits !== 'string' || twelveDigits.length !== 12) return null;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const ch = twelveDigits[i];
    if (ch < '0' || ch > '9') return null;
    const d = ch.charCodeAt(0) - 48;
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Validate an ISBN-10 or ISBN-13 string.
 *
 * @param {string} raw
 * @returns {IsbnResult}
 */
export function validateIsbn(raw) {
  const normalized = normalize(raw);
  if (normalized === null) {
    return { valid: false, normalized: null, type: null, checkDigit: null, suppliedCheckDigit: null, error: 'normalize_failed' };
  }

  if (normalized.length === 10) {
    return validateIsbn10(normalized);
  }
  if (normalized.length === 13) {
    return validateIsbn13(normalized);
  }
  return { valid: false, normalized, type: null, checkDigit: null, suppliedCheckDigit: null, error: 'wrong_length' };
}

/**
 * Validate an ISBN-10 specifically. The input must normalise to exactly 10 chars;
 * the last may be 'X' (representing 10).
 *
 * @param {string} normalized
 * @returns {IsbnResult}
 */
export function validateIsbn10(normalized) {
  const supplied = normalized[9];
  // 'X' is only valid as the check digit, never in the payload.
  for (let i = 0; i < 9; i++) {
    if (normalized[i] < '0' || normalized[i] > '9') {
      return { valid: false, normalized, type: 'isbn10', checkDigit: null, suppliedCheckDigit: supplied, error: 'invalid_payload_char' };
    }
  }
  if (supplied !== 'X' && (supplied < '0' || supplied > '9')) {
    return { valid: false, normalized, type: 'isbn10', checkDigit: null, suppliedCheckDigit: supplied, error: 'invalid_check_digit_char' };
  }
  const computed = computeIsbn10CheckDigit(normalized.slice(0, 9));
  return {
    valid: computed !== null && computed === supplied,
    normalized,
    type: 'isbn10',
    checkDigit: computed,
    suppliedCheckDigit: supplied,
    error: computed === null ? 'compute_failed' : null,
  };
}

/**
 * Validate an ISBN-13 specifically. The input must normalise to exactly 13 digits.
 *
 * @param {string} normalized
 * @returns {IsbnResult}
 */
export function validateIsbn13(normalized) {
  const supplied = normalized[12];
  for (let i = 0; i < 13; i++) {
    if (normalized[i] < '0' || normalized[i] > '9') {
      return { valid: false, normalized, type: 'isbn13', checkDigit: null, suppliedCheckDigit: supplied, error: i === 12 ? 'invalid_check_digit_char' : 'invalid_payload_char' };
    }
  }
  const computed = computeIsbn13CheckDigit(normalized.slice(0, 12));
  return {
    valid: computed !== null && computed === supplied,
    normalized,
    type: 'isbn13',
    checkDigit: computed,
    suppliedCheckDigit: supplied,
    error: computed === null ? 'compute_failed' : null,
  };
}

/**
 * Given 9 digits (no check digit, no 'X'), return the full 10-char ISBN-10
 * with the correct check digit appended.
 *
 * @param {string} nineDigits
 * @returns {string|null}
 */
export function appendIsbn10CheckDigit(nineDigits) {
  const cd = computeIsbn10CheckDigit(nineDigits);
  if (cd === null) return null;
  return nineDigits + cd;
}

/**
 * Given 12 digits (no check digit), return the full 13-char ISBN-13 with the
 * correct check digit appended.
 *
 * @param {string} twelveDigits
 * @returns {string|null}
 */
export function appendIsbn13CheckDigit(twelveDigits) {
  const cd = computeIsbn13CheckDigit(twelveDigits);
  if (cd === null) return null;
  return twelveDigits + cd;
}
