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
    const [maincategory] = await connection.execute<RowDataPacket[]>(
      'SELECT DISTINCT senior_faqs.maincategory_ko, senior_faqs.maincategory_en FROM hobit.senior_faqs',
    );
    const [subcategory] = await connection.execute<RowDataPacket[]>(
      'SELECT DISTINCT senior_faqs.subcategory_ko, senior_faqs.subcategory_en FROM hobit.senior_faqs',
    );
    const [detailcategory] = await connection.execute<RowDataPacket[]>(
      'SELECT DISTINCT senior_faqs.detailcategory_ko, senior_faqs.detailcategory_en FROM hobit.senior_faqs',
    );

    const maincategory_ko = maincategory.map((row: RowDataPacket) => row.maincategory_ko) as string[];
    const maincategory_en = maincategory.map((row: RowDataPacket) => row.maincategory_en) as string[];
    const subcategory_ko = subcategory.map((row: RowDataPacket) => row.subcategory_ko) as string[];
    const subcategory_en = subcategory.map((row: RowDataPacket) => row.subcategory_en) as string[];
    const detailcategory_ko = detailcategory.map((row: RowDataPacket) => row.detailcategory_ko) as string[];
    const detailcategory_en = detailcategory.map((row: RowDataPacket) => row.detailcategory_en) as string[];

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