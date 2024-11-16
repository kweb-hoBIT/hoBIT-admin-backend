import express, { Request, Response } from "express";
import fetch from "node-fetch";

const router = express.Router();

// @route   POST api/translate/
// @desc    Translate the given text and return the translated result
// @access  Private
router.post("/", async (req: Request, res: Response) => {
  const { text }: { text: string } = req.body;
  console.log(text);

  try {
    const translateResponse = await fetch('https://api-free.deepl.com/v2/translate', {
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

    if (!translateResponse.ok) {
      const errorData = await translateResponse.json();
      return res.status(translateResponse.status).json({ error: errorData.message });
    }

    const data: { translations: { text: string }[] } = await translateResponse.json();
    const translatedText = data.translations[0].text;
    const response = {
      status: "success",
      message: "Text translated successfully",
      data: {
        translatedText,
      },
    };
    console.log(response);

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
});

export default router;
