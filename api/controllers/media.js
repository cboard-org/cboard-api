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
  } catch (e) {
    console.error(e);
  }

  res.status(url ? 200 : 500).json({ url });
}
