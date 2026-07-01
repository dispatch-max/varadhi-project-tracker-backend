// const pool = require('../config/db')
// const { successResponse, errorResponse, paginatedResponse } = require('../utils/response')

// const getTaskWithDetails = async (taskId) => {
//   const result = await pool.query(`
//     SELECT t.*,
//       a.id AS assignee_id, a.name AS assignee_name, a.email AS assignee_email, a.avatar AS assignee_avatar,
//       r.id AS reporter_id, r.name AS reporter_name,
//       p.id AS project_id, p.name AS project_name
//     FROM tasks t
//     LEFT JOIN users a ON t.assignee_id = a.id
//     LEFT JOIN users r ON t.reporter_id = r.id
//     LEFT JOIN projects p ON t.project_id = p.id
//     WHERE t.id = $1
//   `, [taskId])
//   if (!result.rows[0]) return null
//   const t = result.rows[0]
//   const comments = await pool.query(`
//     SELECT c.*, u.name AS author_name, u.avatar AS author_avatar
//     FROM comments c JOIN users u ON c.author_id = u.id
//     WHERE c.task_id = $1 ORDER BY c.created_at ASC
//   `, [taskId])
//   return {
//     id: t.id, title: t.title, description: t.description,
//     status: t.status, priority: t.priority, type: t.type,
//     dueDate: t.due_date, estimatedHours: t.estimated_hours,
//     actualHours: t.actual_hours, tags: t.tags || [],
//     createdAt: t.created_at, updatedAt: t.updated_at,
//     project: { id: t.project_id, name: t.project_name },
//     assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name, email: t.assignee_email, avatar: t.assignee_avatar } : null,
//     reporter: t.reporter_id ? { id: t.reporter_id, name: t.reporter_name } : null,
//     comments: comments.rows.map(c => ({
//       id: c.id, content: c.content, createdAt: c.created_at,
//       author: { id: c.author_id, name: c.author_name, avatar: c.author_avatar }
//     }))
//   }
// }

