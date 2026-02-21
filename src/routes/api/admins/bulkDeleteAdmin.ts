import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import auth from '../../../middleware/auth';
import { Pool } from '../../../../config/connectDB';

const router = Router();

interface BulkDeleteAdminRequestBody {
  admin: string;
  user_id: number;
}

router.delete(
  '/',
  auth,
  async (req: Request, res: Response) => {
    const { admin, user_id }: BulkDeleteAdminRequestBody = req.body;

    console.log('Bulk delete admin request:', { admin, user_id });

    if (!admin || !user_id) {
      return res.status(400).json({
        statusCode: 400,
        data: {
          message: '삭제할 관리자와 사용자 ID는 필수입니다.',
          updated_faqs: 0,
        },
      });
    }

    let connection;

    try {
      connection = await Pool.getConnection();
      
      // 먼저 해당 관리자를 사용하는 FAQ 목록 확인
      const [faqRows] = await connection.query<RowDataPacket[]>(
        'SELECT id, question_ko FROM faqs WHERE manager = ? LIMIT 5',
        [admin]
      );
      
      if (faqRows.length > 0) {
        const faqList = faqRows.map(faq => `- [ID: ${faq.id}] ${faq.question_ko}`).join('\n');
        const message = `해당 관리자를 사용하는 FAQ가 ${faqRows.length}건 이상 존재합니다.\n\n사용 중인 FAQ:\n${faqList}\n\n먼저 FAQ의 관리자를 변경한 후 삭제해주세요.`;
        
        return res.status(400).json({
          statusCode: 400,
          data: {
            message: message,
            updated_faqs: 0,
          },
        });
      }

      await connection.beginTransaction();

      // FAQ가 없으면 진행 (실제로는 업데이트할 것이 없음)
      const [result] = await connection.query(
        `UPDATE faqs 
         SET manager = '', updated_by = ? 
         WHERE manager = ?`,
        [user_id, admin]
      );

      const updatedFaqCount = (result as any).affectedRows || 0;

      await connection.commit();

      return res.status(200).json({
        statusCode: 200,
        data: {
          message: `관리자가 성공적으로 삭제되었습니다. (${updatedFaqCount}건)`,
          updated_faqs: updatedFaqCount,
        },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('관리자 일괄 삭제 중 오류 발생:', error);
      return res.status(500).json({
        statusCode: 500,
        data: {
          message: '관리자 삭제 중 오류가 발생했습니다.',
          updated_faqs: 0,
        },
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

export default router;
