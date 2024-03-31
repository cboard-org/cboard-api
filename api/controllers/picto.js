const { Midjourney } = require('midjourney');

module.exports = {
  createPicto: createPicto,
  changePicto: changePicto
};

const client = new Midjourney({
  ServerId: process.env.PICTO_SERVER_ID,
  ChannelId: process.env.PICTO_CHANNEL_ID,
  SalaiToken: process.env.PICTO_SALAI_TOKEN,
  Debug: false,
  Ws: true, //enable ws is required for remix mode (and custom zoom)
});

async function initClient() {
  await client.init();
}

async function createPicto(req, res) {

  const basePrompt = " colored as a pictogram in arasaac style with white background --style 56xABarnXQy --version 5.2 --fast";

  //Generate the Midjourney image 
  try {
    const Imagine = await client.Imagine(
      req.body.prompt + basePrompt,
      (uri, progress) => {
        //console.log("loading", uri, "progress", progress);
      }
    );
    if (!Imagine) {
      console.error('Error generating AI image');
      return res.status(409).json({
        message: 'Error generating AI image',
        error: 'Midjourney api error'
      });
    }

    // Get id for the first image 
    const U1CustomID = Imagine.options?.find((o) => o.label === "U1")?.custom;
    if (!U1CustomID) {
      return res.status(409).json({
        message: 'Error getting the id of the first generated AI image',
        error: 'Midjourney api error'
      });
    }

    // Upscale the first generated image 
    const Upscale = await client.Custom({
      msgId: Imagine.id,
      flags: Imagine.flags,
      customId: U1CustomID,
      loading: (uri, progress) => {
        //console.log("loading", uri, "progress", progress);
      },
    });
    if (!Upscale) {
      console.error('Error upscaling the first generated image');
      return res.status(409).json({
        message: 'Error upscaling the first generated image',
        error: 'Midjourney api error'
      });
    }
    const changeImageIds = Imagine.options.splice(0, 4).map(option => option.custom);
    return res.status(200).json({
      url: Upscale.uri,
      id: Imagine.id,
      content: Upscale.content,
      progress: Upscale.progress,
      proxy_url: Upscale.proxy_url,
      changeImageIds: changeImageIds
    });
  } catch (err) {
    console.error('Error generating or upscaling the image');
    return res.status(409).json({
      message: 'Error generating or upscaling the image',
      error: err.message
    });
  }
}

async function changePicto(req, res) {
  if (!req.body.changeImageId | !req.body.imageId) {
    return res.status(409).json({
      message: 'Error getting the id of the generated AI image',
      error: 'Input parameters missed'
    });
  }

  // Upscale the first generated image 
  try {
    const Upscale = await client.Custom({
      msgId: req.body.imageId,
      flags: 0,
      customId: req.body.changeImageId,
      loading: (uri, progress) => {
        //console.log("loading", uri, "progress", progress);
      },
    });
    if (!Upscale) {
      console.error('Error upscaling the generated image');
      return res.status(409).json({
        message: 'Error upscaling the generated image',
        error: 'Midjourney api error'
      });
    }
    return res.status(200).json({
      url: Upscale.uri,
      id: Upscale.id,
      content: Upscale.content,
      progress: Upscale.progress,
      proxy_url: Upscale.proxy_url,
      options: Upscale.options,
      flags: Upscale.flags
    });
  } catch (err) {
    console.error('Error upscaling the generated image');
    return res.status(409).json({
      message: 'Error upscaling the generated image',
      error: err.message
    });
  }
}
initClient();