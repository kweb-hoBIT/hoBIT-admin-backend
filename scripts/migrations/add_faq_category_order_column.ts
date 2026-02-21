import { Pool } from "../../config/connectDB";

async function addFAQCategoryOrderColumn() {
  const connection = await Pool.getConnection();
  
  try {
    console.log("Adding subcategory_order column to faqs table...");
    
    // Add column
    await connection.query(`
      ALTER TABLE hobit.faqs 
      ADD COLUMN IF NOT EXISTS subcategory_order INT DEFAULT 1 AFTER category_order
    `);
    
    console.log("Column added successfully!");
    
    // Update existing records with default order values
    console.log("Setting default order values for existing records...");
    
    await connection.query(`
      UPDATE hobit.faqs 
      SET subcategory_order = 1 
      WHERE subcategory_order IS NULL
    `);
    
    console.log("Migration completed successfully!");
    
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    connection.release();
    await Pool.end();
  }
}

// Run migration
addFAQCategoryOrderColumn()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
