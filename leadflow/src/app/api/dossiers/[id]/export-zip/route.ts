import { type NextRequest, NextResponse } from 'next/server';
import { deflateRawSync } from 'zlib';
import { getCurrentUser, canViewAllLeads } from '@/lib/auth';
import { getDossierById, getPiecesJustificatives, getAuditLog, computeQualiopiCriteres } from '@/lib/db/dossiers';

// CRC-32 lookup table (standard polynomial 0xEDB88320)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(): { time: number; date: number } {
  const now = new Date();
  return {
    time: ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) >>> 0,
    date: (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) >>> 0,
  };
}

function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  const centralDirs: Buffer[] = [];
  let localOffset = 0;
  const { time: dosTime, date: dosDate } = dosDateTime();

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf-8');
    const compressed = deflateRawSync(file.data, { level: 6 });
    const crc = crc32(file.data);

    // Local file header (30 bytes) + name
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // signature PK\x03\x04
    local.writeUInt16LE(20, 4);              // version needed to extract
    local.writeUInt16LE(0, 6);               // general purpose bit flag
    local.writeUInt16LE(8, 8);               // compression: DEFLATE
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);              // extra field length
    nameBuf.copy(local, 30);

    parts.push(local, compressed);

    // Central directory header (46 bytes) + name
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);  // signature PK\x01\x02
    cd.writeUInt16LE(20, 4);          // version made by
    cd.writeUInt16LE(20, 6);          // version needed
    cd.writeUInt16LE(0, 8);           // flags
    cd.writeUInt16LE(8, 10);          // compression
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(file.data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);           // extra field length
    cd.writeUInt16LE(0, 32);           // file comment length
    cd.writeUInt16LE(0, 34);           // disk number start
    cd.writeUInt16LE(0, 36);           // internal file attributes
    cd.writeUInt32LE(0, 38);           // external file attributes
    cd.writeUInt32LE(localOffset, 42); // relative offset of local header
    nameBuf.copy(cd, 46);

    centralDirs.push(cd);
    localOffset += 30 + nameBuf.length + compressed.length;
  }

  const cdBuf = Buffer.concat(centralDirs);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // signature PK\x05\x06
  eocd.writeUInt16LE(0, 4);                 // disk number
  eocd.writeUInt16LE(0, 6);                 // disk with start of central dir
  eocd.writeUInt16LE(files.length, 8);      // entries on this disk
  eocd.writeUInt16LE(files.length, 10);     // total entries
  eocd.writeUInt32LE(cdBuf.length, 12);     // size of central directory
  eocd.writeUInt32LE(localOffset, 16);      // offset of central directory
  eocd.writeUInt16LE(0, 20);                // comment length

  return Buffer.concat([...parts, cdBuf, eocd]);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!canViewAllLeads(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const dossier = await getDossierById(id);
  if (!dossier) {
    return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });
  }

  const [pieces, audit, qualiopi] = await Promise.all([
    getPiecesJustificatives(id),
    getAuditLog(id),
    computeQualiopiCriteres(id),
  ]);

  const files = [
    { name: 'dossier-info.json',          data: Buffer.from(JSON.stringify(dossier, null, 2), 'utf-8') },
    { name: 'pieces-justificatives.json', data: Buffer.from(JSON.stringify(pieces, null, 2), 'utf-8') },
    { name: 'journal-audit.json',         data: Buffer.from(JSON.stringify(audit, null, 2), 'utf-8') },
    { name: 'conformite-qualiopi.json',   data: Buffer.from(JSON.stringify(qualiopi, null, 2), 'utf-8') },
  ];

  const zip = buildZip(files);
  const filename = `dossier-preuve-${id}.zip`;

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.length),
    },
  });
}
