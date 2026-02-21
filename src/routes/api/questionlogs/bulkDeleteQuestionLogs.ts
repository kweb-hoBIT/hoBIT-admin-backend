import { Router, Request, Response } from 'express';
import auth from '../../../middleware/auth';
import { Pool } from '../../../../config/connectDB';

const router = Router();

interface BulkDeleteQuestionLogsRequestBody {
  before_date?: string;
  user_id: number;
}

router.delete(
  '/',
  auth,
  async (req: Request, res: Response) => {
    const { before_date, user_id }: BulkDeleteQuestionLogsRequestBody = req.body;

    console.log('Bulk delete question logs request:', { before_date, user_id });

    if (!user_id) {
      return res.status(400).json({
        statusCode: 400,
        data: {
          message: '사용자 ID는 필수입니다.',
          deleted_count: 0,
        },
      });
    }

    let connection;

    try {
      connection = await Pool.getConnection();
      await connection.beginTransaction();

      let query = 'DELETE FROM question_logs WHERE 1=1';
      const params: any[] = [];

      // 날짜 필터
      if (before_date) {
        query += ' AND created_at < ?';
        params.push(before_date);
      }

      const [result] = await connection.query(query, params);
      const deletedCount = (result as any).affectedRows || 0;

      await connection.commit();

      return res.status(200).json({
        statusCode: 200,
        data: {
          message: `유저 로그가 성공적으로 삭제되었습니다. (${deletedCount}건)`,
          deleted_count: deletedCount,
        },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('유저 로그 일괄 삭제 중 오류 발생:', error);
      return res.status(500).json({
        statusCode: 500,
        data: {
          message: '유저 로그 삭제 중 오류가 발생했습니다.',
          deleted_count: 0,
        },
      });
    } finally {
      if (connection) connection.release();
    }
  }
);

export default router;
