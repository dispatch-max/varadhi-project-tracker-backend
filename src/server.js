require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
// const path = require('path')

const app = express()

// ─── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  // 'https://varadhi-tracker.vercel.app',
  'https://varadhi-project-tracker-frontend.onrender.com'
],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Static file serving (uploads) ────────────────────────────────────────────
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Varadhi Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  })
})

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'))
app.use('/api/users',         require('./routes/users.routes'))
app.use('/api/projects',      require('./routes/projects.routes'))
app.use('/api/tasks',         require('./routes/tasks.routes'))
app.use('/api/dashboard',     require('./routes/dashboard.routes'))
app.use('/api/documents',     require('./routes/documents.routes'))
app.use('/api/reports',       require('./routes/reports.routes'))
app.use('/api/notifications', require('./routes/notifications.routes'))
app.use('/api/folders',       require('./routes/folders.routes'))

// ─── Error Handlers ────────────────────────────────────────────────────────────
const { errorHandler, notFound } = require('./middleware/error.middleware')
app.use(notFound)
app.use(errorHandler)

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`\n🚀 Varadhi Backend running on port ${PORT}`)
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health\n`)
})

module.exports = app
