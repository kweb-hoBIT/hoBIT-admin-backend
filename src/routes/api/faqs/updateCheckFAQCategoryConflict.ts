import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { UpdateCheckFAQCategoryConflictRequest, CheckFAQCategoryConflictResponse } from '../../../types/faq';
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";


const router = express.Router();

// @route   Get api/faqs/create/category/conflict
// @desc    Check all categories for conflicts
// @access  Private
router.post("/update/category/conflict", auth, async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { faq_id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en } : UpdateCheckFAQCategoryConflictRequest['body'] = req.body;
  try {
    let isConflict = false;
    const [[now_category]] = await connection.execute<RowDataPacket[]>(
      `SELECT faqs.maincategory_ko, faqs.maincategory_en, faqs.subcategory_ko, faqs.subcategory_en FROM hobit.faqs WHERE faqs.id = ?`,
      [faq_id]
    );

    const [[number_same_maincategory]] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS number_same_maincategory FROM hobit.faqs WHERE faqs.maincategory_ko = ? and faqs.maincategory_en = ?`,
      [now_category.maincategory_ko, now_category.maincategory_en]
    );

    const [[number_same_subcategory]]= await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS number_same_subcategory FROM hobit.faqs WHERE faqs.subcategory_ko = ? and faqs.subcategory_en = ?`,
      [now_category.subcategory_ko, now_category.subcategory_en]
    );

    const changed_maincategory_ko = now_category.maincategory_ko === maincategory_ko ? false : true;
    const changed_maincategory_en = now_category.maincategory_en === maincategory_en ? false : true;
    const changed_subcategory_ko = now_category.subcategory_ko === subcategory_ko ? false : true;
    const changed_subcategory_en = now_category.subcategory_en === subcategory_en ? false : true;

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

    if (changed_maincategory_ko && !changed_maincategory_en) {
      if (number_same_maincategory.number_same_maincategory > 1) {
        mainConflict.push({
          ko: now_category.maincategory_ko,
          en: now_category.maincategory_en
        });
      }

      if (new_maincategory_en.length > 0 && new_maincategory_en[0].maincategory_en !== maincategory_en) {
        mainConflict.push({
          ko: maincategory_ko,
          en: new_maincategory_en[0].maincategory_en
        });
      }
    }

    if (!changed_maincategory_ko && changed_maincategory_en) {
      if (number_same_maincategory.number_same_maincategory > 1) {
        mainConflict.push({
          ko: now_category.maincategory_ko,
          en: now_category.maincategory_en
        });
      }
      if (new_maincategory_ko.length > 0 && new_maincategory_ko[0].maincategory_ko !== maincategory_ko) {
        mainConflict.push({
          ko: new_maincategory_ko[0].maincategory_ko,
          en: maincategory_en
        });
      }
    }

    if (changed_maincategory_ko && changed_maincategory_en) {
      if (new_maincategory_en.length > 0 && new_maincategory_en[0].maincategory_en !== maincategory_en) {
        mainConflict.push({
          ko: maincategory_ko,
          en: new_maincategory_en[0].maincategory_en
        });
      }

      if (new_maincategory_ko.length > 0 && new_maincategory_ko[0].maincategory_ko !== maincategory_ko) {
        mainConflict.push({
          ko: new_maincategory_ko[0].maincategory_ko,
          en: maincategory_en
        });
      }
    }

    if (changed_subcategory_ko && !changed_subcategory_en) {
      if (number_same_subcategory.number_same_subcategory > 1) {
        subConflict.push({
          ko: now_category.subcategory_ko,
          en: now_category.subcategory_en
        });
      }
      if (new_subcategory_en.length > 0 && new_subcategory_en[0].subcategory_en !== subcategory_en) {
        subConflict.push({
          ko: subcategory_ko,
          en: new_subcategory_en[0].subcategory_en
        });
      }
    }

    if (!changed_subcategory_ko && changed_subcategory_en) {
      if (number_same_subcategory.number_same_subcategory > 1) {
        subConflict.push({
          ko: now_category.subcategory_ko,
          en: now_category.subcategory_en
        });
      }
      if (new_subcategory_ko.length > 0 && new_subcategory_ko[0].subcategory_ko !== subcategory_ko) {
        subConflict.push({
          ko: new_subcategory_ko[0].subcategory_ko,
          en: subcategory_en
        });
      }
    }

    if (changed_subcategory_ko && changed_subcategory_en) {
      if (new_subcategory_en.length > 0 && new_subcategory_en[0].subcategory_en !== subcategory_en) {
        subConflict.push({
          ko: subcategory_ko,
          en: new_subcategory_en[0].subcategory_en
        });
      }
      if (new_subcategory_ko.length > 0 && new_subcategory_ko[0].subcategory_ko !== subcategory_ko) {
        subConflict.push({
          ko: new_subcategory_ko[0].subcategory_ko,
          en: subcategory_en
        });
      }
    }

    if (mainConflict.length > 0) {
      isConflict = true;
      conflictedData.push({
        field: 'maincategory',
        input: {
          ko: maincategory_ko,
          en: maincategory_en
        },
        conflict: mainConflict
      });
    }

    if (subConflict.length > 0) {
      isConflict = true;
      conflictedData.push({
        field: 'subcategory',
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