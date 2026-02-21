import { Router, Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import auth from '../../../middleware/auth';
import { Pool } from '../../../../config/connectDB';

const router = Router();

router.get('/', auth, async (req: Request, res: Response) => {
  let connection;

  try {
    connection = await Pool.getConnection();

    // FAQ 테이블에서 모든 관리자 추출
    const [faqRows] = await connection.query<RowDataPacket[]>(
      'SELECT DISTINCT manager FROM faqs WHERE manager IS NOT NULL AND manager != ""'
    );

    const adminSet = new Set<string>();

    // manager 칼럼에서 관리자 추출
    for (const row of faqRows) {
      if (row.manager && row.manager.trim() !== '') {
        adminSet.add(row.manager);
      }
    }

    const admins = Array.from(adminSet).sort();

    return res.status(200).json({
      statusCode: 200,
      data: {
        admins,
        count: admins.length,
      },
    });
  } catch (error) {
    console.error('관리자 목록 조회 중 오류 발생:', error);
    return res.status(500).json({
      statusCode: 500,
      data: {
        message: '관리자 목록 조회 중 오류가 발생했습니다.',
        admins: [],
        count: 0,
      },
    });
  } finally {
    if (connection) connection.release();
  }
});

export default router;
