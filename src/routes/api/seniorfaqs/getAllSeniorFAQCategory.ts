import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GetAllSeniorFAQCategoryResponse } from "../../../types/seniorfaq";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Get api/seniorfaqs/category
// @desc    Get all categories with their subcategories and detailcategories
// @access  Private
router.get("/category", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const [maincategories] = await connection.execute<RowDataPacket[]>(
      "SELECT DISTINCT senior_faqs.maincategory_ko, senior_faqs.maincategory_en, senior_faqs.category_order FROM hobit.senior_faqs order by senior_faqs.category_order",
    );

    const categories = await Promise.all(
      maincategories.map(async (maincategory: RowDataPacket) => {
        const [subcategoriesRow] = await connection.execute<RowDataPacket[]>(
          "SELECT DISTINCT senior_faqs.subcategory_ko, senior_faqs.subcategory_en FROM hobit.senior_faqs WHERE senior_faqs.maincategory_ko = ?",
          [maincategory.maincategory_ko]
        );

        const subcategories = await Promise.all(
          subcategoriesRow.map(async (subcategory: RowDataPacket) => {
            const [detailcategoriesRow] = await connection.execute<RowDataPacket[]>(
              "SELECT DISTINCT senior_faqs.detailcategory_ko, senior_faqs.detailcategory_en FROM hobit.senior_faqs WHERE senior_faqs.maincategory_ko = ? AND senior_faqs.subcategory_ko = ?",
              [maincategory.maincategory_ko, subcategory.subcategory_ko]
            );

            const detailcategories: { detailcategory_ko: string[]; detailcategory_en: string[] } = {
              detailcategory_ko: detailcategoriesRow.map(row => row.detailcategory_ko),
              detailcategory_en: detailcategoriesRow.map(row => row.detailcategory_en),
            };

            return {
              subcategory_ko: subcategory.subcategory_ko,
              subcategory_en: subcategory.subcategory_en,
              detailcategories,
            };
          })
        );

        return {
          maincategory_ko: maincategory.maincategory_ko,
          maincategory_en: maincategory.maincategory_en,
          category_order : maincategory.category_order,
          subcategories,
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

    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
