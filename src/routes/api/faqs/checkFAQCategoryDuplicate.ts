import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { CheckFAQCategoryDuplicateRequest, CheckFAQCategoryDuplicateResponse } from '../../../types/faq';

const router = express.Router();

// @route   Get api/faqs/category/check
// @desc    Check all categories for duplicates
// @access  Private
router.post("/category/check", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { maincategory_ko, maincategory_en, subcategory_ko, subcategory_en } : CheckFAQCategoryDuplicateRequest['body'] = req.body;
  try {
    const [[checked_maincategory_ko]] = await connection.execute<RowDataPacket[]>(
      `SELECT faqs.maincategory_ko FROM hobit.faqs WHERE faqs.maincategory_en = ?`,
      [maincategory_en]
    );
    const [[checked_maincategory_en]] = await connection.execute<RowDataPacket[]>(
      `SELECT faqs.maincategory_en FROM hobit.faqs WHERE faqs.maincategory_ko = ?`,
      [maincategory_ko]
    );
    const [[checked_subcategory_ko]] = await connection.execute<RowDataPacket[]>(
      `SELECT faqs.subcategory_ko FROM hobit.faqs WHERE faqs.subcategory_en = ?`,
      [subcategory_en]
    );
    const [[checked_subcategory_en]] = await connection.execute<RowDataPacket[]>(
      `SELECT faqs.subcategory_en FROM hobit.faqs WHERE faqs.subcategory_ko = ?`,
      [subcategory_ko]
    );

    let isDuplicated = false;
    if((checked_maincategory_ko &&  !checked_maincategory_en) || (!checked_maincategory_ko && checked_maincategory_en) || (checked_subcategory_ko && !checked_subcategory_en) || (!checked_subcategory_ko && checked_subcategory_en)) {
      isDuplicated = true;
    }
    
    const response : CheckFAQCategoryDuplicateResponse = {
      statusCode: 200,
      message: "Categories checked successfully",
      data : {
        isDuplicated: isDuplicated
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    }
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;