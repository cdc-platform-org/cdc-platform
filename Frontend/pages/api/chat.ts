import type { NextApiRequest, NextApiResponse } from 'next';

// 🔑 აზურეს პარამეტრები (აქ ჩაწერ შენს რეალურ მონაცემებს აზურეს პანელიდან)
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource.openai.azure.com/";
const AZURE_KEY = process.env.AZURE_OPENAI_KEY || "YOUR_AZURE_API_KEY";
const DEPLOYMENT_NAME = "cdc-chatbot-model"; // შენი მოდელის სახელი აზურეში

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, lang } = req.body;

  // 🧠 სისტემური ინსტრუქცია (System Prompt) ბოტის გასაწვრთნელად
  const systemPrompt = `
    You are the official AI Career Assistant for CDC (Digital Careers Center) in Guria, Georgia.
    Supported by HEKS/EPER Georgia.
    Courses available:
    1. Vibe Coding - Web Development with AI (2 months, instructor: Imedo Martikovi).
    2. Social Media Marketing & AI (2 months, instructor: Marika Gagua).
    3. Graphic Design with Figma & AI (1 month, mentor: Ia Tavdishvili).
    
    Rules:
    - Always respond in the language requested by the user. Current language state: ${lang}.
    - Be polite, helpful, and act like a tech career expert.
    - If asked about high-paying jobs, mention that tech, AI engineering and programming (like Vibe Coding) are at the top right now.
  `;

  try {
    // 🌐 ვუკავშირდებით Azure OpenAI REST API-ს პირდაპირ ფეჩით
    const response = await fetch(`${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=2023-05-15`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_KEY
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 800,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      const botReply = data.choices[0].message.content;
      return res.status(200).json({ reply: botReply });
    } else {
      return res.status(500).json({ reply: lang === 'GEO' ? '🤖 აზურეს მოდელმა პასუხი ვერ დააბრუნა.' : '🤖 Azure model failed to respond.' });
    }

  } catch (error) {
    console.error("Azure AI Integration Error:", error);
    return res.status(500).json({ reply: lang === 'GEO' ? '❌ ბექენდის ხარვეზი აზურესთან კავშირისას.' : '❌ Backend error connecting to Azure.' });
  }
}