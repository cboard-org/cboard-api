const { BlobServiceClient } = require('@azure/storage-blob');
const uuidv1 = require('uuid/v1');

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

module.exports = {
  createBlockBlobFromText,
};

async function createContainerIfNotExists(containerName) {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const createResponse = await containerClient.createIfNotExists();
  return createResponse.succeeded;
}

// Returns [file:BlockBlobClient, fileUrl:string]
async function createBlockBlobFromText(containerName, fileName, file, prefix = '') {
  await createContainerIfNotExists(containerName);

  const { buffer, mimetype } = file;

  const ts = Math.round(new Date().getTime() / 1000);
  const uuidSuffix = uuidv1().split('-').pop();
  const finalName = `${prefix}_${ts}_${uuidSuffix}_${fileName.toLowerCase().trim()}`;

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(finalName);

  const options = {};
  if (mimetype && mimetype.length) {
    const cacheMaxAgeInSeconds = 31536000;
    options.blobHTTPHeaders = {
      blobContentType: mimetype,
      blobCacheControl: `max-age=${cacheMaxAgeInSeconds}`,
    };
  }

  await blockBlobClient.upload(buffer, buffer.length, options);

  return [blockBlobClient, blockBlobClient.url];
}
