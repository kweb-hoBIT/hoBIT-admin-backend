import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { changeSeniorFAQCategoryRequest, changeSeniorFAQCategoryResponse } from "seniorfaq";

const router = express.Router();

const VALID_CATEGORY_FIELDS = [
  "maincategory_ko",
  "maincategory_en",
  "subcategory_ko",
  "subcategory_en",
  "detailcategory_ko",
  "detailcategory_en"
];

interface SeniorFAQ {
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  detailcategory_ko: string;
  detailcategory_en: string;
  answer_ko: { title: string; answer: string; url: string; map: { latitude: string; longitude: string; } }[];
  answer_en: { title: string; answer: string; url: string; map: { latitude: string; longitude: string; } }[];
  manager: string;
  [key: string]: any;
}

// @route   Get api/seniorfaqs/category
// @desc    change SeniorFAQ category
// @access  Private
router.put("/category", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id, category_field, prev_category, new_category }: changeSeniorFAQCategoryRequest['body'] = req.body;

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
      `SELECT id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en, answer_ko, answer_en, manager
       FROM hobit.senior_faqs
       WHERE \`${category_field}\` = ?`,
      [prev_category]
    );

    const senior_faq = rows as { id: number }[];
    const new_senior_faq = JSON.parse(JSON.stringify(rows)) as SeniorFAQ[];
    const prev_senior_faq = rows as SeniorFAQ[];

    const values: any[] = [];
    const placeholders: string[] = [];
    const ids: number[] = [];
    const updateCases: string[] = [];

    for (let i = 0; i < senior_faq.length; i++) {
      const id = senior_faq[i].id;
      ids.push(id);
      new_senior_faq[i][category_field] = new_category;

      const { id: _prevId, ...sanitizedPrev } = prev_senior_faq[i];
      const { id: _newId, ...sanitizedNew } = new_senior_faq[i];

      values.push(
        username,
        id,
        "수정",
        JSON.stringify(sanitizedPrev),
        JSON.stringify(sanitizedNew)
      );
      placeholders.push("(?, ?, ?, ?, ?)");
      updateCases.push(`WHEN ${id} THEN ?`);
    }

    if (ids.length > 0) {
      const updateSql = `
        UPDATE hobit.senior_faqs
        SET \`${category_field}\` = CASE id
          ${updateCases.join('\n')}
        END
        WHERE id IN (${ids.join(",")})
      `;
      const updateValues = Array(ids.length).fill(new_category);
      await connection.execute(updateSql, updateValues);
    }

    if (values.length > 0) {
      const insertSql = `
        INSERT INTO senior_faq_logs
        (username, senior_faq_id, action_type, prev_senior_faq, new_senior_faq)
        VALUES ${placeholders.join(", ")}
      `;
      await connection.execute(insertSql, values);
    }

    const response: changeSeniorFAQCategoryResponse = {
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
