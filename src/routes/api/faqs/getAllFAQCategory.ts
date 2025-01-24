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
    const [maincategory] = await connection.execute<RowDataPacket[]>(
      'SELECT DISTINCT faqs.id, faqs.maincategory_ko, faqs.maincategory_en FROM hobit.faqs ORDER BY faqs.id',
    );
    
    const [subcategory] = await connection.execute<RowDataPacket[]>(
      'SELECT DISTINCT faqs.id, faqs.subcategory_ko, faqs.subcategory_en FROM hobit.faqs ORDER BY faqs.id',
    );

    console.log(maincategory);

    const maincategory_ko = maincategory.map((row: RowDataPacket) => row.maincategory_ko) as string[];
    const maincategory_en = maincategory.map((row: RowDataPacket) => row.maincategory_en) as string[];
    const subcategory_ko = subcategory.map((row: RowDataPacket) => row.subcategory_ko) as string[];
    const subcategory_en = subcategory.map((row: RowDataPacket) => row.subcategory_en) as string[];

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