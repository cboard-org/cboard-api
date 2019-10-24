const uuidv1 = require('uuid/v1');
const azure = require('azure-storage');
const blobService = azure.createBlobService(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

module.exports = {
  createBlockBlobFromText
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

async function createBlockBlobFromText(containerName, fileName, file) {
  await createContainerIfNotExists(containerName);

  const { buffer, mimetype } = file;

  const options = {};
  if (mimetype && mimetype.length) {
    options.contentSettings = {
      contentType: mimetype
    };
  }

  const ts = Math.round(new Date().getTime() / 1000);
  const uuidSuffix = uuidv1()
    .split('-')
    .pop();
  const finalName = `${ts}_${uuidSuffix}_${fileName.toLowerCase().trim()}`;

  return await new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(
      containerName,
      finalName,
      buffer,
      options,
      function(error, result) {
        if (!error) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
  });
}
