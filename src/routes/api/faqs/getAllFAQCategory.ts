import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllFAQCategoryResponse } from "../../../types/faq";

const router = express.Router();

// @route   Get api/faqs/category
// @desc    Get all categories with their subcategories
// @access  Private
router.get("/category", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const [maincategories] = await connection.execute<RowDataPacket[]>(
      "SELECT DISTINCT faqs.maincategory_ko, faqs.maincategory_en FROM hobit.faqs"
    );

    const categories = await Promise.all(
      maincategories.map(async (maincategory: RowDataPacket) => {
        const [subcategoriesRow] = await connection.execute<RowDataPacket[]>(
          "SELECT DISTINCT faqs.subcategory_ko, faqs.subcategory_en FROM hobit.faqs WHERE faqs.maincategory_ko = ?",
          [maincategory.maincategory_ko]
        );
    
        const subcategories: { subcategory_ko: string[]; subcategory_en: string[] } = {
          subcategory_ko: subcategoriesRow.map(row => row.subcategory_ko),
          subcategory_en: subcategoriesRow.map(row => row.subcategory_en),
        };
    
        return {
          maincategory_ko: maincategory.maincategory_ko,
          maincategory_en: maincategory.maincategory_en,
          subcategories,
        };
      })
    );

    const response: GetAllFAQCategoryResponse = {
      statusCode: 200,
      message: "Categories retrieved successfully",
      data: {
        categories,
      },
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
