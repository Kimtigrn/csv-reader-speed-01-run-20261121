// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Same answers as the reference on every input, byte for byte as JSON values:
//   - U+FEFF at the very start is dropped
//   - a record ends at LF or CRLF; a line left with no characters is no record
//   - outside quotes a CR not followed by LF is dropped (stray_cr)
//   - a field opening with a quote runs to the next quote that is not doubled,
//     "" inside it is one quote, CRLF or a lone CR inside it reads as LF;
//     what follows the closing quote up to the next comma or line break is
//     appended as it stands (quote_junk, when the field ends); a quote that
//     never closes is a literal character and the text after it is read again
//     as unquoted (unterminated_quote)
//   - a quote inside an unquoted field is a literal character
//   - columns is the first record when header is true, else null; rows are the
//     records after it, each padded (short_row) or cut (long_row) to the first
//     record's width; each error is {code, line, row}, in the order met.
//
// Speed comes from never walking the text a character at a time: fields are
// cut with indexOf jumps (native memchr) and String.slice, and values are
// assembled from slices only where a special character forces it. No state is
// kept from one call to the next; run() is pure per input.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input, {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and its index in rows (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // Current field scratch, written by the readers below.
  let fVal = '';
  let fEnd = END;
  let fAdded = 0;

  // Reads unquoted characters onto fVal up to the next comma or line break: a CR
  // not followed by LF is dropped (stray_cr). fAdded counts the characters kept.
  function readUnquoted() {
    fAdded = 0;
    let seg = pos;
    for (;;) {
      const c = text.indexOf(',', pos);
      const l = text.indexOf('\n', pos);
      const r = text.indexOf('\r', pos);
      let m = -1;
      let kind = 0; // 0 comma, 1 LF, 2 CR
      if (c !== -1) {
        m = c;
        kind = 0;
      }
      if (l !== -1 && (m === -1 || l < m)) {
        m = l;
        kind = 1;
      }
      if (r !== -1 && (m === -1 || r < m)) {
        m = r;
        kind = 2;
      }
      if (m === -1) {
        if (seg < n) {
          fVal += text.slice(seg, n);
          fAdded += n - seg;
        }
        pos = n;
        fEnd = END;
        return;
      }
      if (kind === 0) {
        if (seg < m) {
          fVal += text.slice(seg, m);
          fAdded += m - seg;
        }
        pos = m + 1;
        fEnd = COMMA;
        return;
      }
      if (kind === 1) {
        if (seg < m) {
          fVal += text.slice(seg, m);
          fAdded += m - seg;
        }
        pos = m + 1;
        line += 1;
        fEnd = LINE_BREAK;
        return;
      }
      // CR: CRLF ends the field at a line break; a lone CR is dropped (stray_cr).
      if (m + 1 < n && text.charCodeAt(m + 1) === 10) {
        if (seg < m) {
          fVal += text.slice(seg, m);
          fAdded += m - seg;
        }
        pos = m + 2;
        line += 1;
        fEnd = LINE_BREAK;
        return;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      if (seg < m) {
        fVal += text.slice(seg, m);
        fAdded += m - seg;
      }
      pos = m + 1;
      seg = pos;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let seg = pos;
    const parts = [];
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text after
        // it is read again as an unquoted field.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        fVal = '"';
        readUnquoted();
        return;
      }
      // The nearest of CR, LF and the next quote decides what happens next.
      const r = text.indexOf('\r', pos);
      const l = text.indexOf('\n', pos);
      let m = q;
      let kind = 2; // 0 CR, 1 LF, 2 quote
      if (l !== -1 && l < m) {
        m = l;
        kind = 1;
      }
      if (r !== -1 && r < m) {
        m = r;
        kind = 0;
      }
      if (kind === 0) {
        // CRLF and a lone CR inside quotes are each one LF.
        if (seg < m) parts.push(text.slice(seg, m));
        parts.push('\n');
        line += 1;
        pos = m + (m + 1 < n && text.charCodeAt(m + 1) === 10 ? 2 : 1);
        seg = pos;
        continue;
      }
      if (kind === 1) {
        parts.push(text.slice(seg, m + 1));
        line += 1;
        pos = m + 1;
        seg = pos;
        continue;
      }
      if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
        // A doubled quote is one literal quote.
        if (seg < q) parts.push(text.slice(seg, q));
        parts.push('"');
        pos = q + 2;
        seg = pos;
        continue;
      }
      // Closing quote.
      parts.push(text.slice(seg, q));
      pos = q + 1;
      break;
    }
    fVal = parts.length === 1 ? parts[0] : parts.join('');
    if (pos >= n) {
      fEnd = END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fEnd = COMMA;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fEnd = LINE_BREAK;
      return;
    }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fEnd = LINE_BREAK;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    readUnquoted();
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      fVal = '';
      if (quoted) readQuoted();
      else readUnquoted();
      fields.push(fVal);
    } while (fEnd === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
