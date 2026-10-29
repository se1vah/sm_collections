import mysql from 'mysql2/promise';

let pool = global.mysqlPool;

export function getPool() {
  if (!pool) {
    const host = process.env.DB_HOST;

    if (!host && process.env.VERCEL) {
      throw new Error(
        'Database configuration missing on Vercel: DB_HOST environment variable is not set. ' +
        'Please go to your Vercel Project Dashboard -> Settings -> Environment Variables and add DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME.'
      );
    }

    pool = mysql.createPool({
      host: host || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME || 'sm_collections',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true,
      decimalNumbers: true,
    });

    global.mysqlPool = pool;
  }
  return pool;
}

export async function query(sql, params = []) {
  try {
    const p = getPool();
    const [rows] = await p.execute(sql, params);
    return rows;
  } catch (err) {
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
      const p = getPool();
      const [rows] = await p.execute(sql, params);
      return rows;
    }
    throw err;
  }
}

export async function getConnection() {
  const p = getPool();
  return await p.getConnection();
}

export default getPool();
