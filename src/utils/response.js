exports.successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data })
}
exports.errorResponse = (res, message = 'Error', statusCode = 400) => {
  return res.status(statusCode).json({ success: false, message })
}
exports.paginatedResponse = (res, data, total, page, limit) => {
  return res.status(200).json({
    success: true, message: 'Success',
    data: { data, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
  })
}
