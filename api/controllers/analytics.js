const { createBlockBlobFromText } = require('../helpers/blob');

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

module.exports = {
  uploadAnalytics
};

async function uploadAnalytics(req, res) {
  let url = null;

  try {
    const [file, urlResult] = await createBlockBlobFromText(
      BLOB_CONTAINER_NAME,
      req.user.email + '.analytics',
      req.files.file[0]
    );
    url = urlResult;
  } catch (e) {
    console.error(e);
  }

  res.status(url ? 200 : 500).json({ url });
}
