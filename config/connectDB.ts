import mysql from 'mysql2/promise';
import env from './env';

const dbHost = env.DB_HOST;
const dbUser = env.DB_USER;
const dbPassword = env.DB_PASSWORD;
const dbName = env.DB_NAME;
const timezone = env.TIMEZONE;

// MySQL connection pool
const Pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  timezone: timezone,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export { Pool };
