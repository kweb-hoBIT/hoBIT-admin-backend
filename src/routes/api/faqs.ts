import express, { Request, Response } from "express";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { Pool } from "../../../config/connectDB";
import { TFAQ } from "../../models/FAQ";

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
  }: TFAQ & { user_id: number } = req.body;

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

  try {
    await connection.query(
      `INSERT INTO hobit.faqs (
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

    res.status(201).json({ message: "FAQ created successfully" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
});

export default router;
