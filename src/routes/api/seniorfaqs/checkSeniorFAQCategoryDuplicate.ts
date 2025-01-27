import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { CheckSeniorFAQCategoryDuplicateRequest, CheckSeniorFAQCategoryDuplicateResponse } from '../../../types/seniorfaq';

const router = express.Router();

// @route   Get api/seniorfaqs/category/check
// @desc    Check all categories for duplicates
// @access  Private
router.post("/category/check", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en } : CheckSeniorFAQCategoryDuplicateRequest['body'] = req.body;
  try {
    const [[checked_maincategory_ko]] = await connection.execute<RowDataPacket[]>(
      `SELECT senior_faqs.maincategory_ko FROM hobit.senior_faqs WHERE senior_faqs.maincategory_en = ?`,
      [maincategory_en]
    );
    const [[checked_maincategory_en]] = await connection.execute<RowDataPacket[]>(
      `SELECT senior_faqs.maincategory_en FROM hobit.senior_faqs WHERE senior_faqs.maincategory_ko = ?`,
      [maincategory_ko]
    );
    const [[checked_subcategory_ko]] = await connection.execute<RowDataPacket[]>(
      `SELECT senior_faqs.subcategory_ko FROM hobit.senior_faqs WHERE senior_faqs.subcategory_en = ?`,
      [subcategory_en]
    );
    const [[checked_subcategory_en]] = await connection.execute<RowDataPacket[]>(
      `SELECT senior_faqs.subcategory_en FROM hobit.senior_faqs WHERE senior_faqs.subcategory_ko = ?`,
      [subcategory_ko]
    );
    const [[checked_detailcategory_ko]] = await connection.execute<RowDataPacket[]>(
      `SELECT senior_faqs.detailcategory_ko FROM hobit.senior_faqs WHERE senior_faqs.detailcategory_en = ?`,
      [detailcategory_en]
    );
    const [[checked_detailcategory_en]] = await connection.execute<RowDataPacket[]>(
      `SELECT senior_faqs.detailcategory_en FROM hobit.senior_faqs WHERE senior_faqs.detailcategory_ko = ?`,
      [detailcategory_ko]
    );
    

    let isDuplicated = false;
    if((checked_maincategory_ko &&  !checked_maincategory_en) || (!checked_maincategory_ko && checked_maincategory_en) || (checked_subcategory_ko && !checked_subcategory_en) || (!checked_subcategory_ko && checked_subcategory_en) || (checked_detailcategory_ko && !checked_detailcategory_en) || (!checked_detailcategory_ko && checked_detailcategory_en)) {
      isDuplicated = true;
    }
    
    const response : CheckSeniorFAQCategoryDuplicateResponse = {
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