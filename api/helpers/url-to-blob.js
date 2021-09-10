const axios = require('axios');

module.exports = {
  downloadFileFromUrl
};

async function downloadFileFromUrl(baseUrl) {
  return new Promise((resolve, reject) => {
    try {
      axios({
        method: 'get',
        url: baseUrl,
        responseType: 'arraybuffer'
      }).then(result => {
        const encodedImage = new Uint8Array(result.data);
        const contentType = result.headers['content-type'];
        const fileName = extractFileName(result.headers['content-disposition']);
        const uploadedFile = {
          fieldname: 'file',
          originalname: fileName, //parse res.rawheaders to get original name and mimetype
          mimetype: contentType,
          buffer: encodedImage
        };
        resolve(uploadedFile);
      });
    } catch {
      throw err;
    }
  });
}

function extractFileName(contentDisposition) {
  const fromKey = 'filename="';
  const toKey = '.';

  const startIndex = contentDisposition.indexOf(fromKey) + fromKey.length;
  const endIndex = contentDisposition.indexOf(toKey, startIndex);

  return contentDisposition.slice(startIndex, endIndex);
}
