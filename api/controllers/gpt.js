const { AzureOpenAI } = require('openai');

const client = new AzureOpenAI({
  endpoint: 'https://cboard-openai.cognitiveservices.azure.com',
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: '2024-02-01',
  deployment: 'gpt-4o-mini'
});

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
    const response = await client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: `grammatically improve this phrase: '${phraseToEdit}'. The result should be in '${phraseLanguage}'. Don't add additional information to the phrase.`
        }
      ],
      max_tokens: 50,
      temperature: 0
    });

    const editedPhrase = response.choices[0]?.message?.content;
    if (editedPhrase) return res.status(200).json({ phrase: editedPhrase });
  } catch (e) {
    console.log(e);
  }

  return res.status(400).json();
}
