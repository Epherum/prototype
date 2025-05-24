// lib/db.js (using 'pg')
import { Pool } from "pg";

let pool;

// Similar caching logic for development
if (process.env.NODE_ENV === "production") {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Or individual host, user, db, pass, port
    // ssl: {
    //   rejectUnauthorized: false, // Adjust for your prod environment
    // },
  });
} else {
  if (!global._pgPool) {
    global._pgPool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      max: 10, // Max number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    });
    console.log("Established new dev DB pool");
  }
  pool = global._pgPool;
}

// Export a query function
export const query = (text, params) => pool.query(text, params);

// Optionally, export the pool itself if you need direct client access for transactions
export default pool;
