import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";

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

export default router;
