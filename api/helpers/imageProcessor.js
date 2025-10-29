const crypto = require('crypto');
const { createBlockBlobFromText } = require('./blob');
const config = require('../../config');

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

const CONFIG = {
  BATCH_SIZE: 5,
  MAX_RETRIES: 3
};

const ErrorTypes = {
  INVALID_BASE64: 'Invalid base64 format',
  AZURE_UPLOAD_FAILED: 'Azure blob upload failed',
  AZURE_RATE_LIMIT: 'Azure rate limit exceeded',
  NETWORK_TIMEOUT: 'Network timeout',
  INSUFFICIENT_STORAGE: 'Storage quota exceeded',
  INVALID_IMAGE_FORMAT: 'Unsupported image format'
};

/**
 * Process tiles with base64 images using Map-based approach for better performance and tracking
 * @param {Array} tiles - Array of tile objects to process
 * @param {string} containerName - Azure container name for blob storage
 * @returns {Promise<Object>} Processing result with processed tiles and statistics
 * @returns {Array} return.tiles - Processed tiles array with blob URLs
 * @returns {Object} return.processing - Processing statistics
 * @returns {number} return.processing.totalTiles - Total number of tiles processed
 * @returns {number} return.processing.successCount - Number of successful conversions
 * @returns {number} return.processing.failureCount - Number of failed conversions
 * @returns {Array} return.processing.errors - Array of error details
 * @returns {boolean} return.processing.hasErrors - Whether any errors occurred
 * @returns {string} return.processing.processingMethod - Processing method used ('map')
 */
async function processBase64Images(tiles, containerName = BLOB_CONTAINER_NAME) {
  if (!tiles || !Array.isArray(tiles) || tiles.length === 0) {
    throw new Error('No tiles provided for processing.');
  }

  const tileMap = new Map();
  const toProcessIds = [];
  const errorMap = new Map();
  let successCount = 0;
  let failureCount = 0;

  tiles.forEach((tile, index) => {
    const tileId = tile.id || `tile_${index}`;
    tileMap.set(tileId, { ...tile });

    if (tile.image && isBase64Image(tile.image)) {
      toProcessIds.push(tileId);
    }
  });
  
  for (let i = 0; i < toProcessIds.length; i += CONFIG.BATCH_SIZE) {
    const batchIds = toProcessIds.slice(i, i + CONFIG.BATCH_SIZE);
    
    const batchPromises = batchIds.map(async (tileId) => {
      const tile = tileMap.get(tileId);
      try {
        const blobUrl = await convertBase64ToBlob(tile.image, containerName, {
          enableRetries: true,
          maxRetries: CONFIG.MAX_RETRIES,
          tileId,
          tile: tile
        });
        
        const tileData = tileMap.get(tileId);
        tileMap.set(tileId, {
          ...tileData,
          image: blobUrl
        });
        
        successCount++;
        return { success: true, tileId };
        
      } catch (error) {
        failureCount++;
        const errorInfo = createErrorInfo(tile, error);
        errorMap.set(tileId, errorInfo);
      
        const errorHandledTile = handleImageError(tile, error);
        if (errorHandledTile.image !== tile.image) {
          const tileData = tileMap.get(tileId);
          tileMap.set(tileId, {
            ...tileData,
            image: errorHandledTile.image
          });
        }
        
        return { success: false, tileId, error: errorInfo };
      }
    });
    
    await Promise.allSettled(batchPromises);
  }

  const processedTiles = tiles.map((tile, index) => {
    const tileId = tile.id || `tile_${index}`;
    const result = tileMap.get(tileId);
    return result || tile;
  });

  const processingStats = {
    totalTiles: tiles.length,
    successCount,
    failureCount,
    errors: Array.from(errorMap.values()),
    hasErrors: errorMap.size > 0,
  };

  return {
    tiles: processedTiles,
    processing: processingStats
  };
}

/**
 * Convert base64 to blob URL with optional retries
 * @param {string} base64String - The base64 image string
 * @param {string} containerName - Azure container name
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableRetries - Enable retry logic (default: false)
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {string} options.tileId - Tile ID for logging (default: 'unknown')
 * @param {Object} options.tile - Tile object containing label and other data (optional)
 * @returns {Promise<string>} The blob CDN URL
 */
