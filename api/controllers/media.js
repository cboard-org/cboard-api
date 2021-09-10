const { createBlockBlobFromText } = require('../helpers/blob');
const { downloadFileFromUrl } = require('../helpers/url-to-blob');

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

module.exports = {
  uploadMedia,
  uploadMediaFromUrl
};

async function uploadMediaFromUrl(req, res) {
  let url = null;
  const { body } = req;
  try {
    const reqUrl = body.url + '=w200-h200';
    const uploadedFile = await downloadFileFromUrl(reqUrl);
    const [file, fileUrl] = await createBlockBlobFromText(
      BLOB_CONTAINER_NAME,
      uploadedFile.originalname,
      uploadedFile
    );
    url = fileUrl;
  } catch (err) {
    return res.status(500).json({
      message: 'ERROR: Unable to upload media file . ' + err.message
    });
  }
  return res.status(200).json({ url });
}

async function uploadMedia(req, res) {
  let url = null;

  try {
    const uploadedFile = req.files.file[0];
    const [file, fileUrl] = await createBlockBlobFromText(
      BLOB_CONTAINER_NAME,
      uploadedFile.originalname,
      uploadedFile
    );
    url = fileUrl;
  } catch (err) {
    return res.status(500).json({
      message: 'ERROR: Unable to upload media file . ' + err.message
    });
  }
  return res.status(200).json({ url });
}
