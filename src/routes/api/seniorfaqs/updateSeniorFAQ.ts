import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  UpdateSeniorFAQRequest,
  UpdateSeniorFAQResponse,
} from "../../../types/seniorfaq";
import env from "../../../../config/env";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

interface SeniorFAQ {
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  detailcategory_ko: string;
  detailcategory_en: string;
  answer_ko: {
    title: string;
    answer: string;
    url: string;
    map: { latitude: string; longitude: string };
  }[];
  answer_en: {
    title: string;
    answer: string;
    url: string;
    map: { latitude: string; longitude: string };
  }[];
  manager: string;
}

/** undefined → null 로 강제 변환 */
const safe = <T>(v: T | undefined | null): T | null => v ?? null;

/** JSON 파싱 안전 처리 */
function safetyParse<T>(data: string | null): T | null {
  try {
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error("Invalid JSON string:", error);
    return null;
  }
}

// @route   PUT api/seniorfaqs/:senior_faq_id
// @desc    Update a Senior FAQ
// @access  Private
router.put("/:senior_faq_id", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { senior_faq_id } = req.params;

  const {
    user_id,
    maincategory_ko,
    maincategory_en,
    subcategory_ko,
    subcategory_en,
    detailcategory_ko,
    detailcategory_en,
    answer_ko,
    answer_en,
    manager,
  }: UpdateSeniorFAQRequest["body"] = req.body;

  const existed_accessToken = req.cookies?.accessToken;

  try {
    /** 사용자 이름 조회 */
    const [userRows] = await connection.execute<RowDataPacket[]>(
      `SELECT username FROM hobit.users WHERE id = ?`,
      [user_id]
    );

    if (userRows.length === 0) {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid user_id",
      });
    }

    const username = userRows[0].username as string;

    /** 기존 FAQ 조회 (category_order 포함!) */
    const [[senior_faq]] = await connection.execute<RowDataPacket[]>(
      `
      SELECT
        maincategory_ko,
        maincategory_en,
        subcategory_ko,
        subcategory_en,
        detailcategory_ko,
        detailcategory_en,
        answer_ko,
        answer_en,
        manager,
        category_order
      FROM hobit.senior_faqs
      WHERE id = ?
      `,
      [Number(senior_faq_id)]
    );

    if (!senior_faq) {
      return res.status(404).json({
        statusCode: 404,
        message: "Senior FAQ not found",
      });
    }

    /** category_order 계산 */
    let category_order = senior_faq.category_order as number;

    if (senior_faq.maincategory_ko !== maincategory_ko) {
      const [orderRows] = await connection.execute<RowDataPacket[]>(
        `SELECT category_order FROM hobit.senior_faqs WHERE maincategory_ko = ? LIMIT 1`,
        [maincategory_ko]
      );

      if (orderRows.length > 0) {
        category_order = orderRows[0].category_order;
      } else {
        const [[maxRow]] = await connection.execute<RowDataPacket[]>(
          `SELECT MAX(category_order) AS max_order FROM hobit.senior_faqs`
        );
        category_order = (maxRow?.max_order ?? 0) + 1;
      }
    }

    /** 로그용 이전 데이터 */
    const prev_senior_faq: SeniorFAQ = {
      maincategory_ko: senior_faq.maincategory_ko,
      maincategory_en: senior_faq.maincategory_en,
      subcategory_ko: senior_faq.subcategory_ko,
      subcategory_en: senior_faq.subcategory_en,
      detailcategory_ko: senior_faq.detailcategory_ko,
      detailcategory_en: senior_faq.detailcategory_en,
      answer_ko: safetyParse(senior_faq.answer_ko) ?? [],
      answer_en: safetyParse(senior_faq.answer_en) ?? [],
      manager: senior_faq.manager,
    };

    /** 로그용 신규 데이터 */
    const new_senior_faq: SeniorFAQ = {
      maincategory_ko,
      maincategory_en,
      subcategory_ko,
      subcategory_en,
      detailcategory_ko,
      detailcategory_en,
      answer_ko: answer_ko ?? [],
      answer_en: answer_en ?? [],
      manager,
    };

    /** 로그 서버 전송 */
    const logResponse = await fetch(
      `${env.API_URL}/adminlogs/seniorfaqlogs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `accessToken=${existed_accessToken}`,
        },
        body: JSON.stringify({
          username,
          senior_faq_id,
          prev_senior_faq,
          new_senior_faq,
          action_type: "수정",
        }),
      }
    );

    if (!logResponse.ok) {
      const errorData = await logResponse.json();
      return res.status(logResponse.status).json({
        statusCode: logResponse.status,
        message: errorData.message,
      });
    }

    /** 실제 UPDATE (undefined 완전 차단) */
    await connection.execute(
      `
      UPDATE hobit.senior_faqs SET
        maincategory_ko = ?,
        maincategory_en = ?,
        subcategory_ko = ?,
        subcategory_en = ?,
        detailcategory_ko = ?,
        detailcategory_en = ?,
        answer_ko = ?,
        answer_en = ?,
        manager = ?,
        category_order = ?,
        updated_by = ?
      WHERE id = ?
      `,
      [
        safe(maincategory_ko),
        safe(maincategory_en),
        safe(subcategory_ko),
        safe(subcategory_en),
        safe(detailcategory_ko),
        safe(detailcategory_en),
        JSON.stringify(answer_ko ?? []),
        JSON.stringify(answer_en ?? []),
        safe(manager),
        safe(category_order),
        safe(user_id),
        safe(senior_faq_id),
      ]
    );

    const response: UpdateSeniorFAQResponse = {
      statusCode: 200,
      message: "Senior FAQ updated successfully",
    };

    res.status(200).json(response);
  } catch (err: any) {
    console.error({
      statusCode: 500,
      message: err.message,
    });
    res.status(500).json({
      statusCode: 500,
      message: err.message,
    });
  } finally {
    connection.release();
  }
});

export default router;