import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { UpdateCheckFAQCategoryDuplicateRequest, UpdateCheckFAQCategoryDuplicateResponse } from '../../../types/faq';

const router = express.Router();

// @route   Get api/faqs/create/category/check
// @desc    Check all categories for duplicates
// @access  Private
router.post("/update/category/check", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { faq_id, maincategory_ko, maincategory_en, subcategory_ko, subcategory_en } : UpdateCheckFAQCategoryDuplicateRequest['body'] = req.body;
  try {
    let isDuplicated = false;


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
      

    // 오류종류 1. 동일 카테고리 FAQ가 여러개 있는데 둘중에 하나만 바뀌는 경우
    // 오류종류 2. 동일 카테고리 FAQ가 여러개 있는고 두개가 다 바꼈지만 카테고리와 하나만 겹치는 경우
    // 오류종류 2. 동일 카테고리는 아닌데 카테고리가 바뀌면서 기존 카테고리와 하나만 겹치는 경우
 
    const changed_maincategory_ko = now_category.maincategory_ko === maincategory_ko ? false : true;
    const changed_maincategory_en = now_category.maincategory_en === maincategory_en ? false : true;
    const changed_subcategory_ko = now_category.subcategory_ko === subcategory_ko ? false : true;
    const changed_subcategory_en = now_category.subcategory_en === subcategory_en ? false : true;

    
    // 동일 카테고리 FAQ가 여러개 있는데 둘중에 하나만 바뀌는 경우에는 오류로 처리
    if(number_same_maincategory.number_same_maincategory > 1 && ((changed_maincategory_ko && !changed_maincategory_en) || (!changed_maincategory_ko && changed_maincategory_en))){
      isDuplicated = true;
    } else{
      if (changed_maincategory_ko) {
        const [checked_maincategory_en] = await connection.execute<RowDataPacket[]>(
          `SELECT faqs.maincategory_en FROM hobit.faqs WHERE faqs.maincategory_ko = ?`,
          [maincategory_ko]
        );
        if(checked_maincategory_en.length > 0){
          if(checked_maincategory_en[0].maincategory_en !== maincategory_en){
            isDuplicated = true;
          }
        }
      }
  
      if (changed_maincategory_en){
        const [checked_maincategory_ko] = await connection.execute<RowDataPacket[]>(
          `SELECT faqs.maincategory_ko FROM hobit.faqs WHERE faqs.maincategory_en = ?`,
          [maincategory_en]
        );
        if(checked_maincategory_ko.length > 0){
          if(checked_maincategory_ko[0].maincategory_ko !== maincategory_ko){
            isDuplicated = true;
          }
        }
      }
    }
    if(number_same_subcategory.number_same_subcategory > 1 && ((changed_subcategory_ko && !changed_subcategory_en) || (!changed_subcategory_ko && changed_subcategory_en))){
      isDuplicated = true;
    } else{
      if (changed_subcategory_ko){
        const [checked_subcategory_en] = await connection.execute<RowDataPacket[]>(
          `SELECT faqs.subcategory_en FROM hobit.faqs WHERE faqs.subcategory_ko = ?`,
          [subcategory_ko]
        );
        if(checked_subcategory_en.length > 0){
          if(checked_subcategory_en[0].subcategory_en !== subcategory_en){
            isDuplicated = true;
          }
        }
      }
  
      if (changed_subcategory_en){
        const [checked_subcategory_ko] = await connection.execute<RowDataPacket[]>(
          `SELECT faqs.subcategory_ko FROM hobit.faqs WHERE faqs.subcategory_en = ?`,
          [subcategory_en]
        );
        if(checked_subcategory_ko.length > 0){
          if(checked_subcategory_ko[0].subcategory_ko !== subcategory_ko){
            isDuplicated = true;
          }
        }
      }
    }

    const response : UpdateCheckFAQCategoryDuplicateResponse = {
      statusCode: 200,
      message: "Categories checked successfully",
      data : {
        isDuplicated: isDuplicated
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