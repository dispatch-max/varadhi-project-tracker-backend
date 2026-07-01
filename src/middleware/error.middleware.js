exports.errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message)
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

exports.notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
}
