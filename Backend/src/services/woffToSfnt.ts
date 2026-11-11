import zlib from 'zlib';

// Converts a WOFF 1.0 font (what @fontsource ships) back to a plain
// TrueType/OpenType (sfnt) file. ffmpeg's drawtext (FreeType in the
// ffmpeg-static build) can't open WOFF, but it can open the sfnt. WOFF 1.0
// is just the sfnt tables, each optionally zlib-compressed, so this is a
// lossless repack (spec: https://www.w3.org/TR/WOFF/).
export function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') throw new Error('Not a WOFF 1.0 font');
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);

  const tables: Array<{ tag: number; checksum: number; data: Buffer }> = [];
  for (let i = 0; i < numTables; i += 1) {
    const entry = 44 + i * 20;
    const tag = woff.readUInt32BE(entry);
    const offset = woff.readUInt32BE(entry + 4);
    const compLength = woff.readUInt32BE(entry + 8);
    const origLength = woff.readUInt32BE(entry + 12);
    const checksum = woff.readUInt32BE(entry + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? zlib.inflateSync(raw) : Buffer.from(raw);
    if (data.length !== origLength) throw new Error('Corrupt WOFF table');
    tables.push({ tag, checksum, data });
  }

  // sfnt header + table directory (tables keep the WOFF's tag order, which
  // the spec requires to be ascending).
  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector += 1;
  }
  searchRange *= 16;
  const headerSize = 12 + numTables * 16;
  let size = headerSize;
  for (const t of tables) size += (t.data.length + 3) & ~3;

  const out = Buffer.alloc(size);
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(numTables * 16 - searchRange, 10);
  let offset = headerSize;
  tables.forEach((t, i) => {
    const entry = 12 + i * 16;
    out.writeUInt32BE(t.tag, entry);
    out.writeUInt32BE(t.checksum, entry + 4);
    out.writeUInt32BE(offset, entry + 8);
    out.writeUInt32BE(t.data.length, entry + 12);
    t.data.copy(out, offset);
    offset += (t.data.length + 3) & ~3;
  });
  return out;
}
