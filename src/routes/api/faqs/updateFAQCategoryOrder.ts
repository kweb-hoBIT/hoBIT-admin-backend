import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { UpdateFAQCategoryOrderRequest, UpdateFAQCategoryOrderResponse } from "faq";
import auth from "../../../middleware/auth";
import Request from "../../../types/Request";

const router = express.Router();


// @route   PUT api/faqs/category/order
// @desc    Update FAQ category order
// @access  Private
router.put("/category/order", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { categoryOrder }: UpdateFAQCategoryOrderRequest['body'] = req.body;
  console.log(req.body);

  try {
    const data = categoryOrder.map((category, index) => {
      return [category, index + 1];
    });

    for (const [category, order] of data) {
      await connection.query(
        `UPDATE hobit.faqs SET category_order = ? WHERE maincategory_ko = ?`,
        [order, category]
      );
    }

    const response: UpdateFAQCategoryOrderResponse = {
      statusCode: 200,
      message: "Update FAQ category order successfully",
    };
    console.log(response);
    res.status(200).json(response);

  } catch (err: any) {
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
