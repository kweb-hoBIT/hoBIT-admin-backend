import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { CreateCheckFAQCategoryConflictRequest, CheckFAQCategoryConflictResponse } from '../../../types/faq';

const router = express.Router();

// @route   Get api/faqs/create/category/conflict
// @desc    Check all categories for conflicts
// @access  Private
router.post("/create/category/conflict", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { maincategory_ko, maincategory_en, subcategory_ko, subcategory_en } : CreateCheckFAQCategoryConflictRequest['body'] = req.body;
  try {
    let isConflict = false;

    const conflictedData : CheckFAQCategoryConflictResponse['data']['conflictedData'] = [];
    const mainConflict: CheckFAQCategoryConflictResponse['data']['conflictedData'][number]['conflict'] = [];
    const subConflict: CheckFAQCategoryConflictResponse['data']['conflictedData'][number]['conflict'] = [];

    const [new_maincategory_ko] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko FROM hobit.faqs WHERE faqs.maincategory_en = ?`,
      [maincategory_en]
    );
    const [new_maincategory_en] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_en FROM hobit.faqs WHERE faqs.maincategory_ko = ?`,
      [maincategory_ko]
    );
    const [new_subcategory_ko] = await connection.execute<RowDataPacket[]>(
      `SELECT subcategory_ko FROM hobit.faqs WHERE faqs.subcategory_en = ?`,
      [subcategory_en]
    );
    const [new_subcategory_en] = await connection.execute<RowDataPacket[]>(
      `SELECT subcategory_en FROM hobit.faqs WHERE faqs.subcategory_ko = ?`,
      [subcategory_ko]
    );

    if (new_maincategory_ko.length > 0 && new_maincategory_ko[0].maincategory_ko !== maincategory_ko) {
      mainConflict.push({
        ko: new_maincategory_ko[0].maincategory_ko,
        en: maincategory_en
      });
    }

    if (new_maincategory_en.length > 0 && new_maincategory_en[0].maincategory_en !== maincategory_en) {
      mainConflict.push({
        ko: maincategory_ko,
        en: new_maincategory_en[0].maincategory_en
      });
    }

    if (new_subcategory_ko.length > 0 && new_subcategory_ko[0].subcategory_ko !== subcategory_ko) {
      subConflict.push({
        ko: new_subcategory_ko[0].subcategory_ko,
        en: subcategory_en
      });
    }

    if (new_subcategory_en.length > 0 && new_subcategory_en[0].subcategory_en !== subcategory_en) {
      subConflict.push({
        ko: subcategory_ko,
        en: new_subcategory_en[0].subcategory_en
      });
    }

    if (mainConflict.length > 0){
      isConflict = true;
      conflictedData.push({
        field: "maincategory",
        input: {
          ko: maincategory_ko,
          en: maincategory_en
        },
        conflict: mainConflict
      });
    }

    if (subConflict.length > 0){
      isConflict = true;
      conflictedData.push({
        field: "subcategory",
        input: {
          ko: subcategory_ko,
          en: subcategory_en
        },
        conflict: subConflict
      });
    }

    const response : CheckFAQCategoryConflictResponse = {
      statusCode: 200,
      message: "Categories checked successfully",
      data : {
        isConflict: isConflict,
        conflictedData: conflictedData
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