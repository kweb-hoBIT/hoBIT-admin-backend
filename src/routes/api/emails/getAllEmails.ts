import express, { Request, Response } from 'express';
import { Pool } from '../../../../config/connectDB';
import { RowDataPacket } from 'mysql2';

const router = express.Router();

interface GetAllEmailsResponse {
  statusCode: number;
  data: {
    emails: string[];
  };
}

/**
 * @swagger
 * /api/emails:
 *   get:
 *     summary: FAQ와 Senior FAQ에서 사용중인 모든 이메일 조회
 *     tags: [Emails]
 *     responses:
 *       200:
 *         description: 이메일 목록 조회 성공
 */
router.get(
  '/',
  async (
    req: Request,
    res: Response<GetAllEmailsResponse>
  ) => {
    const connection = await Pool.getConnection();

    try {
      const emailSet = new Set<string>();

      // FAQ 테이블에서 이메일 추출
      const [faqRows] = await connection.query<RowDataPacket[]>(
        'SELECT answer_ko, answer_en FROM faqs'
      );

      for (const row of faqRows) {
        try {
          const answerKo = JSON.parse(row.answer_ko);
          const answerEn = JSON.parse(row.answer_en);

          answerKo.forEach((ans: any) => {
            if (ans.email && ans.email.trim()) {
              emailSet.add(ans.email.trim());
            }
          });

          answerEn.forEach((ans: any) => {
            if (ans.email && ans.email.trim()) {
              emailSet.add(ans.email.trim());
            }
          });
        } catch (e) {
          // JSON 파싱 실패 시 무시
        }
      }

      // Senior FAQ 테이블에서 이메일 추출
      const [seniorFaqRows] = await connection.query<RowDataPacket[]>(
        'SELECT answer_ko, answer_en FROM senior_faqs'
      );

      for (const row of seniorFaqRows) {
        try {
          const answerKo = JSON.parse(row.answer_ko);
          const answerEn = JSON.parse(row.answer_en);

          answerKo.forEach((ans: any) => {
            if (ans.email && ans.email.trim()) {
              emailSet.add(ans.email.trim());
            }
          });

          answerEn.forEach((ans: any) => {
            if (ans.email && ans.email.trim()) {
              emailSet.add(ans.email.trim());
            }
          });
        } catch (e) {
          // JSON 파싱 실패 시 무시
        }
      }

      const emails = Array.from(emailSet).sort();

      return res.status(200).json({
        statusCode: 200,
        data: {
          emails,
        },
      });
    } catch (error) {
      console.error('이메일 목록 조회 중 오류 발생:', error);
      return res.status(500).json({
        statusCode: 500,
        data: {
          emails: [],
        },
      });
    } finally {
      connection.release();
    }
  }
);

export default router;
