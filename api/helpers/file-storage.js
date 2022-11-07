const fs = require('fs');
const path = require('path');

// https://github.com/Azure/azure-storage-node/blob/v3.0.100/lib/common/util/util.js#L366-L375
function normalizeArgs(optionsOrCallback, callback) {
  let options = {};
  if (typeof optionsOrCallback === 'function' && !callback) {
    callback = optionsOrCallback;
  } else if (optionsOrCallback) {
    options = optionsOrCallback;
  }

  return { callback, options };
}

class FileSystemBlobService {
  constructor(fileStorageFolder, baseUrl) {
    this.fileStorageFolder = fileStorageFolder;
    this.baseUrl = baseUrl;
    this.fileStoragePath = path.join(
      __dirname,
      '../../public/',
      fileStorageFolder
    );
  }

  createContainerIfNotExists(container, optionsOrCallback, callbackArgument) {
    const { callback } = normalizeArgs(optionsOrCallback, callbackArgument);
    const result = { created: false };
    const response = { isSuccessful: false };

    fs.mkdir(
      this.resolveContainerPath(container),
      { recursive: true },
      function(e) {
        if (e) {
          callback(e, result, response);
        }

        result.created = true;
        response.isSuccessful = true;

        callback(null, result, response);
      }
    );
  }

  createBlockBlobFromText(
    container,
    fileName,
    blob,
    optionsOrCallback,
    callbackArgument
  ) {
    const { callback } = normalizeArgs(optionsOrCallback, callbackArgument);

    fs.writeFile(
      path.join(this.resolveContainerPath(container), fileName),
      blob,
      e => {
        if (e) {
          callback(e, {}, {});
        }
        const file = {
          container,
          name: fileName
        };
        callback(null, file, {});
      }
    );
  }

  getUrl(container, name) {
    console.log(
      path.join('/', this.fileStorageFolder, container, name),
      this.baseUrl
    );
    const url = new URL(
      path.join('/', this.fileStorageFolder, container, name),
      this.baseUrl
    );
    return url.href;
  }

  resolveContainerPath(container) {
    return path.resolve(this.fileStoragePath, container);
  }
}

const createBlobService = () => {
  const apiUrl = new URL('http://localhost:10010');
  if (process.env.DEV_ENV_WITH_HTTPS) {
    apiUrl.protocol = 'https';
  }
  if (process.env.PORT) {
    apiUrl.port = process.env.PORT;
  }
  if (process.env.API_HOST) {
    apiUrl.host = process.env.API_HOST;
  }

  return new FileSystemBlobService('uploads', apiUrl);
};

module.exports = {
  createBlobService
};
