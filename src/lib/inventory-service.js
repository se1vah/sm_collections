import { query } from './db.js';

export async function getInventoryStats() {
  const totalItemsRows = await query('SELECT COUNT(*) AS total FROM Items');
  const totalStockRows = await query('SELECT COALESCE(SUM(StockQuantity), 0) AS totalStock FROM Items');
  const lowStockRows = await query('SELECT COUNT(*) AS lowStock FROM Items WHERE StockQuantity > 0 AND StockQuantity <= 10');
  const outOfStockRows = await query('SELECT COUNT(*) AS outOfStock FROM Items WHERE StockQuantity <= 0');

  return {
    totalItems: Number(totalItemsRows[0]?.total || 0),
    totalStock: Number(totalStockRows[0]?.totalStock || 0),
    lowStock: Number(lowStockRows[0]?.lowStock || 0),
    outOfStock: Number(outOfStockRows[0]?.outOfStock || 0),
  };
}

export async function getItems({ search = '', category = '', page = 1, limit = 50 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  let whereClauses = [];
  let params = [];

  if (search && search.trim() !== '') {
    const s = `%${search.trim()}%`;
    const isNum = !isNaN(Number(search.trim())) && Number.isSafeInteger(Number(search.trim()));
    if (isNum) {
      whereClauses.push('(ItemID = ? OR ItemName LIKE ? OR Category LIKE ?)');
      params.push(Number(search.trim()), s, s);
    } else {
      whereClauses.push('(ItemName LIKE ? OR Category LIKE ?)');
      params.push(s, s);
    }
  }

  if (category && category.trim() !== '') {
    whereClauses.push('Category = ?');
    params.push(category.trim());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) AS total FROM Items ${whereSql}`;
  const countRows = await query(countSql, params);
  const total = countRows[0]?.total || 0;

  // Get items
  const dataSql = `SELECT ItemID, ItemName, Category, Unit, 
                          CAST(ActualPrice AS DOUBLE) AS ActualPrice, 
                          CAST(SellingPrice AS DOUBLE) AS SellingPrice, 
                          CAST(StockQuantity AS DOUBLE) AS StockQuantity 
                   FROM Items 
                   ${whereSql} 
                   ORDER BY ItemID ASC 
                   LIMIT ? OFFSET ?`;
  
  const items = await query(dataSql, [...params, limitNum, offset]);

  // Include overall inventory stats so client cards always stay 100% in sync
  const stats = await getInventoryStats();

  return {
    items,
    stats,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

export async function getItemById(id) {
  if (id === undefined || id === null || id === '') return null;
  const numericId = Number(id);
  if (isNaN(numericId) || !Number.isSafeInteger(numericId)) return null;

  const sql = `SELECT ItemID, ItemName, Category, Unit, 
                      CAST(ActualPrice AS DOUBLE) AS ActualPrice, 
                      CAST(SellingPrice AS DOUBLE) AS SellingPrice, 
                      CAST(StockQuantity AS DOUBLE) AS StockQuantity 
               FROM Items 
               WHERE ItemID = ?`;
  const rows = await query(sql, [numericId]);
  return rows[0] || null;
}

export async function getNextSuggestedItemId() {
  const sql = `SELECT MAX(ItemID) as maxId FROM Items WHERE ItemID < 1000000000`;
  const rows = await query(sql);
  const maxId = rows[0]?.maxId;
  if (!maxId || Number(maxId) < 100) {
    return 101;
  }
  return Number(maxId) + 1;
}

export async function createItem(data) {
  const numericId = Number(data.ItemID);

  const existing = await getItemById(numericId);
  if (existing) {
    const err = new Error(`Item ID #${numericId} is already in use by "${existing.ItemName}". Please choose a different unique Item ID.`);
    err.statusCode = 409;
    err.isDuplicate = true;
    throw err;
  }

  try {
    const sql = `INSERT INTO Items (ItemID, ItemName, Category, Unit, ActualPrice, SellingPrice, StockQuantity) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await query(sql, [
      numericId,
      data.ItemName,
      data.Category || null,
      data.Unit,
      data.ActualPrice,
      data.SellingPrice,
      data.StockQuantity,
    ]);

    return await getItemById(numericId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      const duplicateErr = new Error(`Item ID #${numericId} already exists in the inventory database. Please enter a different unique Item ID.`);
      duplicateErr.statusCode = 409;
      duplicateErr.isDuplicate = true;
      throw duplicateErr;
    }
    throw err;
  }
}

export async function updateItem(id, data) {
  const numericId = Number(id);
  const existing = await getItemById(numericId);
  if (!existing) {
    const err = new Error(`Item with ID ${numericId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  const sql = `UPDATE Items 
               SET ItemName = ?, Category = ?, Unit = ?, ActualPrice = ?, SellingPrice = ?, StockQuantity = ? 
               WHERE ItemID = ?`;
  await query(sql, [
    data.ItemName,
    data.Category || null,
    data.Unit,
    data.ActualPrice,
    data.SellingPrice,
    data.StockQuantity,
    numericId,
  ]);

  return await getItemById(numericId);
}

export async function deleteItem(id) {
  const numericId = Number(id);
  const existing = await getItemById(numericId);
  if (!existing) {
    const err = new Error(`Item with ID ${numericId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  const refSql = `SELECT COUNT(*) AS invoiceCount FROM Invoice_Items WHERE ItemID = ?`;
  const refRows = await query(refSql, [numericId]);
  const invoiceCount = refRows[0]?.invoiceCount || 0;

  if (invoiceCount > 0) {
    const err = new Error(
      `Cannot delete item "${existing.ItemName}" (ID: ${numericId}) because it is referenced in ${invoiceCount} existing invoice(s). Deletion is prohibited to preserve historical records.`
    );
    err.statusCode = 400;
    throw err;
  }

  await query('DELETE FROM Items WHERE ItemID = ?', [numericId]);
  return { success: true, message: `Item ${numericId} deleted successfully.` };
}
