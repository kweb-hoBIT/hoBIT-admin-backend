import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import auth from '../../../middleware/auth';
import { Pool } from '../../../../config/connectDB';

const router = Router();

interface BulkUpdateAdminRequestBody {
  old_admin: string;
  new_admin: string;
  user_id: number;
}

router.put(
  '/',
  auth,
  async (req: Request, res: Response) => {
    const { old_admin, new_admin, user_id }: BulkUpdateAdminRequestBody = req.body;

    console.log('Bulk update admin request:', { old_admin, new_admin, user_id });

    if (!old_admin || !new_admin || !user_id) {
      return res.status(400).json({
        statusCode: 400,
        data: {
          message: '변경 전 관리자, 변경 후 관리자, 사용자 ID는 필수입니다.',
          updated_faqs: 0,
        },
      });
    }

    let connection;

    try {
      connection = await Pool.getConnection();
      await connection.beginTransaction();

      // FAQ 테이블의 manager 칼럼 업데이트
      const [result] = await connection.query(
        `UPDATE faqs 
         SET manager = ?, updated_by = ? 
         WHERE manager = ?`,
        [new_admin, user_id, old_admin]
      );

      const updatedFaqCount = (result as any).affectedRows || 0;

      await connection.commit();

      return res.status(200).json({
        statusCode: 200,
        data: {
          message: `관리자가 성공적으로 변경되었습니다. (${updatedFaqCount}건)`,
          updated_faqs: updatedFaqCount,
        },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('관리자 일괄 변경 중 오류 발생:', error);
      return res.status(500).json({
        statusCode: 500,
        data: {
          message: '관리자 변경 중 오류가 발생했습니다.',
          updated_faqs: 0,
        },
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

export default router;
