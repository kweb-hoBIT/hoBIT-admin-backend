import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { UpdateCheckSeniorFAQCategoryDuplicateRequest, CheckSeniorFAQCategoryDuplicateResponse } from '../../../types/seniorfaq';

const router = express.Router();

// @route   Get api/seniorfaqs/update/category/check
// @desc    Check all categories for duplicates
// @access  Private
router.post("/update/category/check", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { senior_faq_id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en, detailcategory_ko, detailcategory_en } : UpdateCheckSeniorFAQCategoryDuplicateRequest['body'] = req.body;
  try {
    let isDuplicated = false;
    const [[now_category]] = await connection.execute<RowDataPacket[]>(
      `SELECT senior_faqs.maincategory_ko, senior_faqs.maincategory_en, senior_faqs.subcategory_ko, senior_faqs.subcategory_en, senior_faqs.detailcategory_ko, senior_faqs.detailcategory_en FROM hobit.senior_faqs WHERE senior_faqs.id = ?`,
      [senior_faq_id]
    );

    const [[number_same_maincategory]] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS number_same_maincategory FROM hobit.senior_faqs WHERE senior_faqs.maincategory_ko = ? and senior_faqs.maincategory_en = ?`,
      [now_category.maincategory_ko, now_category.maincategory_en]
    );

    const [[number_same_subcategory]]= await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS number_same_subcategory FROM hobit.senior_faqs WHERE senior_faqs.subcategory_ko = ? and senior_faqs.subcategory_en = ?`,
      [now_category.subcategory_ko, now_category.subcategory_en]
    );

    const [[number_same_detailcategory]]= await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS number_same_detailcategory FROM hobit.senior_faqs WHERE senior_faqs.detailcategory_ko = ? and senior_faqs.detailcategory_en = ?`,
      [now_category.detailcategory_ko, now_category.detailcategory_en]
    );

    const changed_maincategory_ko = now_category.maincategory_ko === maincategory_ko ? false : true;
    const changed_maincategory_en = now_category.maincategory_en === maincategory_en ? false : true;
    const changed_subcategory_ko = now_category.subcategory_ko === subcategory_ko ? false : true;
    const changed_subcategory_en = now_category.subcategory_en === subcategory_en ? false : true;
    const changed_detailcategory_ko = now_category.detailcategory_ko === detailcategory_ko ? false : true;
    const changed_detailcategory_en = now_category.detailcategory_en === detailcategory_en ? false : true;

    const changedData : CheckSeniorFAQCategoryDuplicateResponse['data']['changedData'] = [];
    const mainConflict: CheckSeniorFAQCategoryDuplicateResponse['data']['changedData'][number]['conflict'] = [];
    const subConflict: CheckSeniorFAQCategoryDuplicateResponse['data']['changedData'][number]['conflict'] = [];
    const detailConflict: CheckSeniorFAQCategoryDuplicateResponse['data']['changedData'][number]['conflict'] = [];

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

    if (changed_maincategory_ko && !changed_maincategory_en) {
      if (number_same_maincategory.number_same_maincategory > 1) {
        isDuplicated = true;
        mainConflict.push({
          ko: now_category.maincategory_ko,
          en: now_category.maincategory_en
        });
      }

      if (new_maincategory_en.length > 0 && new_maincategory_en[0].maincategory_en !== maincategory_en) {
        isDuplicated = true;
        mainConflict.push({
          ko: maincategory_ko,
          en: new_maincategory_en[0].maincategory_en
        });
      }
    }

    if (!changed_maincategory_ko && changed_maincategory_en) {
      if (number_same_maincategory.number_same_maincategory > 1) {
        isDuplicated = true;
        mainConflict.push({
          ko: now_category.maincategory_ko,
          en: now_category.maincategory_en
        });
      }
      if (new_maincategory_ko.length > 0 && new_maincategory_ko[0].maincategory_ko !== maincategory_ko) {
        isDuplicated = true;
        mainConflict.push({
          ko: new_maincategory_ko[0].maincategory_ko,
          en: maincategory_en
        });
      }
    }

    if (changed_maincategory_ko && changed_maincategory_en) {
      if (new_maincategory_en.length > 0 && new_maincategory_en[0].maincategory_en !== maincategory_en) {
        isDuplicated = true;
        mainConflict.push({
          ko: maincategory_ko,
          en: new_maincategory_en[0].maincategory_en
        });
      }

      if (new_maincategory_ko.length > 0 && new_maincategory_ko[0].maincategory_ko !== maincategory_ko) {
        isDuplicated = true;
        mainConflict.push({
          ko: new_maincategory_ko[0].maincategory_ko,
          en: maincategory_en
        });
      }
    }

    if (changed_subcategory_ko && !changed_subcategory_en) {
      if (number_same_subcategory.number_same_subcategory > 1) {
        isDuplicated = true;
        subConflict.push({
          ko: now_category.subcategory_ko,
          en: now_category.subcategory_en
        });
      }

      if (new_subcategory_en.length > 0 && new_subcategory_en[0].subcategory_en !== subcategory_en) {
        isDuplicated = true;
        subConflict.push({
          ko: subcategory_ko,
          en: new_subcategory_en[0].subcategory_en
        });
      }
    }

    if (!changed_subcategory_ko && changed_subcategory_en) {
      if (number_same_subcategory.number_same_subcategory > 1) {
        isDuplicated = true;
        subConflict.push({
          ko: now_category.subcategory_ko,
          en: now_category.subcategory_en
        });
      }
      if (new_subcategory_ko.length > 0 && new_subcategory_ko[0].subcategory_ko !== subcategory_ko) {
        isDuplicated = true;
        subConflict.push({
          ko: new_subcategory_ko[0].subcategory_ko,
          en: subcategory_en
        });
      }
    }

    if (changed_subcategory_ko && changed_subcategory_en) {
      if (new_subcategory_en.length > 0 && new_subcategory_en[0].subcategory_en !== subcategory_en) {
        isDuplicated = true;
        subConflict.push({
          ko: subcategory_ko,
          en: new_subcategory_en[0].subcategory_en
        });
      }

      if (new_subcategory_ko.length > 0 && new_subcategory_ko[0].subcategory_ko !== subcategory_ko) {
        isDuplicated = true;
        subConflict.push({
          ko: new_subcategory_ko[0].subcategory_ko,
          en: subcategory_en
        });
      }
    }

    if (changed_detailcategory_ko && !changed_detailcategory_en) {
      if (number_same_detailcategory.number_same_detailcategory > 1) {
        isDuplicated = true;
        detailConflict.push({
          ko: now_category.detailcategory_ko,
          en: now_category.detailcategory_en
        });
      }

      if (new_detailcategory_en.length > 0 && new_detailcategory_en[0].detailcategory_en !== detailcategory_en) {
        isDuplicated = true;
        detailConflict.push({
          ko: detailcategory_ko,
          en: new_detailcategory_en[0].detailcategory_en
        });
      }
    }

    if (!changed_detailcategory_ko && changed_detailcategory_en) {
      if (number_same_detailcategory.number_same_detailcategory > 1) {
        isDuplicated = true;
        detailConflict.push({
          ko: now_category.detailcategory_ko,
          en: now_category.detailcategory_en
        });
      }
      if (new_detailcategory_ko.length > 0 && new_detailcategory_ko[0].detailcategory_ko !== detailcategory_ko) {
        isDuplicated = true;
        detailConflict.push({
          ko: new_detailcategory_ko[0].detailcategory_ko,
          en: detailcategory_en
        });
      }
    }

    if (changed_detailcategory_ko && changed_detailcategory_en) {
      if (new_detailcategory_en.length > 0 && new_detailcategory_en[0].detailcategory_en !== detailcategory_en) {
        isDuplicated = true;
        detailConflict.push({
          ko: detailcategory_ko,
          en: new_detailcategory_en[0].detailcategory_en
        });
      }

      if (new_detailcategory_ko.length > 0 && new_detailcategory_ko[0].detailcategory_ko !== detailcategory_ko) {
        isDuplicated = true;
        detailConflict.push({
          ko: new_detailcategory_ko[0].detailcategory_ko,
          en: detailcategory_en
        });
      }
    }
    
    if (mainConflict.length > 0) {
      changedData.push({
        field: 'maincategory',
        input: {
          ko: maincategory_ko,
          en: maincategory_en
        },
        conflict: mainConflict
      });
    }

    if (subConflict.length > 0) {
      changedData.push({
        field: 'subcategory',
        input: {
          ko: subcategory_ko,
          en: subcategory_en
        },
        conflict: subConflict
      });
    }

    if (detailConflict.length > 0) {
      changedData.push({
        field: 'detailcategory',
        input: {
          ko: detailcategory_ko,
          en: detailcategory_en
        },
        conflict: detailConflict
      });
    }

    const response : CheckSeniorFAQCategoryDuplicateResponse = {
      statusCode: 200,
      message: "Categories checked successfully",
      data : {
        isDuplicated: isDuplicated,
        changedData: changedData
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
