import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { UpdateSeniorFAQCategoryOrderRequest, UpdateSeniorFAQCategoryOrderResponse } from "seniorfaq";
import auth from "../../../middleware/auth";
import Request from "../../../types/Request";

const router = express.Router();


// @route   PUT api/seniorfaqs/category/order
// @desc    Update Senior FAQ category order
// @access  Private
router.put("/category/order", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { categoryOrder }: UpdateSeniorFAQCategoryOrderRequest['body'] = req.body;
  console.log(req.body);

  try {
    const data = categoryOrder.map((category, index) => {
      return [category, index + 1];
    });

    for (const [category, order] of data) {
      await connection.query(
        `UPDATE hobit.senior_faqs SET category_order = ? WHERE maincategory_ko = ?`,
        [order, category]
      );
    }

    const response: UpdateSeniorFAQCategoryOrderResponse = {
      statusCode: 200,
      message: "Update Senior FAQ category order successfully",
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
