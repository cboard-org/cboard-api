const { v1: uuidv1 } = require('uuid');

const azure = require('azure-storage');
const blobService = azure.createBlobService(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

module.exports = {
  createBlockBlobFromText,
  createOrReplaceBlockBlob
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
// like createBlockBlobFromText does.
async function createOrReplaceBlockBlob(
  containerName,
  blobName,
  buffer,
  mimetype
) {
  await createContainerIfNotExists(containerName);

  const options = {};
  if (mimetype && mimetype.length) {
    options.contentSettings = { contentType: mimetype };
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
