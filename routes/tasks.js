import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticate, requireProjectAccess, requireProjectAdmin } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/tasks
router.get('/', authenticate, requireProjectAccess, async (req, res) => {
  await db.read();
  const tasks = db.data.tasks
    .filter(t => t.projectId === req.params.projectId)
    .map(t => {
      const assignee = t.assigneeId ? db.data.users.find(u => u.id === t.assigneeId) : null;
      const creator = db.data.users.find(u => u.id === t.createdBy);
      return {
        ...t,
        assignee: assignee ? { id: assignee.id, name: assignee.name, avatar: assignee.avatar } : null,
        creator: creator ? { id: creator.id, name: creator.name } : null
      };
    });
  res.json(tasks);
});

// POST /api/projects/:projectId/tasks
router.post('/', authenticate, requireProjectAccess, [
  body('title').trim().notEmpty().withMessage('Task title required'),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  await db.read();
  const { title, description, status, priority, assigneeId, dueDate, tags } = req.body;

  // Validate assignee is a project member
  if (assigneeId) {
    const isMember = db.data.projectMembers.find(m => m.projectId === req.params.projectId && m.userId === assigneeId);
    if (!isMember && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'Assignee must be a project member' });
    }
  }

  const task = {
    id: uuidv4(),
    projectId: req.params.projectId,
    title,
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medium',
    assigneeId: assigneeId || null,
    dueDate: dueDate || null,
    tags: tags || [],
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.data.tasks.push(task);
  await db.write();

  const assignee = task.assigneeId ? db.data.users.find(u => u.id === task.assigneeId) : null;
  res.status(201).json({
    ...task,
    assignee: assignee ? { id: assignee.id, name: assignee.name, avatar: assignee.avatar } : null
  });
});

// PUT /api/projects/:projectId/tasks/:taskId
router.put('/:taskId', authenticate, requireProjectAccess, async (req, res) => {
  await db.read();
  const idx = db.data.tasks.findIndex(t => t.id === req.params.taskId && t.projectId === req.params.projectId);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const task = db.data.tasks[idx];
  // Members can only update tasks assigned to them or created by them (unless project admin)
  const isProjectAdmin = req.user.role === 'admin' || req.projectRole === 'admin';
  if (!isProjectAdmin && task.createdBy !== req.user.id && task.assigneeId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to edit this task' });
  }

  const { title, description, status, priority, assigneeId, dueDate, tags } = req.body;
  if (title) db.data.tasks[idx].title = title;
  if (description !== undefined) db.data.tasks[idx].description = description;
  if (status) db.data.tasks[idx].status = status;
  if (priority) db.data.tasks[idx].priority = priority;
  if (assigneeId !== undefined) db.data.tasks[idx].assigneeId = assigneeId;
  if (dueDate !== undefined) db.data.tasks[idx].dueDate = dueDate;
  if (tags) db.data.tasks[idx].tags = tags;
  db.data.tasks[idx].updatedAt = new Date().toISOString();

  await db.write();
  const updated = db.data.tasks[idx];
  const assignee = updated.assigneeId ? db.data.users.find(u => u.id === updated.assigneeId) : null;
  res.json({ ...updated, assignee: assignee ? { id: assignee.id, name: assignee.name, avatar: assignee.avatar } : null });
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', authenticate, requireProjectAccess, async (req, res) => {
  await db.read();
  const idx = db.data.tasks.findIndex(t => t.id === req.params.taskId && t.projectId === req.params.projectId);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const task = db.data.tasks[idx];
  const isProjectAdmin = req.user.role === 'admin' || req.projectRole === 'admin';
  if (!isProjectAdmin && task.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this task' });
  }

  db.data.tasks.splice(idx, 1);
  await db.write();
  res.json({ message: 'Task deleted' });
});

// GET /api/tasks/dashboard - overview for current user
router.get('/dashboard/overview', authenticate, async (req, res) => {
  await db.read();
  const userId = req.user.id;

  let accessibleProjectIds;
  if (req.user.role === 'admin') {
    accessibleProjectIds = db.data.projects.map(p => p.id);
  } else {
    accessibleProjectIds = db.data.projectMembers.filter(m => m.userId === userId).map(m => m.projectId);
  }

  const allTasks = db.data.tasks.filter(t => accessibleProjectIds.includes(t.projectId));
  const myTasks = allTasks.filter(t => t.assigneeId === userId);
  const now = new Date();

  const overdue = myTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done');
  const dueToday = myTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due.toDateString() === now.toDateString() && t.status !== 'done';
  });

  res.json({
    totalProjects: accessibleProjectIds.length,
    totalTasks: allTasks.length,
    myTasks: myTasks.length,
    completedTasks: myTasks.filter(t => t.status === 'done').length,
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    tasksByStatus: {
      todo: allTasks.filter(t => t.status === 'todo').length,
      in_progress: allTasks.filter(t => t.status === 'in_progress').length,
      review: allTasks.filter(t => t.status === 'review').length,
      done: allTasks.filter(t => t.status === 'done').length,
    },
    recentTasks: myTasks
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5)
      .map(t => {
        const project = db.data.projects.find(p => p.id === t.projectId);
        return { ...t, projectName: project?.name };
      })
  });
});

export default router;
