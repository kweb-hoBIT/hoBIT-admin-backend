import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllSeniorFAQCategoryResponse } from '../../../types/seniorfaq';

const router = express.Router();

// @route   Get api/seniorfaqs/category
// @desc    Get all categories
// @access  Private
router.get("/category", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();

  try {
    const mainCategoryKoRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(senior_faqs.maincategory_ko) FROM hobit.senior_faqs',
    )

    const mainCategoryRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(senior_faqs.maincategory_en) FROM hobit.senior_faqs',
    )

    const subCategoryKoRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(senior_faqs.subcategory_ko) FROM hobit.senior_faqs',
    )

    const subCategoryEnRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(senior_faqs.subcategory_en) FROM hobit.senior_faqs',
    )

    const detailCategoryKoRows= await connection.execute<RowDataPacket[]>(
      'SELECT distinct(senior_faqs.detailcategory_ko) FROM hobit.senior_faqs',
    )

    const detailCategoryEnRows = await connection.execute<RowDataPacket[]>(
      'SELECT distinct(senior_faqs.detailcategory_en) FROM hobit.senior_faqs',
    )

    const maincategory_ko = mainCategoryKoRows[0].map((row: RowDataPacket) => row.maincategory_ko) as string[];
    const maincategory_en = mainCategoryRows[0].map((row: RowDataPacket) => row.maincategory_en) as string[];
    const subcategory_ko = subCategoryKoRows[0].map((row: RowDataPacket) => row.subcategory_ko) as string[];
    const subcategory_en = subCategoryEnRows[0].map((row: RowDataPacket) => row.subcategory_en) as string[];
    const detailcategory_ko = detailCategoryKoRows[0].map((row: RowDataPacket) => row.detailcategory_ko) as string[];
    const detailcategory_en = detailCategoryEnRows[0].map((row: RowDataPacket) => row.detailcategory_en) as string[];

    const categories = {
      maincategory_ko,
      maincategory_en,
      subcategory_ko,
      subcategory_en,
      detailcategory_ko,
      detailcategory_en
    }

    const response :  GetAllSeniorFAQCategoryResponse = {
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