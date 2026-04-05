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
 * @returns {Promise<void>}
 *
 * @example
 * // CLI usage:
 * // node scripts/generate-qr.js CAFE01
 * // node scripts/generate-qr.js CAFE01 https://app.cboard.io
 * // node scripts/generate-qr.js TEST01 http://localhost:3000
 *
 * // Programmatic usage:
 * await generateQRCode('CAFE01', 'https://app.cboard.io');
 * // Creates: CAFE01-qr.png in current directory
 */
async function generateQRCode(code, baseUrl) {
  if (!code) {
    console.error('Error: Access code is required');
    console.error('\nUsage: node scripts/generate-qr.js <CODE> [BASE_URL]');
    console.error('Example: node scripts/generate-qr.js CAFE01 https://app.cboard.io');
    process.exit(1);
  }

  const normalizedCode = code.toUpperCase();
  const url = `${baseUrl}/access/${normalizedCode}`;
  const filename = `${normalizedCode}-qr.png`;
  const outputPath = path.join(process.cwd(), filename);

  try {
    await QRCode.toFile(outputPath, url, {
      width: QR_WIDTH,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error.message);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const code = args[0];
const baseUrl = args[1] || DEFAULT_BASE_URL;

if (require.main === module) {
  generateQRCode(code, baseUrl);
}

module.exports = { generateQRCode };
