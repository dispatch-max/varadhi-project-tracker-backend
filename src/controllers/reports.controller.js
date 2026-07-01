const pool = require('../config/db')
const { successResponse, errorResponse } = require('../utils/response')

/**
 * GET /reports/task-status
 * Returns one row per status with its count, in the shape the pie chart needs:
 *   [{ name: 'Completed', value: 38, color: '#22c55e' }, ...]
 * Statuses with zero tasks are still returned (value: 0) so the legend is stable.
 */
exports.getTaskStatus = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM tasks
       GROUP BY status`
    )

    // Map DB status -> display label + chart color. Source of truth lives here
    // so the frontend chart stays a dumb renderer.
    const STATUS_META = {
      completed:   { name: 'Completed',   color: '#22c55e' },
      in_progress: { name: 'In Progress', color: '#f59e0b' },
      in_review:   { name: 'In Review',   color: '#3b82f6' },
      todo:        { name: 'To Do',       color: '#94a3b8' },
    }

    const counts = Object.fromEntries(
      result.rows.map((r) => [r.status, r.count])
    )

    const data = Object.entries(STATUS_META).map(([status, meta]) => ({
      name: meta.name,
      value: counts[status] || 0,
      color: meta.color,
    }))

    return successResponse(res, data)
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}

/**
 * GET /reports/member-workload
 * Per-member task breakdown, in the bar-chart shape:
 *   [{ name: 'Jagdish D', completed: 12, inProgress: 4, todo: 1 }, ...]
 *
 * NOTE: grouped by tasks.assignee_id (who does the work). If your column is
 * named differently, change `t.assignee_id` in the JOIN below.
 * Members with no assigned tasks are still included (all zeros).
 */
exports.getMemberWorkload = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         COUNT(CASE WHEN t.status = 'completed'   THEN 1 END)::int AS completed,
         COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END)::int AS in_progress,
         COUNT(CASE WHEN t.status IN ('todo', 'in_review') THEN 1 END)::int AS todo
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id
       WHERE u.status = 'active'
       GROUP BY u.id, u.name
       ORDER BY u.name ASC`
    )

    const data = result.rows.map((r) => ({
      name: r.name,
      completed: r.completed,
      inProgress: r.in_progress, // camelCase to match the chart's dataKey
      todo: r.todo,
    }))

    return successResponse(res, data)
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}

/**
 * GET /reports/project-completion
 * Per-project completed vs total task counts:
 *   [{ name: 'Tracker Frontend', completed: 12, total: 20 }, ...]
 * The frontend keeps using calcProgress(completed, total), so we return raw
 * counts rather than a precomputed percentage.
 * Archived projects are excluded; projects with no tasks are still returned.
 */
exports.getProjectCompletion = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.id,
         p.name,
         COUNT(t.id)::int AS total,
         COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::int AS completed
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.status != 'archived'
       GROUP BY p.id, p.name
       ORDER BY p.name ASC`
    )

    const data = result.rows.map((r) => ({
      name: r.name,
      completed: r.completed,
      total: r.total,
    }))

    return successResponse(res, data)
  } catch (err) {
    return errorResponse(res, err.message, 500)
  }
}