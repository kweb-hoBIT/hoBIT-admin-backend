import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { CreateCheckSeniorFAQCategoryConflictRequest, CheckSeniorFAQCategoryConflictResponse } from '../../../types/seniorfaq';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Get api/seniorfaqs/create/category/conflict
// @desc    Check all categories for conflicts
// @access  Private
router.post("/create/category/conflict", auth, async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en } : CreateCheckSeniorFAQCategoryConflictRequest['body'] = req.body;
  try {
    let isConflict = false;

    const conflictedData : CheckSeniorFAQCategoryConflictResponse['data']['conflictedData'] = [];
    const mainConflict: CheckSeniorFAQCategoryConflictResponse['data']['conflictedData'][number]['conflict'] = [];
    const subConflict: CheckSeniorFAQCategoryConflictResponse['data']['conflictedData'][number]['conflict'] = [];
    const detailConflict: CheckSeniorFAQCategoryConflictResponse['data']['conflictedData'][number]['conflict'] = [];

    const [new_maincategory_ko] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_ko FROM hobit.senior_faqs WHERE senior_faqs.maincategory_en = ?`,
      [maincategory_en]
    );

    const [new_maincategory_en] = await connection.execute<RowDataPacket[]>(
      `SELECT maincategory_en FROM hobit.senior_faqs WHERE senior_faqs.maincategory_ko = ?`,
      [maincategory_ko]
    );

    const [new_subcategory_ko] = await connection.execute<RowDataPacket[]>(
      `SELECT subcategory_ko FROM hobit.senior_faqs WHERE senior_faqs.subcategory_en = ?`,
      [subcategory_en]
    );

    const [new_subcategory_en] = await connection.execute<RowDataPacket[]>(
      `SELECT subcategory_en FROM hobit.senior_faqs WHERE senior_faqs.subcategory_ko = ?`,
      [subcategory_ko]
    );

    const [new_detailcategory_ko] = await connection.execute<RowDataPacket[]>(
      `SELECT detailcategory_ko FROM hobit.senior_faqs WHERE senior_faqs.detailcategory_en = ?`,
      [detailcategory_en]
    );

    const [new_detailcategory_en] = await connection.execute<RowDataPacket[]>(
      `SELECT detailcategory_en FROM hobit.senior_faqs WHERE senior_faqs.detailcategory_ko = ?`,
      [detailcategory_ko]
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

    if (new_detailcategory_ko.length > 0 && new_detailcategory_ko[0].detailcategory_ko !== detailcategory_ko) {
      detailConflict.push({
        ko: new_detailcategory_ko[0].detailcategory_ko,
        en: detailcategory_en
      });
    }

    if (new_detailcategory_en.length > 0 && new_detailcategory_en[0].detailcategory_en !== detailcategory_en) {
      detailConflict.push({
        ko: detailcategory_ko,
        en: new_detailcategory_en[0].detailcategory_en
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

    if (detailConflict.length > 0){
      isConflict = true;
      conflictedData.push({
        field: "detailcategory",
        input: {
          ko: detailcategory_ko,
          en: detailcategory_en
        },
        conflict: detailConflict
      });
    }

    const response : CheckSeniorFAQCategoryConflictResponse = {
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