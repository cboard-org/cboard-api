'use strict';

const QRCode = require('qrcode');
const path = require('path');

require('dotenv').config();

const DEFAULT_BASE_URL = process.env.CBOARD_APP_URL || 'https://app.cboard.io';
const QR_WIDTH = 500;

/**
 * Generates a QR code PNG for a Cboard Access code.
 *
 * Creates a QR code that links to the access URL for the given code.
 * The QR code can be printed and displayed at client locations.
 *
 * @param {string} code - The access code (e.g., "CAFE01")
 * @param {string} baseUrl - Base URL for the access link (default: CBOARD_APP_URL or https://app.cboard.io)
 * @returns {Promise<{url: string, outputPath: string}>} - The encoded URL and output file path
 * @throws {Error} If code is not provided or QR generation fails
 *
 * @example
 * // CLI usage:
 * // node scripts/generate-qr.js CAFE01
 * // node scripts/generate-qr.js CAFE01 https://app.cboard.io
 * // node scripts/generate-qr.js TEST01 http://localhost:3000
 *
 * // Programmatic usage:
 * const { url, outputPath } = await generateQRCode('CAFE01', 'https://app.cboard.io');
 * // Creates: CAFE01-qr.png in current directory
 */
async function generateQRCode(code, baseUrl = DEFAULT_BASE_URL) {
  if (!code) {
    throw new Error('Access code is required');
  }

  const normalizedCode = code.toUpperCase();
  const url = `${baseUrl}/access/${normalizedCode}`;
  const filename = `${normalizedCode}-qr.png`;
  const outputPath = path.join(process.cwd(), filename);

  await QRCode.toFile(outputPath, url, {
    width: QR_WIDTH,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return { url, outputPath };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const code = args[0];
  const baseUrl = args[1] || DEFAULT_BASE_URL;

  if (!code) {
    console.error('Error: Access code is required');
    console.error('\nUsage: node scripts/generate-qr.js <CODE> [BASE_URL]');
    console.error('Example: node scripts/generate-qr.js CAFE01 https://app.cboard.io');
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
