import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";
import { RowDataPacket } from "mysql2";

const router = express.Router();

// @route   Post api/faqs/
// @desc    Create a new FAQ
// @access  Private
router.post("/", async (req: Request, res: Response) => {
  const connection = await Pool.getConnection();
  try {
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

    console.log(
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
    );

    await connection.query(
      `INSERT INTO faqs (
        maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager, created_by, updated_by, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
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

    res.status(201).json({ message: "FAQ created successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

//faq 가져오기 
router.get("/:Id", async (req: Request, res: Response) => {
  try {
    const connection = await Pool.getConnection(); //DB와 연결

    const { faqId } = req.body;

    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM faqs WHERE id = ?',
        [faqId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "FAQ not found" });
      }

      const faq = rows[0]

      res.json({
        faq: {
          faq_id: faq.id,
          maincategory_ko: faq.maincategory_ko,
          maincategory_en: faq.maincategory_en,
          subcategory_ko: faq.subcategory_ko,
          subcategory_en: faq.subcategory_en,
          question_ko: faq.question_ko,
          question_en: faq.question_en,
          answer_ko: JSON.parse(faq.answer_ko),
          answer_en: JSON.parse(faq.answer_en),
          manager: faq.manager
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error retrieving FAQ" });
    } finally {
      connection.release();
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//faq 삭제하기
router.delete("/:Id", async (req: Request, res: Response) => {
  try {
    const connection = await Pool.getConnection();
    
    const { faqId } = req.body;

    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM faqs WHERE id = ?',
        [faqId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'FAQ not found' })
      }

      await connection.execute(
        'DELETE FROM faqs WHERE id = ?',
        [faqId]
      );

      res.status(200).json();
    } catch (error) {
      res.status(500).json();
    } finally {
      connection.release();
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//faq 수정하기
router.put("/:Id", async (req: Request, res: Response) => {
  try {
    const connection = await Pool.getConnection();

    console.log(req.body);

    const {
      faq_id,
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
    } = req.body;

    console.log(manager);

    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM faqs WHERE id = ?',
        [faq_id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "FAQ not found" });
      }

      await connection.execute(
        `UPDATE faqs SET 
          maincategory_ko = ?, 
          maincategory_en = ?, 
          subcategory_ko = ?, 
          subcategory_en = ?, 
          question_ko = ?, 
          question_en = ?, 
          answer_ko = ?, 
          answer_en = ?, 
          manager = ?, 
          updated_by = ?,
          updated_at = NOW() 
        WHERE id = ?`,
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
          faq_id,
        ]
      );

      res.status(200).json();
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      connection.release();
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
