const https =require("https");

module.exports = {
    downloadFileFromUrl
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
              };
              resolve(uploadedFile);
          });
        })}catch(err){
          throw(err);
        }
    })  
  }