var translate = require('translate-api');

module.exports = {
  translate: translateRequest
};

async function translateRequest(req, res) {
  const { body: { from, to, labels } } = req;
  let i10nLabels = {};
  await labels.reduce(async (prev, current) => {
    await prev;
    let translated = current;

    try {
      translated = await translate.getText(current, { from, to });
    } catch (e) {}

    i10nLabels[current] = translated;

    return prev;
  }, Promise.resolve({}));

  res.status(200).json(i10nLabels);
}
