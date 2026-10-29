import { getConnection, query } from './db.js';

function formatDateForMySQL(dateVal) {
  if (!dateVal) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid InvoiceDate format');
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function getAllInvoices({ search = '', date = '', startDate = '', endDate = '' } = {}) {
  let whereClauses = [];
  let params = [];

  if (search && search.trim() !== '') {
    const s = search.trim();
    if (!isNaN(Number(s))) {
      whereClauses.push('inv.InvoiceID = ?');
      params.push(Number(s));
    }
  }

  if (date && date.trim() !== '') {
    whereClauses.push('DATE(inv.InvoiceDate) = ?');
    params.push(date.trim());
  } else if (startDate && endDate) {
    whereClauses.push('DATE(inv.InvoiceDate) BETWEEN ? AND ?');
    params.push(startDate.trim(), endDate.trim());
  } else if (startDate) {
    whereClauses.push('DATE(inv.InvoiceDate) >= ?');
    params.push(startDate.trim());
  } else if (endDate) {
    whereClauses.push('DATE(inv.InvoiceDate) <= ?');
    params.push(endDate.trim());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      inv.InvoiceID,
      inv.InvoiceDate,
      CAST(inv.sub_total AS DOUBLE) AS sub_total,
      CAST(inv.Discount AS DOUBLE) AS Discount,
      CAST(inv.total_amount AS DOUBLE) AS total_amount,
      inv.PaymentMethod,
      COUNT(ii.InvoiceItemID) AS totalItems,
      COALESCE(SUM(ii.Quantity), 0) AS totalQuantity,
      COALESCE(SUM(ii.Quantity * ii.Price), 0) AS calculatedItemsTotal
    FROM Invoices inv
    LEFT JOIN Invoice_Items ii ON inv.InvoiceID = ii.InvoiceID
    ${whereSql}
    GROUP BY inv.InvoiceID, inv.InvoiceDate, inv.sub_total, inv.Discount, inv.total_amount, inv.PaymentMethod
    ORDER BY inv.InvoiceID DESC
  `;

  const rows = await query(sql, params);
  return rows.map((r) => {
    const calculatedSubTotal = Number(r.sub_total || 0) > 0 ? Number(r.sub_total) : Number(r.calculatedItemsTotal || 0);
    const discount = Number(r.Discount || 0);
    const totalAmount = Number(r.total_amount || 0) > 0 ? Number(r.total_amount) : Math.max(0, calculatedSubTotal - discount);

    return {
      InvoiceID: r.InvoiceID,
      InvoiceDate: r.InvoiceDate,
      sub_total: Number(calculatedSubTotal.toFixed(2)),
      Discount: Number(discount.toFixed(2)),
      total_amount: Number(totalAmount.toFixed(2)),
      PaymentMethod: r.PaymentMethod || 'Cash',
      totalItems: Number(r.totalItems || 0),
      totalQuantity: Number(r.totalQuantity || 0),
      grandTotal: Number(totalAmount.toFixed(2)), // For backward compatibility
    };
  });
}

export async function getInvoiceById(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return null;

  const invSql = `
    SELECT 
      InvoiceID, 
      InvoiceDate, 
      CAST(sub_total AS DOUBLE) AS sub_total,
      CAST(Discount AS DOUBLE) AS Discount,
      CAST(total_amount AS DOUBLE) AS total_amount,
      PaymentMethod
    FROM Invoices 
    WHERE InvoiceID = ?
  `;
  const invRows = await query(invSql, [numericId]);
  if (!invRows || invRows.length === 0) {
    return null;
  }
  const invoice = invRows[0];

  const itemsSql = `
    SELECT 
      ii.InvoiceItemID,
      ii.InvoiceID,
      ii.ItemID,
      ii.ItemName,
      CAST(ii.Quantity AS DOUBLE) AS Quantity,
      CAST(ii.Price AS DOUBLE) AS Price,
      CAST(ii.Quantity * ii.Price AS DOUBLE) AS Total,
      it.Unit,
      CAST(it.StockQuantity AS DOUBLE) AS AvailableStock
    FROM Invoice_Items ii
    LEFT JOIN Items it ON ii.ItemID = it.ItemID
    WHERE ii.InvoiceID = ?
    ORDER BY ii.InvoiceItemID ASC
  `;
  const items = await query(itemsSql, [numericId]);

  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.Quantity || 0), 0);
  const itemsSum = items.reduce((sum, item) => sum + Number(item.Total || 0), 0);

  const sub_total = Number(invoice.sub_total || 0) > 0 ? Number(invoice.sub_total) : Number(itemsSum.toFixed(2));
  const discount = Number(invoice.Discount || 0);
  const total_amount = Number(invoice.total_amount || 0) > 0 ? Number(invoice.total_amount) : Math.max(0, sub_total - discount);

  return {
    InvoiceID: invoice.InvoiceID,
    InvoiceDate: invoice.InvoiceDate,
    sub_total: Number(sub_total.toFixed(2)),
    Discount: Number(discount.toFixed(2)),
    total_amount: Number(total_amount.toFixed(2)),
    PaymentMethod: invoice.PaymentMethod || 'Cash',
    items,
    summary: {
      totalItems,
      totalQuantity: Number(totalQuantity.toFixed(2)),
      subTotal: Number(sub_total.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      totalAmount: Number(total_amount.toFixed(2)),
      grandTotal: Number(total_amount.toFixed(2)),
    },
  };
}

export async function createInvoice({ InvoiceDate, Discount = 0, PaymentMethod = 'Cash', items }) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('Invoice must contain at least one item');
    err.statusCode = 400;
    throw err;
  }

  // Consolidate duplicate ItemIDs
  const consolidated = [];
  const map = new Map();
  for (const itm of items) {
    const id = Number(itm.ItemID);
    if (map.has(id)) {
      const existing = map.get(id);
      existing.Quantity = Number(existing.Quantity) + Number(itm.Quantity);
    } else {
      const copy = { ...itm, ItemID: id, Quantity: Number(itm.Quantity), Price: Number(itm.Price) };
      map.set(id, copy);
      consolidated.push(copy);
    }
  }

  // Compute Subtotal
  const subTotal = Number(
    consolidated.reduce((sum, item) => sum + item.Quantity * item.Price, 0).toFixed(2)
  );

  // Validate Discount
  const discountNum = Number(Discount) || 0;
  if (discountNum < 0) {
    const err = new Error('Discount cannot be negative.');
    err.statusCode = 400;
    throw err;
  }
  if (discountNum > subTotal) {
    const err = new Error(
      `Discount (₹${discountNum.toFixed(2)}) cannot be greater than Subtotal (₹${subTotal.toFixed(2)}).`
    );
    err.statusCode = 400;
    throw err;
  }

  // Compute Total Amount
  const totalAmount = Number((subTotal - discountNum).toFixed(2));

  // Validate Payment Method
  const validMethods = ['Cash', 'UPI', 'Card'];
  const paymentMethod = validMethods.includes(PaymentMethod) ? PaymentMethod : 'Cash';

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Lock and validate all items
    for (const item of consolidated) {
      const [itemRows] = await conn.execute(
        'SELECT ItemID, ItemName, StockQuantity, SellingPrice FROM Items WHERE ItemID = ? FOR UPDATE',
        [item.ItemID]
      );
      if (itemRows.length === 0) {
        throw new Error(`Item with ID ${item.ItemID} not found in inventory.`);
      }
      const dbItem = itemRows[0];
      const available = Number(dbItem.StockQuantity);
      if (available < item.Quantity) {
        throw new Error(
          `Insufficient stock for "${dbItem.ItemName}" (ID: ${item.ItemID}). Available: ${available}, Requested: ${item.Quantity}`
        );
      }
      item.ItemName = item.ItemName || dbItem.ItemName;
    }

    const formattedDate = formatDateForMySQL(InvoiceDate);

    // Insert Invoice with new columns
    const [invResult] = await conn.execute(
      'INSERT INTO Invoices (InvoiceDate, sub_total, Discount, total_amount, PaymentMethod) VALUES (?, ?, ?, ?, ?)',
      [formattedDate, subTotal, discountNum, totalAmount, paymentMethod]
    );
    const invoiceId = invResult.insertId;

    // Insert Invoice Items & Deduct Stock
    for (const item of consolidated) {
      await conn.execute(
        'INSERT INTO Invoice_Items (InvoiceID, ItemID, ItemName, Quantity, Price) VALUES (?, ?, ?, ?, ?)',
        [invoiceId, item.ItemID, item.ItemName, item.Quantity, item.Price]
      );

      await conn.execute(
        'UPDATE Items SET StockQuantity = StockQuantity - ? WHERE ItemID = ?',
        [item.Quantity, item.ItemID]
      );
    }

    await conn.commit();
    return {
      InvoiceID: invoiceId,
      sub_total: subTotal,
      Discount: discountNum,
      total_amount: totalAmount,
      PaymentMethod: paymentMethod,
      message: 'Invoice created successfully',
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateInvoice(id, { InvoiceDate, Discount = 0, PaymentMethod = 'Cash', items }) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    const err = new Error('Invalid Invoice ID');
    err.statusCode = 400;
    throw err;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('Invoice must contain at least one item');
    err.statusCode = 400;
    throw err;
  }

  // Consolidate new items by ItemID
  const consolidated = [];
  const newMap = new Map();
  for (const itm of items) {
    const itemId = Number(itm.ItemID);
    if (newMap.has(itemId)) {
      const existing = newMap.get(itemId);
      existing.Quantity = Number(existing.Quantity) + Number(itm.Quantity);
    } else {
      const copy = { ...itm, ItemID: itemId, Quantity: Number(itm.Quantity), Price: Number(itm.Price) };
      newMap.set(itemId, copy);
      consolidated.push(copy);
    }
  }

  // Compute Subtotal
  const subTotal = Number(
    consolidated.reduce((sum, item) => sum + item.Quantity * item.Price, 0).toFixed(2)
  );

  // Validate Discount
  const discountNum = Number(Discount) || 0;
  if (discountNum < 0) {
    const err = new Error('Discount cannot be negative.');
    err.statusCode = 400;
    throw err;
  }
  if (discountNum > subTotal) {
    const err = new Error(
      `Discount (₹${discountNum.toFixed(2)}) cannot be greater than Subtotal (₹${subTotal.toFixed(2)}).`
    );
    err.statusCode = 400;
    throw err;
  }

  // Compute Total Amount
  const totalAmount = Number((subTotal - discountNum).toFixed(2));

  // Validate Payment Method
  const validMethods = ['Cash', 'UPI', 'Card'];
  const paymentMethod = validMethods.includes(PaymentMethod) ? PaymentMethod : 'Cash';

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Lock existing invoice
    const [invRows] = await conn.execute(
      'SELECT InvoiceID, InvoiceDate FROM Invoices WHERE InvoiceID = ? FOR UPDATE',
      [numericId]
    );
    if (invRows.length === 0) {
      const err = new Error(`Invoice with ID ${numericId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const formattedDate = formatDateForMySQL(InvoiceDate);

    // Update Invoice record with new financial columns
    await conn.execute(
      'UPDATE Invoices SET InvoiceDate = ?, sub_total = ?, Discount = ?, total_amount = ?, PaymentMethod = ? WHERE InvoiceID = ?',
      [formattedDate, subTotal, discountNum, totalAmount, paymentMethod, numericId]
    );

    // Lock existing invoice items
    const [oldItems] = await conn.execute(
      'SELECT InvoiceItemID, ItemID, Quantity, Price, ItemName FROM Invoice_Items WHERE InvoiceID = ? FOR UPDATE',
      [numericId]
    );

    const oldMap = new Map();
    for (const oldItm of oldItems) {
      oldMap.set(Number(oldItm.ItemID), oldItm);
    }

    // Collect all unique ItemIDs involved
    const allItemIds = new Set([...oldMap.keys(), ...newMap.keys()]);

    // Lock all involved inventory items
    const inventoryMap = new Map();
    for (const itemId of allItemIds) {
      const [itRows] = await conn.execute(
        'SELECT ItemID, ItemName, StockQuantity FROM Items WHERE ItemID = ? FOR UPDATE',
        [itemId]
      );
      if (itRows.length === 0) {
        throw new Error(`Inventory item with ID ${itemId} not found.`);
      }
      inventoryMap.set(itemId, itRows[0]);
    }

    // 1. Process items in new payload
    for (const newItem of consolidated) {
      const invItem = inventoryMap.get(newItem.ItemID);
      const availableStock = Number(invItem.StockQuantity);

      if (oldMap.has(newItem.ItemID)) {
        const oldItm = oldMap.get(newItem.ItemID);
        const oldQty = Number(oldItm.Quantity);
        const newQty = Number(newItem.Quantity);
        const diff = newQty - oldQty;

        if (diff > 0) {
          if (availableStock < diff) {
            throw new Error(
              `Insufficient stock for "${invItem.ItemName}" (ID: ${newItem.ItemID}) to increase quantity by ${diff}. Available: ${availableStock}`
            );
          }
          await conn.execute(
            'UPDATE Items SET StockQuantity = StockQuantity - ? WHERE ItemID = ?',
            [diff, newItem.ItemID]
          );
        } else if (diff < 0) {
          const restoreQty = Math.abs(diff);
          await conn.execute(
            'UPDATE Items SET StockQuantity = StockQuantity + ? WHERE ItemID = ?',
            [restoreQty, newItem.ItemID]
          );
        }

        await conn.execute(
          'UPDATE Invoice_Items SET Quantity = ?, Price = ?, ItemName = ? WHERE InvoiceItemID = ?',
          [newQty, newItem.Price, newItem.ItemName || invItem.ItemName, oldItm.InvoiceItemID]
        );
      } else {
        const reqQty = Number(newItem.Quantity);
        if (availableStock < reqQty) {
          throw new Error(
            `Insufficient stock for "${invItem.ItemName}" (ID: ${newItem.ItemID}). Available: ${availableStock}, Requested: ${reqQty}`
          );
        }
        await conn.execute(
          'UPDATE Items SET StockQuantity = StockQuantity - ? WHERE ItemID = ?',
          [reqQty, newItem.ItemID]
        );

        await conn.execute(
          'INSERT INTO Invoice_Items (InvoiceID, ItemID, ItemName, Quantity, Price) VALUES (?, ?, ?, ?, ?)',
          [numericId, newItem.ItemID, newItem.ItemName || invItem.ItemName, reqQty, newItem.Price]
        );
      }
    }

    // 2. Process items removed from invoice
    for (const [oldItemId, oldItm] of oldMap.entries()) {
      if (!newMap.has(oldItemId)) {
        const restoreQty = Number(oldItm.Quantity);
        await conn.execute(
          'UPDATE Items SET StockQuantity = StockQuantity + ? WHERE ItemID = ?',
          [restoreQty, oldItemId]
        );
        await conn.execute(
          'DELETE FROM Invoice_Items WHERE InvoiceItemID = ?',
          [oldItm.InvoiceItemID]
        );
      }
    }

    await conn.commit();
    return {
      InvoiceID: numericId,
      sub_total: subTotal,
      Discount: discountNum,
      total_amount: totalAmount,
      PaymentMethod: paymentMethod,
      message: 'Invoice updated successfully',
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function deleteInvoice(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    const err = new Error('Invalid Invoice ID');
    err.statusCode = 400;
    throw err;
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [invRows] = await conn.execute(
      'SELECT InvoiceID FROM Invoices WHERE InvoiceID = ? FOR UPDATE',
      [numericId]
    );
    if (invRows.length === 0) {
      const err = new Error(`Invoice with ID ${numericId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const [items] = await conn.execute(
      'SELECT InvoiceItemID, ItemID, Quantity FROM Invoice_Items WHERE InvoiceID = ? FOR UPDATE',
      [numericId]
    );

    for (const item of items) {
      await conn.execute(
        'UPDATE Items SET StockQuantity = StockQuantity + ? WHERE ItemID = ?',
        [item.Quantity, item.ItemID]
      );
    }

    await conn.execute('DELETE FROM Invoice_Items WHERE InvoiceID = ?', [numericId]);
    await conn.execute('DELETE FROM Invoices WHERE InvoiceID = ?', [numericId]);

    await conn.commit();
    return { success: true, message: `Invoice #${numericId} deleted and stock restored.` };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Individual Invoice Item Operations
export async function getAllInvoiceItems() {
  const sql = `
    SELECT 
      ii.InvoiceItemID,
      ii.InvoiceID,
      ii.ItemID,
      ii.ItemName,
      CAST(ii.Quantity AS DOUBLE) AS Quantity,
      CAST(ii.Price AS DOUBLE) AS Price,
      CAST(ii.Quantity * ii.Price AS DOUBLE) AS Total,
      it.Unit
    FROM Invoice_Items ii
    LEFT JOIN Items it ON ii.ItemID = it.ItemID
    ORDER BY ii.InvoiceItemID DESC
  `;
  return await query(sql);
}

export async function getInvoiceItemsByInvoiceId(invoiceId) {
  const numericId = parseInt(invoiceId, 10);
  const sql = `
    SELECT 
      ii.InvoiceItemID,
      ii.InvoiceID,
      ii.ItemID,
      ii.ItemName,
      CAST(ii.Quantity AS DOUBLE) AS Quantity,
      CAST(ii.Price AS DOUBLE) AS Price,
      CAST(ii.Quantity * ii.Price AS DOUBLE) AS Total,
      it.Unit,
      CAST(it.StockQuantity AS DOUBLE) AS AvailableStock
    FROM Invoice_Items ii
    LEFT JOIN Items it ON ii.ItemID = it.ItemID
    WHERE ii.InvoiceID = ?
    ORDER BY ii.InvoiceItemID ASC
  `;
  return await query(sql, [numericId]);
}

export async function getInvoiceItemById(invoiceItemId) {
  const numericId = parseInt(invoiceItemId, 10);
  const sql = `
    SELECT 
      ii.InvoiceItemID,
      ii.InvoiceID,
      ii.ItemID,
      ii.ItemName,
      CAST(ii.Quantity AS DOUBLE) AS Quantity,
      CAST(ii.Price AS DOUBLE) AS Price,
      CAST(ii.Quantity * ii.Price AS DOUBLE) AS Total,
      it.Unit
    FROM Invoice_Items ii
    LEFT JOIN Items it ON ii.ItemID = it.ItemID
    WHERE ii.InvoiceItemID = ?
  `;
  const rows = await query(sql, [numericId]);
  return rows[0] || null;
}

export async function createSingleInvoiceItem({ InvoiceID, ItemID, ItemName, Quantity, Price }) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [invRows] = await conn.execute(
      'SELECT InvoiceID FROM Invoices WHERE InvoiceID = ? FOR UPDATE',
      [InvoiceID]
    );
    if (invRows.length === 0) {
      throw new Error(`Invoice with ID ${InvoiceID} not found.`);
    }

    const [itRows] = await conn.execute(
      'SELECT ItemID, ItemName, StockQuantity FROM Items WHERE ItemID = ? FOR UPDATE',
      [ItemID]
    );
    if (itRows.length === 0) {
      throw new Error(`Item with ID ${ItemID} not found.`);
    }
    const invItem = itRows[0];
    const available = Number(invItem.StockQuantity);
    const reqQty = Number(Quantity);

    if (available < reqQty) {
      throw new Error(
        `Insufficient stock for "${invItem.ItemName}". Available: ${available}, Requested: ${reqQty}`
      );
    }

    await conn.execute(
      'UPDATE Items SET StockQuantity = StockQuantity - ? WHERE ItemID = ?',
      [reqQty, ItemID]
    );

    const [insertRes] = await conn.execute(
      'INSERT INTO Invoice_Items (InvoiceID, ItemID, ItemName, Quantity, Price) VALUES (?, ?, ?, ?, ?)',
      [InvoiceID, ItemID, ItemName || invItem.ItemName, reqQty, Price]
    );

    // Recalculate invoice totals
    const [itemSums] = await conn.execute(
      'SELECT COALESCE(SUM(Quantity * Price), 0) AS subTotal FROM Invoice_Items WHERE InvoiceID = ?',
      [InvoiceID]
    );
    const newSubTotal = Number(itemSums[0].subTotal || 0);
    const [invMeta] = await conn.execute('SELECT Discount FROM Invoices WHERE InvoiceID = ?', [InvoiceID]);
    const discount = Number(invMeta[0]?.Discount || 0);
    const totalAmount = Math.max(0, newSubTotal - discount);

    await conn.execute(
      'UPDATE Invoices SET sub_total = ?, total_amount = ? WHERE InvoiceID = ?',
      [newSubTotal, totalAmount, InvoiceID]
    );

    await conn.commit();
    return { InvoiceItemID: insertRes.insertId, message: 'Invoice item added successfully' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateSingleInvoiceItem(invoiceItemId, { Quantity, Price }) {
  const numericId = parseInt(invoiceItemId, 10);
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [iiRows] = await conn.execute(
      'SELECT InvoiceItemID, InvoiceID, ItemID, Quantity, Price FROM Invoice_Items WHERE InvoiceItemID = ? FOR UPDATE',
      [numericId]
    );
    if (iiRows.length === 0) {
      throw new Error(`Invoice item with ID ${numericId} not found.`);
    }
    const oldItem = iiRows[0];
    const oldQty = Number(oldItem.Quantity);
    const newQty = Quantity !== undefined ? Number(Quantity) : oldQty;
    const newPrice = Price !== undefined ? Number(Price) : Number(oldItem.Price);

    const diff = newQty - oldQty;
    if (diff !== 0) {
      const [itRows] = await conn.execute(
        'SELECT ItemID, ItemName, StockQuantity FROM Items WHERE ItemID = ? FOR UPDATE',
        [oldItem.ItemID]
      );
      if (itRows.length === 0) {
        throw new Error(`Item ${oldItem.ItemID} not found.`);
      }
      const invItem = itRows[0];
      const available = Number(invItem.StockQuantity);

      if (diff > 0) {
        if (available < diff) {
          throw new Error(
            `Insufficient stock for "${invItem.ItemName}" to increase quantity by ${diff}. Available: ${available}`
          );
        }
        await conn.execute(
          'UPDATE Items SET StockQuantity = StockQuantity - ? WHERE ItemID = ?',
          [diff, oldItem.ItemID]
        );
      } else {
        await conn.execute(
          'UPDATE Items SET StockQuantity = StockQuantity + ? WHERE ItemID = ?',
          [Math.abs(diff), oldItem.ItemID]
        );
      }
    }

    await conn.execute(
      'UPDATE Invoice_Items SET Quantity = ?, Price = ? WHERE InvoiceItemID = ?',
      [newQty, newPrice, numericId]
    );

    // Recalculate invoice totals
    const [itemSums] = await conn.execute(
      'SELECT COALESCE(SUM(Quantity * Price), 0) AS subTotal FROM Invoice_Items WHERE InvoiceID = ?',
      [oldItem.InvoiceID]
    );
    const newSubTotal = Number(itemSums[0].subTotal || 0);
    const [invMeta] = await conn.execute('SELECT Discount FROM Invoices WHERE InvoiceID = ?', [oldItem.InvoiceID]);
    const discount = Number(invMeta[0]?.Discount || 0);
    const totalAmount = Math.max(0, newSubTotal - discount);

    await conn.execute(
      'UPDATE Invoices SET sub_total = ?, total_amount = ? WHERE InvoiceID = ?',
      [newSubTotal, totalAmount, oldItem.InvoiceID]
    );

    await conn.commit();
    return { success: true, message: 'Invoice item updated successfully' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function deleteSingleInvoiceItem(invoiceItemId) {
  const numericId = parseInt(invoiceItemId, 10);
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const [iiRows] = await conn.execute(
      'SELECT InvoiceItemID, InvoiceID, ItemID, Quantity FROM Invoice_Items WHERE InvoiceItemID = ? FOR UPDATE',
      [numericId]
    );
    if (iiRows.length === 0) {
      throw new Error(`Invoice item with ID ${numericId} not found.`);
    }
    const item = iiRows[0];

    await conn.execute(
      'UPDATE Items SET StockQuantity = StockQuantity + ? WHERE ItemID = ?',
      [item.Quantity, item.ItemID]
    );

    await conn.execute('DELETE FROM Invoice_Items WHERE InvoiceItemID = ?', [numericId]);

    // Recalculate invoice totals
    const [itemSums] = await conn.execute(
      'SELECT COALESCE(SUM(Quantity * Price), 0) AS subTotal FROM Invoice_Items WHERE InvoiceID = ?',
      [item.InvoiceID]
    );
    const newSubTotal = Number(itemSums[0].subTotal || 0);
    const [invMeta] = await conn.execute('SELECT Discount FROM Invoices WHERE InvoiceID = ?', [item.InvoiceID]);
    const discount = Number(invMeta[0]?.Discount || 0);
    const totalAmount = Math.max(0, newSubTotal - discount);

    await conn.execute(
      'UPDATE Invoices SET sub_total = ?, total_amount = ? WHERE InvoiceID = ?',
      [newSubTotal, totalAmount, item.InvoiceID]
    );

    await conn.commit();
    return { success: true, message: 'Invoice item deleted and stock restored.' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
