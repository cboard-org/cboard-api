const { createBlockBlobFromText } = require('../helpers/blob');

const BLOB_CONTAINER_NAME =
  process.env.ANALYTICS_BLOB_CONTAINER_NAME || 'analytics';

module.exports = {
  uploadAnalytics
};

async function uploadAnalytics(req, res) {
  let url = null;

  try {
    const [file, urlResult] = await createBlockBlobFromText(
      BLOB_CONTAINER_NAME,
      req.user.email,
      req.files.file[0],
      'analytics'
    );
    url = urlResult;
  } catch (err) {
    return res.status(500).json({
      message: 'ERROR: Unable to upload analytics file . ' + err.message
    });
  }
  return res.status(200).json({ url });
}
