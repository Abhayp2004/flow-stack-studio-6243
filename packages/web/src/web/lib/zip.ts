export type ZipFileInput = {
  path: string;
  content: string | Uint8Array;
};

const textEncoder = new TextEncoder();

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const idx = (crc ^ data[i]) & 0xff;
    crc = (crc >>> 8) ^ table[idx];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === "string" ? textEncoder.encode(content) : content;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const centralDirectoryChunks: Uint8Array[] = [];
  let offset = 0;

  const normalized = files.map((file) => {
    const path = file.path.replace(/\\/g, "/");
    const pathBytes = textEncoder.encode(path);
    const data = toBytes(file.content);
    return {
      pathBytes,
      data,
      crc: crc32(data),
      offset,
    };
  });

  for (const file of normalized) {
    const localHeader = new Uint8Array(30 + file.pathBytes.length + file.data.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, file.crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, file.pathBytes.length, true);
    view.setUint16(28, 0, true);

    localHeader.set(file.pathBytes, 30);
    localHeader.set(file.data, 30 + file.pathBytes.length);

    chunks.push(localHeader);
    file.offset = offset;
    offset += localHeader.length;
  }

  const centralDirectoryStart = offset;

  for (const file of normalized) {
    const centralHeader = new Uint8Array(46 + file.pathBytes.length);
    const view = new DataView(centralHeader.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, file.crc, true);
    view.setUint32(20, file.data.length, true);
    view.setUint32(24, file.data.length, true);
    view.setUint16(28, file.pathBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, file.offset, true);

    centralHeader.set(file.pathBytes, 46);
    centralDirectoryChunks.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralDirectorySize = offset - centralDirectoryStart;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, normalized.length, true);
  eocdView.setUint16(10, normalized.length, true);
  eocdView.setUint32(12, centralDirectorySize, true);
  eocdView.setUint32(16, centralDirectoryStart, true);
  eocdView.setUint16(20, 0, true);

  chunks.push(...centralDirectoryChunks, eocd);
  return concatBytes(chunks);
}
