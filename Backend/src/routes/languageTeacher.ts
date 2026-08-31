import express from 'express';
import { OpenAI } from 'openai'; // Assuming you have an OpenAI client set up
import { handleError } from '../middleware/errorHandler'; // Adjust the import based on your structure

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Ensure your API key is set in the environment

router.post('/explain', async (req, res) => {
  const { text, targetPhrase, learningLanguage, nativeLanguage } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Explain the phrase "${targetPhrase}" in the context of "${text}". Include a definition, CEFR level, Georgian translation, and two example sentences.`,
        },
      ],
    });
    const explanation = response.choices[0].message.content;
    res.json({ explanation });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/translate', async (req, res) => {
  const { text, targetPhrase, learningLanguage, nativeLanguage } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Translate the phrase "${targetPhrase}" from "${nativeLanguage}" to "${learningLanguage}".`,
        },
      ],
    });
    const translation = response.choices[0].message.content;
    res.json({ translation });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/analyze-pronunciation', async (req, res) => {
  const { referenceText, transcribedText, learningLanguage, nativeLanguage } = req.body;
  try {
    // Implement your pronunciation analysis logic here
    // This is a placeholder for the actual implementation
    const feedback = []; // Replace with actual feedback logic
    const overallAdvice = "Overall advice based on analysis"; // Replace with actual advice logic
    res.json({ feedback, overallAdvice });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
