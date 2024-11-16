import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import fetch from "node-fetch";

const router = express.Router();

// @route   Post api/faqs/
// @desc    Create a new FAQ
// @access  Private
router.post("/", async (req: Request, res: Response) => {
  const connection : PoolConnection = await Pool.getConnection();
  const {
    user_id,
    maincategory_ko,
    maincategory_en,
    subcategory_ko,
    subcategory_en,
    question_ko,
    question_en,
    answer_ko,
    answer_en,
    manager
  }: {
    user_id: number;
    maincategory_ko: string;
    maincategory_en: string;
    subcategory_ko: string;
    subcategory_en: string;
    question_ko: string;
    question_en: string;
    answer_ko: Record<string, any>;
    answer_en: Record<string, any>;
    manager: string;
  } = req.body;
  console.log(req.body);

  try {
    const [faq] = await connection.execute<ResultSetHeader>(
      `INSERT INTO faqs (
        maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager, created_by, updated_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maincategory_ko,
        maincategory_en,
        subcategory_ko,
        subcategory_en,
        question_ko,
        question_en,
        JSON.stringify(answer_ko),
        JSON.stringify(answer_en),
        manager,
        user_id,
        user_id
      ]
    );

    const faq_id = faq.insertId;
    const prev_faq = {
      maincategory_ko: "",
      maincategory_en: "",
      subcategory_ko: "",
      subcategory_en: "",
      question_ko: "",
      question_en: "",
      answer_ko: {},
      answer_en: {},
      manager: ""
    };
    const new_faq = {
      maincategory_ko: maincategory_ko,
      maincategory_en: maincategory_en,
      subcategory_ko: subcategory_ko,
      subcategory_en: subcategory_en,
      question_ko: question_ko,
      question_en: question_en,
      answer_ko: answer_ko,
      answer_en: answer_en,
      manager: manager,
    }

    const data = {
      user_id: user_id,
      faq_id: faq_id,
      prev_faq: prev_faq,
      new_faq: new_faq,
      action_type: '추가'
    }

    // faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch('http://localhost:5000/api/faqlogs', {
      method: 'POST',
      headers: {
       'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if(!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({ error: errorData.message });
    }
    const response = {
      status: "success",
      message: "FAQ created successfully"
    }
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


// @route   Get api/faqs/
// @desc    Get all FAQs
// @access  Private
router.get("/", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();

  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM faqs',
    )

    const faqs = rows.map((faq) => {
      return {
        faq_id: faq.id,
        maincategory_ko: faq.maincategory_ko,
        maincategory_en: faq.maincategory_en,
        subcategory_ko: faq.subcategory_ko,
        subcategory_en: faq.subcategory_en,
        question_ko: faq.question_ko,
        question_en: faq.question_en,
        answer_ko: safetyParse(faq.answer_ko),
        answer_en: safetyParse(faq.answer_en),
        manager: faq.manager,
        created_at: faq.created_at,
        updated_at: faq.updated_at
      };
    });

    const response = {
      status: "success",
      message: "FAQs retrieved successfully",
      data : {
        faqs
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


// @route   Post api/faqs/:faq_id
// @desc    get a FAQ
// @access  Private
router.get("/:faq_id", async (req: Request<{ faq_id: string }>, res: Response) => {
  const connection : PoolConnection = await Pool.getConnection();
  const { faq_id } = req.params;
  console.log(faq_id);

  try {
    const [[faq]] = await connection.execute<RowDataPacket[]>(
      'SELECT id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager FROM hobit.faqs WHERE id = ?',
      [faq_id]
    );

    if (!faq) {
      return res.status(404).json({ message: "FAQ not found" });
    }
    const response = {
      status: "success",
      message: "FAQ retrieved successfully",
      faq: {
        faq_id: faq.id,
        maincategory_ko: faq.maincategory_ko,
        maincategory_en: faq.maincategory_en,
        subcategory_ko: faq.subcategory_ko,
        subcategory_en: faq.subcategory_en,
        question_ko: faq.question_ko,
        question_en: faq.question_en,
        answer_ko: safetyParse(faq.answer_ko),
        answer_en: safetyParse(faq.answer_en),
        manager: faq.manager
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

// @route   Delete api/faqs/:faq_id
// @desc    Delete a FAQ
// @access  Private
router.delete("/:faq_id", async (req: Request<{ faq_id: string }>, res: Response) => {
  const connection : PoolConnection = await Pool.getConnection();
  const { faq_id } = req.params;
  const { user_id } : { user_id : number} = req.body;
  console.log(faq_id);

  try {
    const [[prev_faq]] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager
       FROM hobit.faqs 
       WHERE id = ?`,
      [faq_id]
    );

    const new_faq = {
      maincategory_ko: "",
      maincategory_en: "",
      subcategory_ko: "",
      subcategory_en: "",
      question_ko: "",
      question_en: "",
      answer_ko: {},
      answer_en: {},
      manager: "",
    }
    
    const data = {
      user_id: user_id,
      faq_id: faq_id,
      prev_faq: prev_faq,
      new_faq: new_faq,
      action_type: '삭제'
    }

    // faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch('http://localhost:5000/api/faqlogs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if(!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({ error: errorData.message });
    }

    await connection.execute(
      'DELETE FROM hobit.faqs WHERE id = ?',
      [faq_id]
    );
    const response = {
      status: "success",
      message: "FAQ deleted successfully"
    }
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

// @route   Put api/faqs/:faq_id
// @desc    Update a FAQ
// @access  Private
router.put("/:faq_id", async (req: Request<{ faq_id: string }>, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { faq_id } = req.params;
  const {
    user_id,
    maincategory_ko,
    maincategory_en,
    subcategory_ko,
    subcategory_en,
    question_ko,
    question_en,
    answer_ko,
    answer_en,
    manager
  }: {
    user_id: number;
    maincategory_ko: string;
    maincategory_en: string;
    subcategory_ko: string;
    subcategory_en: string;
    question_ko: string;
    question_en: string;
    answer_ko: Record<string, any>;
    answer_en: Record<string, any>;
    manager: string;
  } = req.body;
  console.log(faq_id);
  console.log(req.body);

  try {
    const [[faq]] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager
       FROM hobit.faqs 
       WHERE id = ?`,
      [faq_id]
    );
    const prev_faq = {
      maincategory_ko: faq.maincategory_ko,
      maincategory_en: faq.maincategory_en,
      subcategory_ko: faq.subcategory_ko,
      subcategory_en: faq.subcategory_en,
      question_ko: faq.question_ko,
      question_en: faq.question_en,
      answer_ko: safetyParse(faq.answer_ko),
      answer_en: safetyParse(faq.answer_en),
      manager: faq.manager
    }

    const new_faq = {
      maincategory_ko: maincategory_ko,
      maincategory_en: maincategory_en,
      subcategory_ko: subcategory_ko,
      subcategory_en: subcategory_en,
      question_ko: question_ko,
      question_en: question_en,
      answer_ko: answer_ko,
      answer_en: answer_en,
      manager: manager
    }

    const data = {
      user_id: user_id,
      faq_id: faq_id,
      prev_faq: prev_faq,
      new_faq: new_faq,
      action_type: '수정'
    }

    await connection.execute(
      `UPDATE hobit.faqs SET 
        maincategory_ko = ?, 
        maincategory_en = ?, 
        subcategory_ko = ?, 
        subcategory_en = ?, 
        question_ko = ?, 
        question_en = ?, 
        answer_ko = ?, 
        answer_en = ?, 
        manager = ?, 
        updated_by = ? 
      WHERE id = ?`,
      [ 
        maincategory_ko,
        maincategory_en,
        subcategory_ko,
        subcategory_en,
        question_ko,
        question_en,
        answer_ko,
        answer_en,
        manager,
        user_id,
        faq_id
      ]
    );

    // faq_logs 테이블에 로그를 남기기 위해 API 호출
    const logResponse = await fetch('http://localhost:5000/api/faqlogs', {
      method: 'POST',
      headers: {
       'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if(!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({ error: errorData.message });
    }
    const response = {
      status: "success",
      message: "FAQ updated successfully"
    }
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
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