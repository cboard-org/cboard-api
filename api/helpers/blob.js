const { v1: uuidv1 } = require('uuid');

const azure = require('azure-storage');
const config = require('../../config');
const blobService = azure.createBlobService(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

module.exports = {
  createBlockBlobFromText,
  createOrReplaceBlockBlob,
  toCdnUrl
};

function createContainerIfNotExists(shareName) {
  return new Promise((resolve, reject) => {
    blobService.createContainerIfNotExists(shareName, function(error, result) {
      if (!error) {
        resolve(result);
      } else {
        reject(error);
      }
    });
  });
}

// Returns [file:BlobResult, fileUrl:string]
async function createBlockBlobFromText(
  containerName,
  fileName,
  file,
  prefix = ''
) {
  await createContainerIfNotExists(containerName);

  const { buffer, mimetype } = file;

  const options = {};
  if (mimetype && mimetype.length) {
    const cacheMaxAgeInSeconds = 31536000;
    options.contentSettings = {
      contentType: mimetype,
      cacheControl: `max-age=${cacheMaxAgeInSeconds}`
    };
  }

  const ts = Math.round(new Date().getTime() / 1000);
  const uuidSuffix = uuidv1()
    .split('-')
    .pop();
  const finalName = `${prefix}_${ts}_${uuidSuffix}_${fileName
    .toLowerCase()
    .trim()}`;

  return new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(
      containerName,
      finalName,
      buffer,
      options,
      function(error, file) {
        if (error) {
          reject(error);
          return;
        }

        resolve([file, blobService.getUrl(file.container, file.name)]);
      }
    );
  });
}

// Returns [file:BlobResult, fileUrl:string]. Uploads to the exact blobName given,
// overwriting any existing blob at that path — for content that should live at a
// stable, reusable URL (e.g. QR codes) instead of getting a unique name per upload
// like createBlockBlobFromText does. Uses a short cache so overwrites reach the CDN.
async function createOrReplaceBlockBlob(
  containerName,
  blobName,
  buffer,
  mimetype
) {
  await createContainerIfNotExists(containerName);

  const options = {};
  if (mimetype && mimetype.length) {
    const cacheMaxAgeInSeconds = 3600;
    options.contentSettings = {
      contentType: mimetype,
      cacheControl: `max-age=${cacheMaxAgeInSeconds}`
    };
  }

  return new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(
      containerName,
      blobName,
      buffer,
      options,
      function(error, file) {
        if (error) {
          reject(error);
          return;
        }

        resolve([file, blobService.getUrl(file.container, file.name)]);
      }
    );
  });
}

// Rewrites a production blob URL to its CDN equivalent when a CDN is configured
function toCdnUrl(fileUrl) {
  return config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME &&
    config.AZURE_CDN_URL &&
    fileUrl.startsWith(config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME)
    ? fileUrl.replace(
        config.CBOARD_PRODUCTION_BLOB_CONTAINER_HOSTNAME,
        config.AZURE_CDN_URL
      )
    : fileUrl;
}
