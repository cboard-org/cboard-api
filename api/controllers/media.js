const { createBlockBlobFromText } = require('../helpers/blob');

const https =require("https");

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

module.exports = {
  uploadMedia,
  uploadMediaFromUrl
};

async function downloadFileFromUrl(baseUrl){
  let uploadedFile = undefined;

  return new Promise((resolve, reject) => {
    try{  
      https.get(baseUrl, function(res){
        let data = [];
        
        res.on('data', function(chunk) {
          data.push(chunk);
        })
        .on('end', function() {
            var buffer = Buffer.concat(data);
            uploadedFile = {
              fieldname: 'file',
              originalname: 'GphotosMedia', //parse res.rawheaders to get original name and mimetype
              mimetype: 'image/jpg',
              buffer: buffer,
              size: 74399
            };
            resolve(uploadedFile);
        });
      })}catch(err){
        throw(err);
      }
  })  
}



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
