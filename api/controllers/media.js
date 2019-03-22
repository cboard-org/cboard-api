const uuidv1 = require('uuid/v1');
const azure = require('azure-storage');
const blobService = azure.createBlobService(
  'DefaultEndpointsProtocol=https;AccountName=cboardgroupdiag483;AccountKey=vLQDLppDf6FvnODQ6hxS65rRw6mTtpYtmucxEqQ9ZvT4WfsV1F8ybVkw8JYHpm6zp8zPNMk9SMy4RBdEugnr6w==;EndpointSuffix=core.windows.net'
);

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

module.exports = {
  uploadMedia: uploadMedia
};

async function uploadMedia(req, res) {
  let url = null;

  try {
    await createContainerIfNotExists(BLOB_CONTAINER_NAME);
    const file = await createBlockBlobFromText(
      BLOB_CONTAINER_NAME,
      req.files.file[0]
    );
    url = blobService.getUrl(file.container, file.name);
  } catch (e) {}

  res.status(url ? 200 : 500).json({ url });
}

async function createContainerIfNotExists(shareName) {
  const result = await new Promise((resolve, reject) => {
    blobService.createContainerIfNotExists(shareName, function(error, result) {
      if (!error) {
        resolve(result);
      } else {
        reject(error);
      }
    });
  });
  return result;
}

async function createBlockBlobFromText(shareName, file) {
  const { originalname, buffer, mimetype } = file;

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
  const filename = `${ts}_${uuidSuffix}_${originalname.toLowerCase().trim()}`;

  const result = await new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(
      shareName,
      filename,
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

  return result;
}
