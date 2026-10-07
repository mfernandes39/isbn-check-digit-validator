import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  computeIsbn10CheckDigit,
  computeIsbn13CheckDigit,
  validateIsbn,
  validateIsbn10,
  validateIsbn13,
  appendIsbn10CheckDigit,
  appendIsbn13CheckDigit,
} from '../src/index.js';

// --- normalize ---------------------------------------------------------------

test('normalize strips hyphens and spaces and uppercases', () => {
  assert.equal(normalize('0-306-40615-2'), '0306406152');
  assert.equal(normalize('0 306 40615 2'), '0306406152');
  assert.equal(normalize('0-306-40615-x'), '030640615X');
});

test('normalize rejects non-strings and empty input', () => {
  assert.equal(normalize(null), null);
  assert.equal(normalize(undefined), null);
  assert.equal(normalize(123), null);
  assert.equal(normalize(''), null);
});

test('normalize rejects control characters including tab and newline', () => {
  // This is the awkward edge: we deliberately do NOT trim tabs/newlines.
  assert.equal(normalize('0\t306'), null);
  assert.equal(normalize('0\n306'), null);
  assert.equal(normalize('0\r306'), null);
});

// --- computeIsbn10CheckDigit ------------------------------------------------

test('computeIsbn10CheckDigit returns X for sum mod 11 == 10', () => {
  // 0-306-40615-? is the classic textbook example, check digit is 2.
  assert.equal(computeIsbn10CheckDigit('030640615'), '2');
  // 0-8044-2957-? → X (well-known example from the spec)
  assert.equal(computeIsbn10CheckDigit('080442957'), 'X');
});

test('computeIsbn10CheckDigit returns null on wrong length or non-digits', () => {
  assert.equal(computeIsbn10CheckDigit('03064061'), null); // too short
  assert.equal(computeIsbn10CheckDigit('0306406152'), null); // too long
  assert.equal(computeIsbn10CheckDigit('03064X615'), null); // X in payload
  assert.equal(computeIsbn10CheckDigit('03064a615'), null); // letter
});

// --- computeIsbn13CheckDigit ------------------------------------------------

test('computeIsbn13CheckDigit matches the standard example', () => {
  // 978-0-306-40615-? → 7
  assert.equal(computeIsbn13CheckDigit('978030640615'), '7');
});

test('computeIsbn13CheckDigit returns null on malformed input', () => {
  assert.equal(computeIsbn13CheckDigit('97803064061'), null); // 11
  assert.equal(computeIsbn13CheckDigit('9780306406157'), null); // 13
  assert.equal(computeIsbn13CheckDigit('97803064061a'), null); // letter
});

// --- validateIsbn (dispatch by length) --------------------------------------

test('validateIsbn dispatches to isbn10 for length 10', () => {
  const r = validateIsbn('0-306-40615-2');
  assert.equal(r.valid, true);
  assert.equal(r.type, 'isbn10');
  assert.equal(r.normalized, '0306406152');
  assert.equal(r.checkDigit, '2');
  assert.equal(r.suppliedCheckDigit, '2');
  assert.equal(r.error, null);
});

test('validateIsbn dispatches to isbn13 for length 13', () => {
  const r = validateIsbn('978-0-306-40615-7');
  assert.equal(r.valid, true);
  assert.equal(r.type, 'isbn13');
  assert.equal(r.normalized, '9780306406157');
  assert.equal(r.checkDigit, '7');
  assert.equal(r.error, null);
});

test('validateIsbn returns wrong_length for non-10/13 lengths', () => {
  const r = validateIsbn('030640615');
  assert.equal(r.valid, false);
  assert.equal(r.type, null);
  assert.equal(r.error, 'wrong_length');
  assert.equal(r.normalized, '030640615');
});

test('validateIsbn rejects tab-containing input at the normalize step', () => {
  const r = validateIsbn('0\t306406152');
  assert.equal(r.valid, false);
  assert.equal(r.normalized, null);
  assert.equal(r.error, 'normalize_failed');
});

// --- validateIsbn10 ----------------------------------------------------------

test('validateIsbn10 accepts a correct X check digit', () => {
  const r = validateIsbn10('080442957X');
  assert.equal(r.valid, true);
  assert.equal(r.checkDigit, 'X');
  assert.equal(r.suppliedCheckDigit, 'X');
});

test('validateIsbn10 rejects X in the payload positions', () => {
  const r = validateIsbn10('03064X6152');
  assert.equal(r.valid, false);
  assert.equal(r.error, 'invalid_payload_char');
  assert.equal(r.type, 'isbn10');
});

test('validateIsbn10 rejects a wrong check digit', () => {
  const r = validateIsbn10('0306406153');
  assert.equal(r.valid, false);
  assert.equal(r.checkDigit, '2');
  assert.equal(r.suppliedCheckDigit, '3');
});

test('validateIsbn10 rejects a non-digit, non-X check digit', () => {
  const r = validateIsbn10('030640615Y');
  assert.equal(r.valid, false);
  assert.equal(r.error, 'invalid_check_digit_char');
});

// --- validateIsbn13 ----------------------------------------------------------

test('validateIsbn13 rejects a letter in the payload', () => {
  const r = validateIsbn13('97803064061a7');
  assert.equal(r.valid, false);
  assert.equal(r.error, 'invalid_payload_char');
});

test('validateIsbn13 rejects a letter as the check digit', () => {
  const r = validateIsbn13('978030640615X');
  assert.equal(r.valid, false);
  assert.equal(r.error, 'invalid_check_digit_char');
});

// --- appendIsbn10/13CheckDigit ----------------------------------------------

test('appendIsbn10CheckDigit produces a valid full ISBN-10', () => {
  const full = appendIsbn10CheckDigit('030640615');
  assert.equal(full, '0306406152');
  assert.equal(validateIsbn(full).valid, true);
});

test('appendIsbn13CheckDigit produces a valid full ISBN-13', () => {
  const full = appendIsbn13CheckDigit('978030640615');
  assert.equal(full, '9780306406157');
  assert.equal(validateIsbn(full).valid, true);
});

test('appendIsbn10CheckDigit returns null on bad input', () => {
  assert.equal(appendIsbn10CheckDigit('abc'), null);
  assert.equal(appendIsbn10CheckDigit('03064061'), null);
});

test('appendIsbn13CheckDigit returns null on bad input', () => {
  assert.equal(appendIsbn13CheckDigit('abc'), null);
  assert.equal(appendIsbn13CheckDigit('97803064061'), null);
});