async function convertBase64ToBlob(base64String, containerName = BLOB_CONTAINER_NAME, options = {}) {
  const {
    enableRetries = false,
    maxRetries = 3,
    tileId = 'unknown',
    tile = null
  } = options;


  const performConversion = async () => {
    const [header, base64Data] = base64String.split(',');
    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    const file = {
      buffer: buffer,
      mimetype: mimeType
    };
    
    const fileName = getFilename(tile, extension, tileId);
    const [blobResult, fileUrl] = await createBlockBlobFromText(
      containerName,
      fileName,
      file,
      'boards'
    );
    
    const cdnUrl =
      config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME &&
      config.AZURE_CDN_URL &&
      fileUrl.startsWith(config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME)
        ? fileUrl.replace(
            config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME,
            config.AZURE_CDN_URL
          )
        : fileUrl;
    
    return cdnUrl;
  };

  const maxAttempts = enableRetries ? maxRetries : 1;
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await performConversion();
    } catch (error) {
      lastError = error;
      
      if (!enableRetries || !shouldRetry(error) || attempt === maxAttempts) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retry ${attempt}/${maxRetries} for tile ${tileId} in ${delay}ms:`, error.message);
      await sleep(delay);
    }
  }
}

function isBase64Image(imageString) {
  return typeof imageString === 'string' && 
         imageString.startsWith('data:image/') && 
         imageString.includes('base64,');
}

function hasBase64Images(tiles) {
  if (!tiles || !Array.isArray(tiles)) return false;
  
  return tiles.some(tile => 
    tile.image && isBase64Image(tile.image)
  );
}

function shouldRetry(error) {
  const retryableErrors = [
    'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT',
    'Network timeout', 'Rate limit', '429', '500', '502', '503'
  ];
  
  return retryableErrors.some(retryable => 
    error.message.includes(retryable) || error.code === retryable
  );
}

function classifyError(error) {
  if (error.message.includes('Invalid base64')) return ErrorTypes.INVALID_BASE64;
  if (error.message.includes('429') || error.message.includes('rate limit')) return ErrorTypes.AZURE_RATE_LIMIT;
  if (error.message.includes('timeout')) return ErrorTypes.NETWORK_TIMEOUT;
  if (error.message.includes('storage quota')) return ErrorTypes.INSUFFICIENT_STORAGE;
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') return ErrorTypes.AZURE_UPLOAD_FAILED;
  return 'UNKNOWN_ERROR';
}

function handleImageError(tile, error) {
  const errorType = classifyError(error);
  
  switch (errorType) {
    case ErrorTypes.INVALID_BASE64:
    case ErrorTypes.INVALID_IMAGE_FORMAT:
      return { ...tile, image: null };
      
    case ErrorTypes.AZURE_RATE_LIMIT:
    case ErrorTypes.NETWORK_TIMEOUT:
    case ErrorTypes.AZURE_UPLOAD_FAILED:
      console.warn(`Keeping base64 for tile ${tile.id} due to: ${errorType}`);
      return { ...tile };
      
    case ErrorTypes.INSUFFICIENT_STORAGE:
      console.error(`Storage quota exceeded for tile ${tile.id}`);
      return { ...tile, image: null };
      
    default:
      return { ...tile };
  }
}

function createErrorInfo(tile, error, tileIndex) {
  return {
    tileId: tile.id || `tile_${tileIndex}`,
    tileIndex,
    error: error.message,
    errorType: classifyError(error),
    timestamp: new Date().toISOString()
  };
}

function logBatchResults(batchStart, batchResults) {
  const batchNumber = Math.floor(batchStart / CONFIG.BATCH_SIZE) + 1;
  const successful = batchResults.filter(r => r.status === 'fulfilled').length;
  const failed = batchResults.filter(r => r.status === 'rejected').length;
  
  console.log(`Batch ${batchNumber} completed: ${successful} successful, ${failed} failed`);
}

/**
 * Get filenamme from tile data
 * @param {Object} tile - Tile object
 * @param {string} extension - File extension
 * @param {string} fallbackId - Fallback ID if no tile data available
 * @returns {string} Sanitized filename
 */
function getFilename(tile, extension, fallbackId = 'unknown') {
  let baseName = 'tile-image';
  
  if (tile) {
    if (tile.label && typeof tile.label === 'string' && tile.label.trim()) {
      baseName = tile.label.trim();
    } else if (tile.id && typeof tile.id === 'string' && tile.id.trim()) {
      baseName = tile.id.trim();
    } else if (fallbackId && fallbackId !== 'unknown') {
      baseName = fallbackId;
    }
  } else if (fallbackId && fallbackId !== 'unknown') {
    baseName = fallbackId;
  }

  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/[-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const finalName = sanitized || 'tile-image';
  
  return `${finalName}.${extension}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  processBase64Images,
  convertBase64ToBlob,
  isBase64Image,
  hasBase64Images,
  classifyError,
  handleImageError,
  getFilename,
  ErrorTypes,
  CONFIG
};