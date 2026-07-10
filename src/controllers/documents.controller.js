// const pool = require('../config/db')
// const { successResponse, errorResponse } = require('../utils/response')
// const path = require('path')
// const fs = require('fs')

// exports.getAllDocuments = async (req, res) => {
//   try {
//     const { projectId, search } = req.query
//     let query = `SELECT d.*, u.name AS uploader_name, p.name AS project_name
//       FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id
//       LEFT JOIN projects p ON d.project_id = p.id WHERE 1=1`
//     const params = []
//     if (projectId) { params.push(projectId); query += ` AND d.project_id = $${params.length}` }
//     if (search) { params.push(`%${search}%`); query += ` AND d.name ILIKE $${params.length}` }
//     query += ' ORDER BY d.created_at DESC'
//     const result = await pool.query(query, params)
//     const docs = result.rows.map(d => ({
//       id: d.id, name: d.name, originalName: d.original_name,
//       fileType: d.file_type, fileSize: d.file_size, url: d.url,
//       description: d.description, createdAt: d.created_at,
//       project: d.project_id ? { id: d.project_id, name: d.project_name } : null,
//       uploadedBy: { id: d.uploaded_by, name: d.uploader_name }
//     }))
//     return successResponse(res, docs)
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.uploadDocument = async (req, res) => {
//   try {
//     if (!req.file) return errorResponse(res, 'No file uploaded.')
//     const { description, projectId } = req.body
//     const { originalname, mimetype, size, path: filePath } = req.file
//     const ext = originalname.split('.').pop().toLowerCase()
//     // In production: upload to Cloudinary here
//     // For now: store local path
//     // const url = `/uploads/${req.file.filename}`
//     const result = await pool.query(
//       'INSERT INTO documents (name, original_name, file_type, file_size, url, description, project_id, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
//       [originalname, originalname, ext, size, url, description, projectId || null, req.user.id]
//     )
//     const doc = await pool.query(
//       `SELECT d.*, u.name AS uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = $1`,
//       [result.rows[0].id]
//     )
//     return successResponse(res, doc.rows[0], 'File uploaded successfully.', 201)
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// // exports.deleteDocument = async (req, res) => {
// //   try {
// //     const result = await pool.query('DELETE FROM documents WHERE id=$1 RETURNING id', [req.params.id])
// //     if (!result.rows[0]) return errorResponse(res, 'Document not found.', 404)
// //     return successResponse(res, null, 'Document deleted.')
// //   } catch (err) { return errorResponse(res, err.message, 500) }
// // }


// function resolveUploadPath(doc) {
//   return path.join(__dirname, '..', '..', 'uploads', path.basename(doc.url))
// }

// exports.downloadDocument = async (req, res) => {
//   try {
//     const { id } = req.params
//     const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id])
//     const doc = result.rows[0]
//     if (!doc) return res.status(404).json({ message: 'Document not found' })

//     const filePath = resolveUploadPath(doc)
//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({ message: 'File missing on server' })
//     }
//     // res.download streams the file and sets Content-Disposition with the original name
//     res.download(filePath, doc.original_name || doc.name)
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to download document' })
//   }
// }

// exports.deleteDocument = async (req, res) => {
//   try {
//     const { id } = req.params
//     const result = await pool.query(
//       'DELETE FROM documents WHERE id = $1 RETURNING *',
//       [id]
//     )
//     const doc = result.rows[0]
//     if (!doc) return res.status(404).json({ message: 'Document not found' })

//     // best-effort file cleanup — DB row is already gone, so a failed unlink
//     // shouldn't fail the request; just log it
//     fs.unlink(resolveUploadPath(doc), (err) => {
//       if (err) console.warn('Could not remove file for document', id, err.message)
//     })

//     res.json({ success: true, data: { id } })
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to delete document' })
//   }
// }

const pool = require('../config/db')
const cloudinary = require('../config/cloudinary')
const { successResponse, errorResponse } = require('../utils/response')

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Upload a memory buffer to Cloudinary via upload_stream, promisified.
function uploadBufferToCloudinary(buffer, originalname) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'varadhi/documents',
        resource_type: 'auto',
        // keep a readable public_id based on the original name (without extension)
        filename_override: originalname,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      }
    )
    stream.end(buffer)
  })
}

