import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { changeFAQCategoryResponse, changeFAQCategoryRequest } from "faq";

const router = express.Router();

const VALID_CATEGORY_FIELDS = [
  "maincategory_ko",
  "maincategory_en",
  "subcategory_ko",
  "subcategory_en"
];

interface FAQ {
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: { answer: string; url: string; email: string; phone: string; }[];
  answer_en: { answer: string; url: string; email: string; phone: string; }[];
  manager: string;
  [key: string]: any;
}

// @route   Get api/faqs/category
// @desc    change FAQ category
// @access  Private
router.put("/category", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id, category_field, prev_category, new_category }: changeFAQCategoryRequest['body'] = req.body;

  try {
    const [userName] = await connection.execute<RowDataPacket[]>(
      `SELECT username FROM hobit.users WHERE id = ?`,
      [user_id]
    );

    const username = userName[0]?.username as string;

    if (
      typeof category_field !== "string" ||
      typeof prev_category !== "string" ||
      typeof new_category !== "string"
    ) {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid request body. All fields must be non-empty strings.",
      });
    }

    if (!VALID_CATEGORY_FIELDS.includes(category_field)) {
      return res.status(400).json({
        statusCode: 400,
        message: `Invalid category_field. Allowed fields: ${VALID_CATEGORY_FIELDS.join(", ")}`,
      });
    }

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, question_ko, question_en, answer_ko, answer_en, manager
       FROM hobit.faqs
       WHERE \`${category_field}\` = ?`,
      [prev_category]
    );

    const faq = rows as { id: number }[];
    const new_faq = JSON.parse(JSON.stringify(rows)) as FAQ[];
    const prev_faq = rows as FAQ[];

    const ids: number[] = [];
    const updateCases: string[] = [];
    const insertPlaceholders: string[] = [];
    const insertValues: any[] = [];

    for (let i = 0; i < faq.length; i++) {
      const id = faq[i].id;
      ids.push(id);
      new_faq[i][category_field] = new_category;

      const { id: _prevId, ...sanitizedPrev } = prev_faq[i];
      const { id: _newId, ...sanitizedNew } = new_faq[i];

      updateCases.push(`WHEN ${id} THEN ?`);
      insertPlaceholders.push("(?, ?, ?, ?, ?)");
      insertValues.push(
        username,
        id,
        "수정",
        JSON.stringify(sanitizedPrev),
        JSON.stringify(sanitizedNew)
      );
    }

    if (ids.length > 0) {
      const updateQuery = `
        UPDATE hobit.faqs
        SET \`${category_field}\` = CASE id
          ${updateCases.join("\n")}
        END
        WHERE id IN (${ids.join(",")})
      `;
      const updateValues = Array(ids.length).fill(new_category);
      await connection.execute(updateQuery, updateValues);
    }

    if (insertValues.length > 0) {
      const insertQuery = `
        INSERT INTO faq_logs
        (username, faq_id, action_type, prev_faq, new_faq)
        VALUES ${insertPlaceholders.join(", ")}
      `;
      await connection.execute(insertQuery, insertValues);
    }

    const response: changeFAQCategoryResponse = {
      statusCode: 200,
      message: "FAQ category changed successfully",
    };
    res.status(200).json(response);

  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    console.error(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
