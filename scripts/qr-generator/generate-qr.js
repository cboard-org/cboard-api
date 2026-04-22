'use strict';

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const vm = require('vm');

require('dotenv').config();

const src = fs.readFileSync(path.join(__dirname, 'qrcodegen-v1.8.0-es6.js'), 'utf8');
const sandbox = {};
vm.runInNewContext(src, sandbox);
const { qrcodegen } = sandbox;

const DEFAULT_BASE_URL = process.env.CBOARD_APP_URL || 'https://app.cboard.io';
const QR_SCALE = 10;
const QR_MARGIN = 4;

// CRC32 table for PNG chunk checksums
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function encodeGrayscalePng(pixels, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 0;  // grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Each scanline: 1 filter byte (None=0) + width pixel bytes
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(width + 1);
    row[0] = 0;
    pixels.copy(row, 1, y * width, y * width + width);
    rows.push(row);
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows));

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function generateQRCode(code, baseUrl = DEFAULT_BASE_URL) {
  if (!code) throw new Error('Access code is required');

  const normalizedCode = code.toUpperCase();
  const url = `${baseUrl}/access/${normalizedCode}`;
  const filename = `${normalizedCode}-qr.png`;
  const outputPath = path.join(process.cwd(), filename);

  const qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
  const imgSize = (qr.size + QR_MARGIN * 2) * QR_SCALE;
  const pixels = Buffer.alloc(imgSize * imgSize, 0xff); // white background

  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) {
        for (let dy = 0; dy < QR_SCALE; dy++) {
          const py = (QR_MARGIN + y) * QR_SCALE + dy;
          const px = (QR_MARGIN + x) * QR_SCALE;
          pixels.fill(0x00, py * imgSize + px, py * imgSize + px + QR_SCALE);
        }
      }
    }
  }

  fs.writeFileSync(outputPath, encodeGrayscalePng(pixels, imgSize, imgSize));
  return Promise.resolve({ url, outputPath });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const code = args[0];
  const baseUrl = args[1] || DEFAULT_BASE_URL;

  if (!code) {
    console.error('Error: Access code is required');
    console.error('\nUsage: node scripts/qr-generator/generate-qr.js <CODE> [BASE_URL]');
    console.error('Example: node scripts/qr-generator/generate-qr.js CAFE01 https://app.cboard.io');
    process.exit(1);
  }

  generateQRCode(code, baseUrl)
    .then(({ url, outputPath }) => {
      console.log('QR code generated successfully!');
      console.log('  URL encoded:', url);
      console.log('  Output file:', outputPath);
    })
    .catch(error => {
      console.error('Error generating QR code:', error.message);
      process.exit(1);
    });
}

module.exports = { generateQRCode };
