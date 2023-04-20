const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
  organization: 'org-sqsTEpBAiD8oLP85mbdsZGsC',
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

module.exports = {
  editPhrase
};

async function editPhrase(req, res) {
  const phraseToEdit = req.body.phrase;
  if (!phraseToEdit) {
    return res.status(400).json();
  }

  try {
    const completionRequestParams = {
      model: 'text-davinci-003',
      prompt: `join this sequence of words in a coherent sentence, completing with connectors and articles when necessary: '${phraseToEdit}'`,
      max_tokens: 20,
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
