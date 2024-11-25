import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";

const router = express.Router();

// @route   Post api/faqlogs/
// @desc    Create a faq_log
// @access  Private
router.post("/", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const {
    user_id,
    faq_id,
    prev_faq,
    new_faq,
    action_type
  }: {
    user_id: number;
    faq_id: number;
    prev_faq: Record<string, any>;
    new_faq: Record<string, any>;
    action_type: string;
  } = req.body;
  try { 
    await connection.execute(
      `INSERT INTO faq_logs (
        user_id, faq_id, action_type, prev_faq, new_faq) 
        VALUES (?, ?, ?, ?, ?)`,
      [
        user_id,
        faq_id,
        action_type,
        JSON.stringify(prev_faq),
        JSON.stringify(new_faq)
      ]
    );
    const response = {
      status: "success",
      message: "FAQ log created successfully"
    };
    console.log(response);
    res.status(201).json(response);
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});


// @route   Get api/faqlogs/
// @desc    Get all faq_logs
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const [faqLogs] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        faq_logs.id AS faq_log_id,
        faq_logs.user_id,
        users.username,
        faq_logs.faq_id,
        faqs.maincategory_ko AS faq_maincategory,
        faqs.subcategory_ko AS faq_subcategory,
        faqs.question_ko AS faq_question,
        faq_logs.action_type,
        faq_logs.created_at
      FROM hobit.faq_logs
      LEFT JOIN hobit.users ON faq_logs.user_id = users.id
      LEFT JOIN hobit.faqs ON faq_logs.faq_id = faqs.id
      ORDER BY faq_logs.created_at DESC`
    );
    const response = {
      status: "success",
      messeage: "FAQ logs retrieved successfully",
      data: {
        faqLogs
      }
    }
    console.log(response);
    res.status(200).json(response);

  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});


// @route   Post api/faqlogs/:faq_log_id
// @desc    Get a faq_log
// @access  Private
router.get('/:faq_log_id', async (req: Request<{ faq_log_id: string }>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const {faq_log_id} = req.params;
  try {
    const [[faqLog]] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        faq_logs.id AS faq_log_id,
        faq_logs.user_id,
        users.username,
        faq_logs.faq_id,
        faqs.maincategory_ko AS faq_maincategory,
        faqs.subcategory_ko AS faq_subcateogory,
        faqs.question_ko AS faq_questioncategory,
        faq_logs.action_type,
        faq_logs.created_at
      FROM hobit.faq_logs
      LEFT JOIN hobit.users ON faq_logs.user_id = users.id
      LEFT JOIN hobit.faqs ON faq_logs.faq_id = faqs.id
      WHERE faq_logs.id = ?`
      , [faq_log_id]
    );
    const response = {
      status: "success",
      message: "FAQ log retrieved successfully",
      data: {
        faqLog
      }
    }
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});


// @route   Post api/faqlogs/compare/:faq_log_id
// @desc    Get a comparison of the faq_log
// @access  Private
router.get('/compare/:faq_log_id', async (req: Request<{ faq_log_id: string }>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const {faq_log_id} = req.params;

  try {
    const [[faqLog]] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        faq_logs.prev_faq,
        faq_logs.new_faq
      FROM faq_logs
      WHERE faq_logs.id = ?
      `, [faq_log_id]
    )

    if (!faqLog) {
      return res.status(404).json({
        status: "fail",
        message: "FAQ log not found"
      });
    }

    let prevFaq = {}, newFaq = {};
    prevFaq = safetyParse(faqLog.prev_faq);
    newFaq = safetyParse(faqLog.new_faq);

    const response = {
      status: "success",
      message: "FAQ log comparison retrieved successfully",
      data: {
        prev_faq: prevFaq,
        new_faq: newFaq
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});

function safetyParse<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return undefined;
  }
}

export default router;