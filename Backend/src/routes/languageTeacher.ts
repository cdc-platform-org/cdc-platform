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

import { body, validationResult } from 'express-validator';

router.post(
  '/analyze-pronunciation',
  [
    body('referenceText').isString().notEmpty().withMessage('referenceText must be a non-empty string'),
    body('transcribedText').isString().notEmpty().withMessage('transcribedText must be a non-empty string'),
    body('learningLanguage').isString().notEmpty().withMessage('learningLanguage must be a non-empty string'),
    body('nativeLanguage').isString().notEmpty().withMessage('nativeLanguage must be a non-empty string'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { referenceText, transcribedText, learningLanguage, nativeLanguage } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Compare the following reference text and transcribed text word by word. 
                    Score each word as GREEN (correct), YELLOW (minor mistake), or RED (incorrect). 
                    Provide specific feedback for each word and generate constructive teacher advice in ${nativeLanguage}:
                    Reference Text: "${referenceText}"
                    Transcribed Text: "${transcribedText}"`,
        },
      ],
    });

    const { feedback, teacherAdvice } = JSON.parse(response.choices[0].message.content);
    res.json({ feedback, teacherAdvice });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/summarize', async (req, res) => {
  const { text } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Summarize the following text and provide its CEFR complexity level (A1, A2, B1, B2, C1, C2): "${text}"`,
        },
      ],
    });
    const summary = response.choices[0].message.content;
    res.json({ summary });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
