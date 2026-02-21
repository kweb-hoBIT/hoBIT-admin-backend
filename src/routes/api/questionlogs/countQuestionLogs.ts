import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import auth from '../../../middleware/auth';
import { Pool } from '../../../../config/connectDB';

const router = Router();

router.get('/', auth, async (req: Request, res: Response) => {
  const { before_date } = req.query;
  
  let connection;

  try {
    connection = await Pool.getConnection();

    let query = 'SELECT COUNT(*) as count FROM question_logs WHERE 1=1';
    const params: any[] = [];

    // 날짜 필터
    if (before_date) {
      query += ' AND created_at < ?';
      params.push(before_date);
    }

    const [rows] = await connection.query<RowDataPacket[]>(query, params);
    const count = rows[0].count;

    return res.status(200).json({
      statusCode: 200,
      data: {
        count,
      },
    });
  } catch (error) {
    console.error('유저 로그 카운트 조회 중 오류 발생:', error);
    return res.status(500).json({
      statusCode: 500,
      data: {
        message: '유저 로그 카운트 조회 중 오류가 발생했습니다.',
        count: 0,
      },
    });
  } finally {
    if (connection) connection.release();
  }
});

export default router;
