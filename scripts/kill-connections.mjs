import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.ezplkvyxdyasaohgzdhl:2Subho6294407118@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function killIdleConnections() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Transaction Pooler...");
    
    const query = `
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = 'postgres' 
        AND pid <> pg_backend_pid() 
        AND state IN ('idle', 'idle in transaction');
    `;
    
    const res = await client.query(query);
    console.log(`Terminated ${res.rowCount} idle connections.`);
  } catch (err) {
    console.error("Error terminating connections:", err);
  } finally {
    await client.end();
  }
}

killIdleConnections();
