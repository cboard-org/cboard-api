const { Configuration, OpenAIApi } = require('openai');
const apiKey = process.env.AZURE_OPENAI_API_KEY;

const configuration = new Configuration({
  apiKey,
  basePath: 'https://cboard-openai.openai.azure.com/openai/deployments/ToEdit',
  baseOptions: {
    headers: { 'api-key': apiKey },
    params: {
      'api-version': '2022-12-01'
    }
  }
});

const openai = new OpenAIApi(configuration);

module.exports = {
  editPhrase
};

async function editPhrase(req, res) {
  const phraseToEdit = req.body.phrase;
  const phraseLanguage = req.body.language;
  if (!phraseToEdit) {
    return res.status(400).json();
  }

  try {
    const completionRequestParams = {
      model: 'text-davinci-003',
      prompt: `grammatically improve this phrase: '${phraseToEdit}'. The result should be in '${phraseLanguage}'. Don't add aditional information to the phrase.`,
      max_tokens: 50,
      temperature: 0
    };
    const response = await openai.createCompletion(completionRequestParams);

    const editedPhrase = response.data?.choices[0]?.text;
    if (editedPhrase) return res.status(200).json({ phrase: editedPhrase });
  } catch (e) {
    console.log(e);
  }

  return res.status(400).json();
}
