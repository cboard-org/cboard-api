'use strict';

const path = require('path');
const fs = require('fs');

require('dotenv').config();

const { generateQrCodePngBuffer, buildAccessUrl } = require('../../api/helpers/qrCode');

/**
 * Generates a QR code PNG for a Cboard Access client/code pair and writes it to disk.
 * Kept for local/offline use; the same logic backs the
 * GET /admin/access/gates/{gateCode}/qr endpoint.
 */
function generateQRCode(code, slug, baseUrl) {
  const url = buildAccessUrl(slug, code, baseUrl);
  const filename = `${slug}-${code.toUpperCase()}-qr.png`;
  const outputPath = path.join(process.cwd(), filename);

  fs.writeFileSync(outputPath, generateQrCodePngBuffer(url));
  return Promise.resolve({ url, outputPath });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const slug = args[0];
  const code = args[1];
  const baseUrl = args[2];

  if (!slug || !code) {
    console.error('Error: Client slug and access code are required');
    console.error('\nUsage: node scripts/qr-generator/generate-qr.js <SLUG> <CODE> [BASE_URL]');
    console.error('Example: node scripts/qr-generator/generate-qr.js my-company ABC123 https://app.cboard.io');
    process.exit(1);
  }

  generateQRCode(code, slug, baseUrl)
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
