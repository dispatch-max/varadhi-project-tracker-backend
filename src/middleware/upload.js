const multer = require('multer')
const path = require('path')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Allowed extensions and their expected mimetypes
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.zip']
const ALLOWED_MIMETYPES = [
  'application/pdf',

  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  'image/png',
  'image/jpeg',

  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'multipart/x-zip',
  'application/x-compressed',
]

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()

  // Extension check
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('File type not allowed.'))
  }

  // ZIP files → allow directly
  if (ext === '.zip') {
    return cb(null, true)
  }

  // Other files → MIME type check
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(null, true)
  }

  return cb(new Error('File type not allowed.'))
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
})

module.exports = upload