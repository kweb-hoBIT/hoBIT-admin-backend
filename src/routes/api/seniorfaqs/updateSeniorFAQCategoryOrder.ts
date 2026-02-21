import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { UpdateSeniorFAQCategoryOrderRequest, UpdateSeniorFAQCategoryOrderResponse } from "seniorfaq";
import auth from "../../../middleware/auth";
import Request from "../../../types/Request";

const router = express.Router();


// @route   PUT api/seniorfaqs/category/order
// @desc    Update Senior FAQ category order (main, sub, and detail categories)
// @access  Private
router.put("/category/order", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { mainCategories }: UpdateSeniorFAQCategoryOrderRequest['body'] = req.body;
  console.log(req.body);

  try {
    await connection.beginTransaction();

    // Update main category order
    for (const mainCat of mainCategories) {
      await connection.query(
        `UPDATE hobit.senior_faqs SET category_order = ? WHERE maincategory_ko = ?`,
        [mainCat.order, mainCat.maincategory_ko]
      );

      // Update subcategory order if provided
      if (mainCat.subcategories && mainCat.subcategories.length > 0) {
        for (const subCat of mainCat.subcategories) {
          await connection.query(
            `UPDATE hobit.senior_faqs SET subcategory_order = ? 
             WHERE maincategory_ko = ? AND subcategory_ko = ?`,
            [subCat.order, mainCat.maincategory_ko, subCat.subcategory_ko]
          );

          // Update detail category order if provided
          if (subCat.detailcategories && subCat.detailcategories.length > 0) {
            for (const detailCat of subCat.detailcategories) {
              await connection.query(
                `UPDATE hobit.senior_faqs SET detailcategory_order = ? 
                 WHERE maincategory_ko = ? AND subcategory_ko = ? AND detailcategory_ko = ?`,
                [detailCat.order, mainCat.maincategory_ko, subCat.subcategory_ko, detailCat.detailcategory_ko]
              );
            }
          }
        }
      }
    }

    await connection.commit();

    const response: UpdateSeniorFAQCategoryOrderResponse = {
      statusCode: 200,
      message: "Update Senior FAQ category order successfully",
    };
    console.log(response);
    res.status(200).json(response);

  } catch (err: any) {
    await connection.rollback();
    const response = {
      statusCode: 500,
      message: err.message,
    };
    console.error(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
