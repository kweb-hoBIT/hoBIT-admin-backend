import express, { Request, Response } from 'express';
import { Pool } from '../../../../config/connectDB';
import { RowDataPacket } from 'mysql2';

const router = express.Router();

interface BulkDeleteEmailRequest {
  body: {
    email: string;
    user_id: number;
  };
}

interface BulkDeleteEmailResponse {
  statusCode: number;
  data: {
    message: string;
    updated_faqs: number;
    updated_senior_faqs: number;
  };
}

/**
 * @swagger
 * /api/emails/bulk-delete:
 *   delete:
 *     summary: 모든 FAQ와 Senior FAQ에서 특정 이메일을 일괄 삭제
 *     tags: [Emails]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               user_id:
 *                 type: number
 *     responses:
 *       200:
 *         description: 이메일이 성공적으로 삭제되었습니다
 */
router.delete(
  '/',
  async (
    req: Request,
    res: Response<BulkDeleteEmailResponse>
  ) => {
    const connection = await Pool.getConnection();
    const { email, user_id } = req.body;

    console.log('Bulk delete email request:', { email, user_id });

    if (!email || !user_id) {
      return res.status(400).json({
        statusCode: 400,
        data: {
          message: '이메일과 사용자 ID는 필수입니다.',
          updated_faqs: 0,
          updated_senior_faqs: 0,
        },
      });
    }

    try {
      await connection.beginTransaction();

      // FAQ 테이블 업데이트
      const [faqRows] = await connection.query<RowDataPacket[]>(
        'SELECT id, answer_ko, answer_en FROM faqs'
      );

      let updatedFaqCount = 0;

      for (const row of faqRows) {
        let answerKo = JSON.parse(row.answer_ko);
        let answerEn = JSON.parse(row.answer_en);
        let updated = false;

        // answer_ko에서 이메일 삭제 (빈 문자열로 변경)
        answerKo = answerKo.map((ans: any) => {
          if (ans.email === email) {
            updated = true;
            return { ...ans, email: '' };
          }
          return ans;
        });

        // answer_en에서 이메일 삭제 (빈 문자열로 변경)
        answerEn = answerEn.map((ans: any) => {
          if (ans.email === email) {
            updated = true;
            return { ...ans, email: '' };
          }
          return ans;
        });

        if (updated) {
          await connection.query(
            `UPDATE faqs 
             SET answer_ko = ?, answer_en = ?, updated_by = ? 
             WHERE id = ?`,
            [JSON.stringify(answerKo), JSON.stringify(answerEn), user_id, row.id]
          );
          updatedFaqCount++;
        }
      }

      await connection.commit();

      return res.status(200).json({
        statusCode: 200,
        data: {
          message: `이메일이 성공적으로 삭제되었습니다. (${updatedFaqCount}건)`,
          updated_faqs: updatedFaqCount,
          updated_senior_faqs: 0,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error('이메일 일괄 삭제 중 오류 발생:', error);
      return res.status(500).json({
        statusCode: 500,
        data: {
          message: '이메일 삭제 중 오류가 발생했습니다.',
          updated_faqs: 0,
          updated_senior_faqs: 0,
        },
      });
    } finally {
      connection.release();
    }
  }
);

export default router;