// Cloudinary requires the correct resource_type to destroy an asset.
// With resource_type 'auto': images and PDFs are stored as 'image';
// doc/docx/xls/xlsx/zip are stored as 'raw'.
function resourceTypeForExt(ext) {
  return ['png', 'jpg', 'jpeg', 'pdf'].includes((ext || '').toLowerCase())
    ? 'image'
    : 'raw'
}

// ─── Controllers ───────────────────────────────────────────────────────────────

exports.getAllDocuments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.name, d.original_name, d.file_type, d.file_size,
             d.url, d.description, d.created_at,
             p.id AS project_id, p.name AS project_name,
             u.id AS uploader_id, u.name AS uploader_name
      FROM documents d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN users u ON d.uploaded_by = u.id
      ORDER BY d.created_at DESC
    `)
    const documents = result.rows.map((d) => ({
      id: d.id,
      name: d.name,
      originalName: d.original_name,
      fileType: d.file_type,
      fileSize: parseInt(d.file_size) || 0,
      url: d.url,
      description: d.description,
      createdAt: d.created_at,
      project: d.project_id ? { id: d.project_id, name: d.project_name } : null,
      uploadedBy: d.uploader_id ? { id: d.uploader_id, name: d.uploader_name } : null,
    }))
    return successResponse(res, documents)
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded.')

    const { description, projectId } = req.body
    const { originalname, size, buffer } = req.file
    const ext = originalname.split('.').pop()?.toLowerCase() || 'file'

    // Upload the in-memory buffer to Cloudinary
    const uploaded = await uploadBufferToCloudinary(buffer, originalname)
    

    const result = await pool.query(
      `INSERT INTO documents
        (name, original_name, file_type, file_size, url, cloudinary_public_id, description, project_id, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        originalname,
        originalname,
        ext,
        size,
        uploaded.secure_url,
        uploaded.public_id,
        description || null,
        projectId || null,
        req.user.id,
      ]
    )

    return successResponse(
      res,
      {
        id: result.rows[0].id,
        url: uploaded.secure_url,
        name: originalname,
        fileType: ext,
        fileSize: size,
      },
      'Document uploaded successfully.',
      201
    )
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}

exports.downloadDocument = async (req, res) => {
  try {

    if (req.user.role.toLowerCase() === 'employee') {
  return errorResponse(
    res,
    'You are not authorized to download documents.',
    403
  )
}
    const { id } = req.params
    const result = await pool.query('SELECT url FROM documents WHERE id = $1', [id])
    const doc = result.rows[0]
    if (!doc) return errorResponse(res, 'Document not found.', 404)
    if (!doc.url) return errorResponse(res, 'File missing for this document.', 404)

    // Files live on Cloudinary now — redirect to the secure URL.
    return res.redirect(doc.url)
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}

exports.deleteDocument = async (req, res) => {
  try {
    if (req.user.role.toLowerCase() === 'employee') {
  return errorResponse(
    res,
    'You are not authorized to delete documents.',
    403
  )
}
    const { id } = req.params
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id])
    const doc = result.rows[0]
    if (!doc) return errorResponse(res, 'Document not found.', 404)

    // 1) Delete the Cloudinary asset (if we have a public_id — legacy local
    //    rows won't, and should still be deletable from the DB)
    if (doc.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(doc.cloudinary_public_id, {
          resource_type: resourceTypeForExt(doc.file_type),
        })
      } catch (cloudErr) {
        // Log but don't block the DB delete — an orphaned asset is recoverable,
        // a document that "won't delete" is a worse failure mode.
        console.warn('Cloudinary destroy failed for', doc.cloudinary_public_id, cloudErr.message)
      }
    }

    // 2) Delete the DB record
    await pool.query('DELETE FROM documents WHERE id = $1', [id])

    return successResponse(res, { id }, 'Document deleted successfully.')
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}