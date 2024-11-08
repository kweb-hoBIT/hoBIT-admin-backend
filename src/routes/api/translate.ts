import express, { Request, Response } from "express";

const router = express.Router();

// @route   Post api/translate/
// @desc    Translate the given text and return the translated result
// @access  Private
router.post("/", async (req: Request, res: Response) => {
  const { text }: { text: string } = req.body;
  console.log(text);

  try {
    const translate_response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        auth_key: "1409a680-0ddb-4f6a-9afb-aa6948a92e21:fx",
        text: text,
        target_lang: 'EN',
      }).toString(),
    });

    if (!translate_response.ok) {
      const errorData = await translate_response.json();
      return res.status(translate_response.status).json({ error: errorData.message });
    }

    const data = await translate_response.json();
    const translatedText = data.translations[0].text;
    const response = { translatedText };
    console.log(response);

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Translation failed' });
  }
});

export default router;
