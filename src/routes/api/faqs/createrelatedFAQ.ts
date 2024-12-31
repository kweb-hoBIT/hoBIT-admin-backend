import { Router } from "express";
import { OpenAI } from "openai";
import config from "config";

const router = Router();

const openai = new OpenAI({
  apiKey: config.get<string>("openaiApiKey"),
});

router.post("/related", async (req, res) => {
  try {
    const { question, count = 10 } = req.body;

    const koreanCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
          당신은 대학교 챗봇을 위한 자연스러운 질문을 생성하는 도우미입니다.
          요청된 질문과 관련된 유사한 질문들을 생성할 때 다음 지침을 따르세요:
          
          - 20대 대학생들이 실제로 사용할 법한 구어체와 캐주얼한 말투를 사용하세요
          - '~있나요?', '~할까요?', '~해주세요' 같은 딱딱한 표현보다는 '~있어?', '~할래?', '~해줘' 같은 친근한 표현을 사용하세요
          - 대학생들이 자주 쓰는 줄임말이나 구어체를 자연스럽게 포함하세요
          
          결과는 다음 JSON 형식으로 반환하세요:
          {
            "ko": ["질문1", "질문2", ...],
            "en": ["question1", "question2", ...]
          }
          `,
        },
        {
          role: "user",
          content: `다음 질문과 관련된 ${count}개의 유사한 질문을 생성하고 JSON 배열 형식으로 반환해주세요. 질문: "${question}"`,
        },
      ],
      temperature: 0.6,
    });

    const responseContent = koreanCompletion.choices[0].message.content;
    const relatedQuestions = JSON.parse(responseContent);

    res.json({
      success: true,
      originalQuestion: question,
      relatedQuestions,
    });
  } catch (error) {
    console.error("Error generating related questions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate related questions",
    });
  }
});

export default router;
