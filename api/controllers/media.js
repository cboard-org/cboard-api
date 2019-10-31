const { createBlockBlobFromText } = require('../helpers/blob');

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

module.exports = {
  uploadMedia
};

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
