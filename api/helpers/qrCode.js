'use strict';

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const vm = require('vm');

const blob = require('./blob');
const config = require('../../config');

const QR_SCALE = 10;
const QR_MARGIN = 4;
const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';
const QR_CODE_BLOB_FOLDER = 'qr-codes';

const src = fs.readFileSync(
  path.join(__dirname, 'vendor', 'qrcodegen-v1.8.0-es6.js'),
  'utf8'
);
const sandbox = {};
vm.runInNewContext(src, sandbox);
const { qrcodegen } = sandbox;

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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
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

/**
 * Encodes text (typically a URL) into a QR code PNG image.
 * @param {string} text - Content to encode (e.g. an Access gate URL)
 * @returns {Buffer} PNG image buffer
 */
function generateQrCodePngBuffer(text) {
  if (!text) throw new Error('Text to encode is required');

  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
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

  return encodeGrayscalePng(pixels, imgSize, imgSize);
}

/**
 * Encodes text into a QR code and returns it as a base64 data URL,
 * ready to embed directly in an <img> src or return over JSON.
 * @param {string} text - Content to encode
 * @returns {string} data:image/png;base64,... URL
 */
function generateQrCodeDataUrl(text) {
  const png = generateQrCodePngBuffer(text);
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Builds the public Cboard Access URL that a QR code should point to.
 * @param {string} slug - AccessClient slug
 * @param {string} code - AccessGate code
 * @param {string} [baseUrl] - Frontend base URL, defaults to CBOARD_APP_URL
 * @returns {string}
 */
function buildAccessUrl(slug, code, baseUrl) {
  if (!slug) throw new Error('Client slug is required');
  if (!code) throw new Error('Access code is required');

  const resolvedBaseUrl =
    baseUrl || process.env.CBOARD_APP_URL || 'https://app.cboard.io';
  return `${resolvedBaseUrl.replace(/\/$/, '')}/access/${slug}/${code.toUpperCase()}`;
}

/**
 * Uploads a QR code PNG to Azure Blob Storage at a stable path (qr-codes/{slug}-{code}.png),
 * overwriting any previous QR for that gate so the returned URL never changes across
 * regenerations — safe to print or bookmark. Resolves to the CDN URL when configured.
 * @param {string} slug - AccessClient slug
 * @param {string} code - AccessGate code
 * @param {Buffer} pngBuffer - QR code PNG bytes
 * @returns {Promise<string>}
 */
async function uploadQrCodeBlob(slug, code, pngBuffer) {
  const blobName = `${QR_CODE_BLOB_FOLDER}/${slug}-${code.toUpperCase()}.png`;

  const [, fileUrl] = await blob.createOrReplaceBlockBlob(
    BLOB_CONTAINER_NAME,
    blobName,
    pngBuffer,
    'image/png'
  );

  return config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME &&
    config.AZURE_CDN_URL &&
    fileUrl.startsWith(config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME)
    ? fileUrl.replace(
        config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME,
        config.AZURE_CDN_URL
      )
    : fileUrl;
}

module.exports = {
  generateQrCodePngBuffer,
  generateQrCodeDataUrl,
  buildAccessUrl,
  uploadQrCodeBlob
};
