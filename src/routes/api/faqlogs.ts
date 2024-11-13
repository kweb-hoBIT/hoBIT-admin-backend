import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";

const router = express.Router();


// FAQ 로그 가져오기 API
router.get('/', async (req: Request, res: Response) => {
  const lang = req.query.lang || 'en'; // 기본 언어는 영어로 설정
  // MySQL 연결 풀에서 연결을 가져옴
  const connection: PoolConnection = await Pool.getConnection();

  try {
    // SQL 쿼리 작성/실행
    const query = `
      SELECT 
        faq_logs.id AS faq_log_id,
        faq_logs.user_id,
        users.username,
        faq_logs.faq_id,
        faqs.maincategory_${lang} AS faq_main,
        faqs.subcategory_${lang} AS faq_sub,
        faqs.question_${lang} AS faq_question,
        faq_logs.action_type,
        faq_logs.created_at
      FROM faq_logs
      LEFT JOIN users ON faq_logs.user_id = users.id
      LEFT JOIN faqs ON faq_logs.faq_id = faqs.id
    `;
    
    const [rows] = await connection.execute(query);
    console.log('Rows:', rows)

    // 응답 반환
    res.status(200).json({ logs: rows });

  } catch (error) {
    console.error('Error fetching FAQ logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    // 연결 반환 (finally에서 항상 실행되도록)
    if (connection) {
      connection.release();
    }
  }
});

// 특정 FAQ 로그 가져오기 API
router.get('/:id', async (req: Request, res: Response) => {
  const faqLogId = req.params.id; // 요청 URL에서 faq_log_id를 가져옴
  // MySQL 연결 풀에서 연결을 가져옴
  const connection: PoolConnection = await Pool.getConnection();

  try {
    // SQL 쿼리 작성/실행
    const query = `
      SELECT 
        faq_logs.id AS faq_log_id,
        faq_logs.user_id,
        users.username,
        faq_logs.faq_id,
        faqs.maincategory_${req.query.lang || 'en'} AS faq_main,
        faqs.subcategory_${req.query.lang || 'en'} AS faq_sub,
        faqs.question_${req.query.lang || 'en'} AS faq_question,
        faq_logs.action_type,
        faq_logs.created_at,
        faq_logs.prev_faq,
        faq_logs.new_faq
      FROM faq_logs
      LEFT JOIN users ON faq_logs.user_id = users.id
      LEFT JOIN faqs ON faq_logs.faq_id = faqs.id
      WHERE faq_logs.id = ?
    `;
    
    const [rows] = await connection.query<RowDataPacket[]>(query, [faqLogId]);
    console.log("Rows in faq:id", rows);

    if (rows.length === 0) {
      return res.status(404).json({ message: "FAQ log not found" });
    }

    const row = rows[0];

    // prev_faq와 new_faq가 JSON 형식인지 확인하여 JSON 파싱 시도
    let prevFaq = {}, newFaq = {};
    try {
      prevFaq = JSON.parse(row.prev_faq);
    } catch (e) {
      prevFaq = row.prev_faq; // JSON 파싱이 실패하면 원래 문자열로 사용
    }
    try {
      newFaq = JSON.parse(row.new_faq);
    } catch (e) {
      newFaq = row.new_faq; // JSON 파싱이 실패하면 원래 문자열로 사용
    }

    // 응답 반환
    res.status(200).json({
      faq_log_id: row.faq_log_id,
      prev_faq: prevFaq,
      new_faq: newFaq
    });

  } catch (error) {
    console.error('Error fetching FAQ log:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    // 연결 반환 (finally에서 항상 실행되도록)
    if (connection) {
      connection.release();
    }
  }
});



export default router;