// exports.getAllTasks = async (req, res) => {
//   try {
//     const { status, priority, type, assigneeId, projectId, search, page = 1, limit = 10 } = req.query
//     let where = 'WHERE 1=1'
//     const params = []
//     if (status) { params.push(status); where += ` AND t.status = $${params.length}` }
//     if (priority) { params.push(priority); where += ` AND t.priority = $${params.length}` }
//     if (type) { params.push(type); where += ` AND t.type = $${params.length}` }
//     if (assigneeId) { params.push(assigneeId); where += ` AND t.assignee_id = $${params.length}` }
//     if (projectId) { params.push(projectId); where += ` AND t.project_id = $${params.length}` }
//     if (search) { params.push(`%${search}%`); where += ` AND t.title ILIKE $${params.length}` }
//     const countResult = await pool.query(`SELECT COUNT(*) FROM tasks t ${where}`, params)
//     const total = parseInt(countResult.rows[0].count)
//     params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit))
//     const ids = await pool.query(
//       `SELECT t.id FROM tasks t ${where} ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
//       params
//     )
//     const tasks = await Promise.all(ids.rows.map(r => getTaskWithDetails(r.id)))
//     return paginatedResponse(res, tasks, total, page, limit)
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.getTaskById = async (req, res) => {
//   try {
//     const task = await getTaskWithDetails(req.params.id)
//     if (!task) return errorResponse(res, 'Task not found.', 404)
//     return successResponse(res, task)
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.getTasksByProject = async (req, res) => {
//   try {
//     const result = await pool.query('SELECT id FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id])
//     const tasks = await Promise.all(result.rows.map(r => getTaskWithDetails(r.id)))
//     return successResponse(res, tasks)
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.createTask = async (req, res) => {
//   try {
//     const { title, description, status, priority, type, projectId, assigneeId, dueDate, estimatedHours, tags } = req.body
//     if (!title) return errorResponse(res, 'Task title is required.')
//     if (!projectId) return errorResponse(res, 'Project is required.')
//     const result = await pool.query(
//             `INSERT INTO tasks (
//         title,
//         description,
//         status,
//         priority,
//         type,
//         project_id,
//         assignee_id,
//         reporter_id,
//         due_date,
//         estimated_hours,
//         tags,
//         completed_at
//       )
//       VALUES (
//         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
//         CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END
//       )
//       RETURNING id`,
//       // 'INSERT INTO tasks (title,description,status,priority,type,project_id,assignee_id,reporter_id,due_date,estimated_hours,tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
//       [title, description, status||'todo', priority||'medium', type||'feature', projectId, assigneeId||null, req.user.id, dueDate||null, estimatedHours||null, tags||[]]
//     )
//     // Create notification for assignee
//     if (assigneeId && assigneeId !== req.user.id) {
//       await pool.query(
//         'INSERT INTO notifications (type,title,message,user_id,link_to) VALUES ($1,$2,$3,$4,$5)',
//         ['task_assigned', 'New Task Assigned', `You have been assigned: ${title}`, assigneeId, `/tasks`]
//       )
//     }
//     const task = await getTaskWithDetails(result.rows[0].id)
//     return successResponse(res, task, 'Task created successfully.', 201)
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.updateTask = async (req, res) => {
//   try {
//     const { title, description, status, priority, type, assigneeId, dueDate, estimatedHours, actualHours, tags } = req.body
//     const result = await pool.query(
//       `UPDATE tasks SET
//         title=COALESCE($1,title), description=COALESCE($2,description),
//         status=COALESCE($3,status),
//         completed_at = CASE
//   WHEN COALESCE($3,status) = 'completed'
//   THEN COALESCE(completed_at, NOW())
//   ELSE NULL
// END,
//         priority=COALESCE($4,priority),
//         type=COALESCE($5,type), assignee_id=COALESCE($6,assignee_id),
//         due_date=COALESCE($7,due_date), estimated_hours=COALESCE($8,estimated_hours),
//         actual_hours=COALESCE($9,actual_hours), tags=COALESCE($10,tags),
//         updated_at=NOW() WHERE id=$11 RETURNING id`,
//       [title, description, status, priority, type, assigneeId, dueDate, estimatedHours, actualHours, tags, req.params.id]
//     )
//     if (!result.rows[0]) return errorResponse(res, 'Task not found.', 404)
//     const task = await getTaskWithDetails(req.params.id)
//     return successResponse(res, task, 'Task updated.')
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.updateTaskStatus = async (req, res) => {
//   try {
//     const { status } = req.body
//     const valid = ['todo','in_progress','in_review','completed']
//     if (!valid.includes(status)) return errorResponse(res, 'Invalid status.')
//     // const result = await pool.query(
//     //   'UPDATE tasks SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id',
//     //   [status, req.params.id]
//     // )
//     const result = await pool.query(
//   `UPDATE tasks
//    SET
//      status = $1,
//      completed_at = CASE
//        WHEN $1 = 'completed' THEN NOW()
//        ELSE NULL
//      END,
//      updated_at = NOW()
//    WHERE id = $2
//    RETURNING id`,
//   [status, req.params.id]
// )
//     if (!result.rows[0]) return errorResponse(res, 'Task not found.', 404)
//     const task = await getTaskWithDetails(req.params.id)
//     return successResponse(res, task, 'Status updated.')
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.deleteTask = async (req, res) => {
//   try {
//     const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [req.params.id])
//     if (!result.rows[0]) return errorResponse(res, 'Task not found.', 404)
//     return successResponse(res, null, 'Task deleted.')
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.addComment = async (req, res) => {
//   try {
//     const { content } = req.body
//     if (!content) return errorResponse(res, 'Comment content is required.')
//     await pool.query('INSERT INTO comments (content,task_id,author_id) VALUES ($1,$2,$3)', [content, req.params.id, req.user.id])
//     const task = await getTaskWithDetails(req.params.id)
//     return successResponse(res, task, 'Comment added.')
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

// exports.deleteComment = async (req, res) => {
//   try {
//     await pool.query('DELETE FROM comments WHERE id=$1 AND author_id=$2', [req.params.commentId, req.user.id])
//     return successResponse(res, null, 'Comment deleted.')
//   } catch (err) { return errorResponse(res, err.message, 500) }
// }

const pool = require('../config/db')
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response')

const getTaskWithDetails = async (taskId) => {
  const result = await pool.query(`
    SELECT t.*,
      a.id AS assignee_id, a.name AS assignee_name, a.email AS assignee_email, a.avatar AS assignee_avatar,
      r.id AS reporter_id, r.name AS reporter_name,
      p.id AS project_id, p.name AS project_name
    FROM tasks t
    LEFT JOIN users a ON t.assignee_id = a.id
    LEFT JOIN users r ON t.reporter_id = r.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = $1
  `, [taskId])
  if (!result.rows[0]) return null
  const t = result.rows[0]
  const comments = await pool.query(`
    SELECT c.*, u.name AS author_name, u.avatar AS author_avatar
    FROM comments c JOIN users u ON c.author_id = u.id
    WHERE c.task_id = $1 ORDER BY c.created_at ASC
  `, [taskId])
  return {
    id: t.id, title: t.title, description: t.description,
    status: t.status, priority: t.priority, type: t.type,
    dueDate: t.due_date, estimatedHours: t.estimated_hours,
    actualHours: t.actual_hours, tags: t.tags || [],
    createdAt: t.created_at, updatedAt: t.updated_at,
    completedAt: t.completed_at,
    project: { id: t.project_id, name: t.project_name },
    assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name, email: t.assignee_email, avatar: t.assignee_avatar } : null,
    reporter: t.reporter_id ? { id: t.reporter_id, name: t.reporter_name } : null,
    comments: comments.rows.map(c => ({
      id: c.id, content: c.content, createdAt: c.created_at,
      author: { id: c.author_id, name: c.author_name, avatar: c.author_avatar }
    }))
  }
}

exports.getAllTasks = async (req, res) => {
  try {
    const { status, priority, type, assigneeId, projectId, search, page = 1, limit = 10 } = req.query
    let where = 'WHERE 1=1'
    const params = []
    if (status) { params.push(status); where += ` AND t.status = $${params.length}` }
    if (priority) { params.push(priority); where += ` AND t.priority = $${params.length}` }
    if (type) { params.push(type); where += ` AND t.type = $${params.length}` }
    if (assigneeId) { params.push(assigneeId); where += ` AND t.assignee_id = $${params.length}` }
    if (projectId) { params.push(projectId); where += ` AND t.project_id = $${params.length}` }
    if (search) { params.push(`%${search}%`); where += ` AND t.title ILIKE $${params.length}` }
    const countResult = await pool.query(`SELECT COUNT(*) FROM tasks t ${where}`, params)
    const total = parseInt(countResult.rows[0].count)
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit))
    const ids = await pool.query(
      `SELECT t.id FROM tasks t ${where} ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const tasks = await Promise.all(ids.rows.map(r => getTaskWithDetails(r.id)))
    return paginatedResponse(res, tasks, total, page, limit)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.getTaskById = async (req, res) => {
  try {
    const task = await getTaskWithDetails(req.params.id)
    if (!task) return errorResponse(res, 'Task not found.', 404)
    return successResponse(res, task)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.getTasksByProject = async (req, res) => {
  try {
    const result = await pool.query('SELECT id FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id])
    const tasks = await Promise.all(result.rows.map(r => getTaskWithDetails(r.id)))
    return successResponse(res, tasks)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.createTask = async (req, res) => {
  try {
    const { title, description, status, priority, type, projectId, assigneeId, dueDate, estimatedHours, tags } = req.body
    if (!title) return errorResponse(res, 'Task title is required.')
    if (!projectId) return errorResponse(res, 'Project is required.')

    const finalStatus = status || 'todo'
    // Compute completed_at in JS and bind it as its own parameter ($12).
    // This keeps $3 (status) used in a single context, avoiding the
    // "inconsistent types deduced for parameter $3" enum inference error.
    const completedAt = finalStatus === 'completed' ? new Date() : null

    const result = await pool.query(
      `INSERT INTO tasks (
        title,
        description,
        status,
        priority,
        type,
        project_id,
        assignee_id,
        reporter_id,
        due_date,
        estimated_hours,
        tags,
        completed_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      RETURNING id`,
      [
        title,
        description,
        finalStatus,
        priority || 'medium',
        type || 'feature',
        projectId,
        assigneeId || null,
        req.user.id,
        dueDate || null,
        estimatedHours || null,
        tags || [],
        completedAt,
      ]
    )
    // Create notification for assignee
    if (assigneeId && assigneeId !== req.user.id) {
      await pool.query(
        'INSERT INTO notifications (type,title,message,user_id,link_to) VALUES ($1,$2,$3,$4,$5)',
        ['task_assigned', 'New Task Assigned', `You have been assigned: ${title}`, assigneeId, `/tasks`]
      )
    }
    const task = await getTaskWithDetails(result.rows[0].id)
    return successResponse(res, task, 'Task created successfully.', 201)
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.updateTask = async (req, res) => {
  try {
    const { title, description, status, priority, type, assigneeId, dueDate, estimatedHours, actualHours, tags } = req.body
    const result = await pool.query(
      `UPDATE tasks SET
        title=COALESCE($1,title), description=COALESCE($2,description),
        status=COALESCE($3,status),
        completed_at = CASE
          WHEN COALESCE($3::text, status::text) = 'completed'
          THEN COALESCE(completed_at, NOW())
          ELSE NULL
        END,
        priority=COALESCE($4,priority),
        type=COALESCE($5,type), assignee_id=COALESCE($6,assignee_id),
        due_date=COALESCE($7,due_date), estimated_hours=COALESCE($8,estimated_hours),
        actual_hours=COALESCE($9,actual_hours), tags=COALESCE($10,tags),
        updated_at=NOW() WHERE id=$11 RETURNING id`,
      [title, description, status, priority, type, assigneeId, dueDate, estimatedHours, actualHours, tags, req.params.id]
    )
    if (!result.rows[0]) return errorResponse(res, 'Task not found.', 404)
    const task = await getTaskWithDetails(req.params.id)
    return successResponse(res, task, 'Task updated.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body
    const valid = ['todo','in_progress','in_review','completed']
    if (!valid.includes(status)) return errorResponse(res, 'Invalid status.')

    // Compute completed_at in JS so $1 (status) is used in one context only.
    const completedAt = status === 'completed' ? new Date() : null

    const result = await pool.query(
      `UPDATE tasks
       SET
         status = $1,
         completed_at = $2,
         updated_at = NOW()
       WHERE id = $3
       RETURNING id`,
      [status, completedAt, req.params.id]
    )
    if (!result.rows[0]) return errorResponse(res, 'Task not found.', 404)
    const task = await getTaskWithDetails(req.params.id)
    return successResponse(res, task, 'Status updated.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.deleteTask = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [req.params.id])
    if (!result.rows[0]) return errorResponse(res, 'Task not found.', 404)
    return successResponse(res, null, 'Task deleted.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.addComment = async (req, res) => {
  try {
    const { content } = req.body
    if (!content) return errorResponse(res, 'Comment content is required.')
    await pool.query('INSERT INTO comments (content,task_id,author_id) VALUES ($1,$2,$3)', [content, req.params.id, req.user.id])
    const task = await getTaskWithDetails(req.params.id)
    return successResponse(res, task, 'Comment added.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}

exports.deleteComment = async (req, res) => {
  try {
    await pool.query('DELETE FROM comments WHERE id=$1 AND author_id=$2', [req.params.commentId, req.user.id])
    return successResponse(res, null, 'Comment deleted.')
  } catch (err) { return errorResponse(res, err.message, 500) }
}