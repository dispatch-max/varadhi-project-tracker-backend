const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
})

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message)
  } else {
    console.log('✅ PostgreSQL connected successfully')
    release()
  }
})

module.exports = pool
