# ISBN Check Digit Validator

Validate and compute check digits for ISBN-10 and ISBN-13 identifiers.

```js
import {
  validateIsbn,
  appendIsbn10CheckDigit,
  appendIsbn13CheckDigit,
} from './src/index.js';

validateIsbn('0-306-40615-2');      // { valid: true, type: 'isbn10', ... }
validateIsbn('978-0-306-40615-7');  // { valid: true, type: 'isbn13', ... }

appendIsbn10CheckDigit('030640615'); // '0306406152'
appendIsbn13CheckDigit('978030640615'); // '9780306406157'
```

## Why this exists

A small, dependency-free library that does exactly one job: check-digit
validation and computation for the two ISBN formats still in circulation.
ISBN-13 is the current standard; ISBN-10 is legacy but still printed on older
books and shows up in bibliographic data constantly. Most systems need both,
so this library handles both in one place rather than forcing the caller to
pre-classify.

The trade-off: every public function returns a result object instead of
throwing. This is slightly more verbose than a try/catch API, but it makes the
failure modes enumerable — `error` is a short string code, never an exception
the caller has to pattern-match on a message to handle.

## Input normalisation

Hyphens and ASCII spaces are stripped automatically, and the string is
uppercased, so `0-306-40615-2`, `0 306 40615 2` and `0-306-40615-x` all work.

The awkward edge: we deliberately do **not** strip tabs, newlines, or other
control characters. A tab in an ISBN is almost always a copy-paste corruption,
not a real character, so `validateIsbn('0\t306406152')` returns
`{ valid: false, error: 'normalize_failed' }`. If you want to accept such input,
`.trim()` it yourself before calling.

## Exported names

From `./src/index.js`:

- `normalize(raw)` — strip hyphens/spaces, uppercase, or return `null`.
- `computeIsbn10CheckDigit(nineDigits)` — `'0'-'9'` or `'X'`, or `null`.
- `computeIsbn13CheckDigit(twelveDigits)` — `'0'-'9'`, or `null`.
- `validateIsbn(raw)` — dispatch on normalised length; returns `{ valid, normalized, type, checkDigit, suppliedCheckDigit, error }`.
- `validateIsbn10(normalized)` — assumes already-normalised 10-char string.
- `validateIsbn13(normalized)` — assumes already-normalised 13-char string.
- `appendIsbn10CheckDigit(nineDigits)` — returns full 10-char ISBN or `null`.
- `appendIsbn13CheckDigit(twelveDigits)` — returns full 13-char ISBN or `null`.

## Tests

```
node --test test/
```

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

