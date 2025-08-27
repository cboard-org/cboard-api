const crypto = require('crypto');
const { createBlockBlobFromText } = require('./blob');

// Blob container name
const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

// Configuration
const CONFIG = {
  BATCH_SIZE: 5,
  MAX_RETRIES: 3,
  ENABLE_CACHE: true
};

// Error types for classification
const ErrorTypes = {
  INVALID_BASE64: 'Invalid base64 format',
  AZURE_UPLOAD_FAILED: 'Azure blob upload failed',
  AZURE_RATE_LIMIT: 'Azure rate limit exceeded',
  NETWORK_TIMEOUT: 'Network timeout',
  INSUFFICIENT_STORAGE: 'Storage quota exceeded',
  INVALID_IMAGE_FORMAT: 'Unsupported image format'
};

// Global image cache - maps content hash to blob URL
const imageCache = new Map();

// Validate tiles
async function processBase64Images(tiles, containerName = BLOB_CONTAINER_NAME) {
  if (!tiles || !Array.isArray(tiles)) {
    return { tiles, processing: createEmptyProcessingResult() };
  }
  return processWithMap(tiles, containerName);
}

// Process tiles
async function processWithMap(tiles, containerName = BLOB_CONTAINER_NAME) {
  const tileMap = new Map();
  const resultMap = new Map();
  const errorMap = new Map();
  let successCount = 0;
  let failureCount = 0;

  // Initialize tile map with metadata
  tiles.forEach((tile, index) => {
    tileMap.set(tile.id || `tile_${index}`, {
      tile,
      originalIndex: index,
      status: 'pending'
    });
  });

  const tileIds = Array.from(tileMap.keys());

  for (let i = 0; i < tileIds.length; i += CONFIG.BATCH_SIZE) {
    const batchIds = tileIds.slice(i, i + CONFIG.BATCH_SIZE);
    
    const batchPromises = batchIds.map(async (tileId) => {
      const tileData = tileMap.get(tileId);
      const { tile, originalIndex } = tileData;
      
      if (tile.image && isBase64Image(tile.image)) {
        try {
          const blobUrl = await convertBase64ToBlob(tile.image, containerName, {
            enableRetries: true,
            maxRetries: CONFIG.MAX_RETRIES,
            enableCache: CONFIG.ENABLE_CACHE,
            tileId,
            tile: tile
          });
          
          resultMap.set(tileId, {
            ...tile,
            image: blobUrl,
            status: 'success',
            originalIndex
          });
          
          tileMap.set(tileId, { ...tileData, status: 'success' });
          successCount++;
          
          return { success: true, tileId };
        } catch (error) {
          failureCount++;
          const errorInfo = createErrorInfo(tile, error, originalIndex);
          errorMap.set(tileId, errorInfo);
          
          const errorHandledTile = handleImageError(tile, error);
          resultMap.set(tileId, {
            ...errorHandledTile,
            status: 'error',
            originalIndex,
            error: errorInfo
          });
          
          tileMap.set(tileId, { ...tileData, status: 'error' });
          
          return { success: false, tileId, error: errorInfo };
        }
      } else {
        resultMap.set(tileId, {
          ...tile,
          status: 'skipped',
          originalIndex
        });
        
        tileMap.set(tileId, { ...tileData, status: 'skipped' });
        return { success: true, tileId, skipped: true };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    logBatchResults(i, batchResults);
  }

  // Reconstruct array in original order
  const processedTiles = tiles.map((tile, index) => {
    const tileId = tile.id || `tile_${index}`;
    const result = resultMap.get(tileId);
    return result || tile;
  });

  return {
    tiles: processedTiles,
    processing: {
      totalTiles: tiles.length,
      successCount,
      failureCount,
      errors: Array.from(errorMap.values()),
      hasErrors: errorMap.size > 0,
      processingMethod: 'map',
      cacheHits: getCacheStats().hits,
      cacheMisses: getCacheStats().misses
    }
  };
}

/**
 * Convert base64 to blob URL with optional retries and caching
 * @param {string} base64String - The base64 image string
 * @param {string} containerName - Azure container name
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableRetries - Enable retry logic (default: false)
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {boolean} options.enableCache - Enable image caching (default: false)
 * @param {string} options.tileId - Tile ID for logging (default: 'unknown')
 * @param {Object} options.tile - Tile object containing label and other data (optional)
 * @returns {Promise<string>} The blob CDN URL
 */
async function convertBase64ToBlob(base64String, containerName = BLOB_CONTAINER_NAME, options = {}) {
  const {
    enableRetries = false,
    maxRetries = 3,
    enableCache = false,
    tileId = 'unknown',
    tile = null
  } = options;

  if (enableCache) {
    const cacheKey = createImageHash(base64String);
    if (imageCache.has(cacheKey)) {
      incrementCacheStats('hits');
      return imageCache.get(cacheKey);
    }
    incrementCacheStats('misses');
  }

  const performConversion = async () => {
    const [header, base64Data] = base64String.split(',');
    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    const file = {
      buffer: buffer,
      mimetype: mimeType
    };
    
    const fileName = createUniqueFilename(tile, extension, tileId);
    const [blobResult, fileUrl] = await createBlockBlobFromText(
      containerName,
      fileName,
      file,
      'boards'
    );
    
    return fileUrl;
  };

  if (enableRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const blobUrl = await performConversion();
        
        if (enableCache) {
          const cacheKey = createImageHash(base64String);
          imageCache.set(cacheKey, blobUrl);
        }
        
        return blobUrl;
      } catch (error) {
        lastError = error;
        
        if (!shouldRetry(error)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Retry ${attempt}/${maxRetries} for tile ${tileId} in ${delay}ms:`, error.message);
          await sleep(delay);
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
  } else {
    const blobUrl = await performConversion();
    
    // Cache successful result
    if (enableCache) {
      const cacheKey = createImageHash(base64String);
      imageCache.set(cacheKey, blobUrl);
    }
    
    return blobUrl;
  }
}

// Check if image string is base64 format
function isBase64Image(imageString) {
  return typeof imageString === 'string' && 
         imageString.startsWith('data:image/') && 
         imageString.includes('base64,');
}

// Check if tiles contain any base64 images (indicates offline editing)
function hasBase64Images(tiles) {
  if (!tiles || !Array.isArray(tiles)) return false;
  
  return tiles.some(tile => 
    tile.image && isBase64Image(tile.image)
  );
}

// Check if error should trigger a retry
function shouldRetry(error) {
  const retryableErrors = [
    'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT',
    'Network timeout', 'Rate limit', '429', '500', '502', '503'
  ];
  
  return retryableErrors.some(retryable => 
    error.message.includes(retryable) || error.code === retryable
  );
}

// Error types classification
function classifyError(error) {
  if (error.message.includes('Invalid base64')) return ErrorTypes.INVALID_BASE64;
  if (error.message.includes('429') || error.message.includes('rate limit')) return ErrorTypes.AZURE_RATE_LIMIT;
  if (error.message.includes('timeout')) return ErrorTypes.NETWORK_TIMEOUT;
  if (error.message.includes('storage quota')) return ErrorTypes.INSUFFICIENT_STORAGE;
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') return ErrorTypes.AZURE_UPLOAD_FAILED;
  return 'UNKNOWN_ERROR';
}

// Handle image processing error based on error type
function handleImageError(tile, error) {
  const errorType = classifyError(error);
  
  switch (errorType) {
    case ErrorTypes.INVALID_BASE64:
    case ErrorTypes.INVALID_IMAGE_FORMAT:
      // Remove invalid image completely
      return { ...tile, image: null, hasImageError: true, errorType };
      
    case ErrorTypes.AZURE_RATE_LIMIT:
    case ErrorTypes.NETWORK_TIMEOUT:
    case ErrorTypes.AZURE_UPLOAD_FAILED:
      // Keep base64 for client retry later
      console.warn(`Keeping base64 for tile ${tile.id} due to: ${errorType}`);
      return { ...tile, hasImageError: true, errorType };
      
    case ErrorTypes.INSUFFICIENT_STORAGE:
      // Critical error - remove image and alert
      console.error(`Storage quota exceeded for tile ${tile.id}`);
      return { ...tile, image: null, hasImageError: true, errorType };
      
    default:
      // Keep original as safe fallback
      return { ...tile, hasImageError: true, errorType: 'UNKNOWN_ERROR' };
  }
}

// Create error information object
function createErrorInfo(tile, error, tileIndex) {
  return {
    tileId: tile.id || `tile_${tileIndex}`,
    tileIndex,
    error: error.message,
    errorType: classifyError(error),
    timestamp: new Date().toISOString()
  };
}

// Create empty processing result
function createEmptyProcessingResult() {
  return {
    totalTiles: 0,
    successCount: 0,
    failureCount: 0,
    errors: [],
    hasErrors: false,
    processingMethod: 'map'
  };
}

// Log batch processing results
function logBatchResults(batchStart, batchResults) {
  const batchNumber = Math.floor(batchStart / CONFIG.BATCH_SIZE) + 1;
  const successful = batchResults.filter(r => r.status === 'fulfilled').length;
  const failed = batchResults.filter(r => r.status === 'rejected').length;
  
  console.log(`Batch ${batchNumber} completed: ${successful} successful, ${failed} failed`);
}

// Create hash for image content caching
function createImageHash(base64String) {
  return crypto.createHash('md5').update(base64String).digest('hex');
}

// Track cache hits and misses
let cacheStats = { hits: 0, misses: 0 };

function incrementCacheStats(type) {
  cacheStats[type]++;
}

function getCacheStats() {
  return { ...cacheStats };
}

function resetCacheStats() {
  cacheStats = { hits: 0, misses: 0 };
}

/**
 * Create unique filename from tile data
 * @param {Object} tile - Tile object
 * @param {string} extension - File extension
 * @param {string} fallbackId - Fallback ID if no tile data available
 * @returns {string} Sanitized filename
 */
function createUniqueFilename(tile, extension, fallbackId = 'unknown') {
  let baseName = 'tile-image';
  
  if (tile) {
    // Try to use tile label first, then id, then fallback
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
  
  // Sanitize filename: remove/replace invalid characters
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/[-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const finalName = sanitized || 'tile-image';
  
  const timestamp = Date.now();
  
  return `${finalName}-${timestamp}.${extension}`;
}

// Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export functions
module.exports = {
  processBase64Images,
  processWithMap,
  convertBase64ToBlob,
  isBase64Image,
  hasBase64Images,
  classifyError,
  handleImageError,
  getCacheStats,
  resetCacheStats,
  createUniqueFilename,
  ErrorTypes,
  CONFIG
};