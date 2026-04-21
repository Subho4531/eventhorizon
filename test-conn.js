const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  const url = process.env.DATABASE_URL;
  console.log('Testing connection to:', url.split('@')[1]); // Log host only for safety
  
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Successfully connected to Postgres!');
    const res = await client.query('SELECT NOW()');
    console.log('Current time from DB:', res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error('Connection failed!', err.message);
    
    if (url.includes('channel_binding=require')) {
      console.log('Retrying without channel_binding...');
      const simplifiedUrl = url.replace('&channel_binding=require', '').replace('?channel_binding=require', '');
      const client2 = new Client({
        connectionString: simplifiedUrl,
        ssl: { rejectUnauthorized: false }
      });
      try {
        await client2.connect();
        console.log('Success without channel_binding!');
        await client2.end();
      } catch (err2) {
        console.error('Connection still failed:', err2.message);
      }
    }
  }
}

testConnection();
