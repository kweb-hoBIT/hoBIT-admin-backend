import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { UpdateFAQCategoryOrderRequest, UpdateFAQCategoryOrderResponse } from "faq";
import auth from "../../../middleware/auth";
import Request from "../../../types/Request";

const router = express.Router();


// @route   PUT api/faqs/category/order
// @desc    Update FAQ category order (main and sub categories)
// @access  Private
router.put("/category/order", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { mainCategories }: UpdateFAQCategoryOrderRequest['body'] = req.body;
  console.log(req.body);

  try {
    await connection.beginTransaction();

    // Update main category order
    for (const mainCat of mainCategories) {
      await connection.query(
        `UPDATE hobit.faqs SET category_order = ? WHERE maincategory_ko = ?`,
        [mainCat.order, mainCat.maincategory_ko]
      );

      // Update subcategory order if provided
      if (mainCat.subcategories && mainCat.subcategories.length > 0) {
        for (const subCat of mainCat.subcategories) {
          await connection.query(
            `UPDATE hobit.faqs SET subcategory_order = ? 
             WHERE maincategory_ko = ? AND subcategory_ko = ?`,
            [subCat.order, mainCat.maincategory_ko, subCat.subcategory_ko]
          );
        }
      }
    }

    await connection.commit();

    const response: UpdateFAQCategoryOrderResponse = {
      statusCode: 200,
      message: "Update FAQ category order successfully",
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
