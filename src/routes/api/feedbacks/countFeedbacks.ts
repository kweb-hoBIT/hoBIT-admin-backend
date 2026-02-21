import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import auth from '../../../middleware/auth';
import { Pool } from '../../../../config/connectDB';

const router = Router();

router.get('/', auth, async (req: Request, res: Response) => {
  const { before_date, include_resolved, include_unresolved } = req.query;
  
  let connection;

  try {
    connection = await Pool.getConnection();

    let query = 'SELECT COUNT(*) as count FROM user_feedbacks WHERE 1=1';
    const params: any[] = [];

    // 날짜 필터
    if (before_date) {
      query += ' AND created_at < ?';
      params.push(before_date);
    }

    // 해결 여부 필터
    const resolvedFilter: string[] = [];
    if (include_resolved === 'true') {
      resolvedFilter.push('resolved = 1');
    }
    if (include_unresolved === 'true') {
      resolvedFilter.push('resolved = 0');
    }
    
    if (resolvedFilter.length > 0) {
      query += ` AND (${resolvedFilter.join(' OR ')})`;
    } else if (include_resolved === 'false' && include_unresolved === 'false') {
      // 둘 다 false면 0건 반환
      return res.status(200).json({
        statusCode: 200,
        data: {
          count: 0,
        },
      });
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
    console.error('피드백 카운트 조회 중 오류 발생:', error);
    return res.status(500).json({
      statusCode: 500,
      data: {
        message: '피드백 카운트 조회 중 오류가 발생했습니다.',
        count: 0,
      },
    });
  } finally {
    if (connection) connection.release();
  }
});

export default router;
