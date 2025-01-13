import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllFAQCategoryResponse } from '../../../types/faq';

const router = express.Router();

// @route   Get api/faqs/category
// @desc    Get all categories
// @access  Private
router.get("/category", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();

  try {
    const mainCategoryKoRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(faqs.maincategory_ko) FROM hobit.faqs',
    )

    const mainCategoryRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(faqs.maincategory_en) FROM hobit.faqs',
    )

    const subCategoryKoRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(faqs.subcategory_ko) FROM hobit.faqs',
    )

    const subCategoryEnRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(faqs.subcategory_en) FROM hobit.faqs',
    )

    const maincategory_ko = mainCategoryKoRows[0].map((row: RowDataPacket) => row.maincategory_ko) as string[];
    const maincategory_en = mainCategoryRows[0].map((row: RowDataPacket) => row.maincategory_en) as string[];
    const subcategory_ko = subCategoryKoRows[0].map((row: RowDataPacket) => row.subcategory_ko) as string[];
    const subcategory_en = subCategoryEnRows[0].map((row: RowDataPacket) => row.subcategory_en) as string[];

    const categories = {
      maincategory_ko,
      maincategory_en,
      subcategory_ko,
      subcategory_en
    }

    const response :  GetAllFAQCategoryResponse = {
      statusCode: 200,
      message: "Categories retrieved successfully",
      data : {
        categories
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
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