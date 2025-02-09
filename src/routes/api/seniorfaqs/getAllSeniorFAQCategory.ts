import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllSeniorFAQCategoryResponse } from "../../../types/seniorfaq";

const router = express.Router();

// @route   Get api/seniorfaqs/category
// @desc    Get all categories
// @access  Private
router.get("/category", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const [maincategories] = await connection.execute<RowDataPacket[]>(
      "SELECT DISTINCT senior_faqs.maincategory_ko, senior_faqs.maincategory_en FROM hobit.senior_faqs"
    );

    const categories = await Promise.all(
      maincategories.map(async (maincategory: RowDataPacket) => {
        const [subcategories] = await connection.execute<RowDataPacket[]>(
          "SELECT DISTINCT senior_faqs.subcategory_ko, senior_faqs.subcategory_en FROM hobit.senior_faqs WHERE senior_faqs.maincategory_ko = ?",
          [maincategory.maincategory_ko]
        );

        const subcategoriesWithDetails = await Promise.all(
          subcategories.map(async (subcategory: RowDataPacket) => {
            const [detailcategories] = await connection.execute<
              RowDataPacket[]
            >(
              "SELECT DISTINCT senior_faqs.detailcategory_ko, senior_faqs.detailcategory_en FROM hobit.senior_faqs WHERE senior_faqs.maincategory_ko = ? AND senior_faqs.subcategory_ko = ?",
              [maincategory.maincategory_ko, subcategory.subcategory_ko]
            );

            return {
              subcategory_ko: subcategory.subcategory_ko,
              subcategory_en: subcategory.subcategory_en,
              detailcategories: detailcategories.map(
                (detailcategory: RowDataPacket) => ({
                  detailcategory_ko: detailcategory.detailcategory_ko,
                  detailcategory_en: detailcategory.detailcategory_en,
                })
              ),
            };
          })
        );

        return {
          maincategory_ko: maincategory.maincategory_ko,
          maincategory_en: maincategory.maincategory_en,
          subcategories: subcategoriesWithDetails,
        };
      })
    );

    const response: GetAllSeniorFAQCategoryResponse = {
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
