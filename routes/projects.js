import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticate, requireAdmin, requireProjectAccess, requireProjectAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/projects - List projects for current user
router.get('/', authenticate, async (req, res) => {
  await db.read();
  let projects;
  if (req.user.role === 'admin') {
    projects = db.data.projects;
  } else {
    const memberProjectIds = db.data.projectMembers
      .filter(m => m.userId === req.user.id)
      .map(m => m.projectId);
    projects = db.data.projects.filter(p => memberProjectIds.includes(p.id));
  }

  const enriched = projects.map(p => {
    const members = db.data.projectMembers.filter(m => m.projectId === p.id);
    const tasks = db.data.tasks.filter(t => t.projectId === p.id);
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    return {
      ...p,
      memberCount: members.length,
      taskCount: tasks.length,
      completedTasks,
      progress: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0
    };
  });

  res.json(enriched);
});

// POST /api/projects - Create project (admin only)
router.post('/', authenticate, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Project name required'),
  body('description').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  await db.read();
  const { name, description, color } = req.body;
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

  const project = {
    id: uuidv4(),
    name,
    description: description || '',
    color: color || colors[Math.floor(Math.random() * colors.length)],
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  db.data.projects.push(project);

  // Auto-add creator as project admin
  db.data.projectMembers.push({
    id: uuidv4(),
    projectId: project.id,
    userId: req.user.id,
    role: 'admin',
    joinedAt: new Date().toISOString()
  });

  await db.write();
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', authenticate, requireProjectAccess, async (req, res) => {
  await db.read();
  const members = db.data.projectMembers
    .filter(m => m.projectId === req.project.id)
    .map(m => {
      const user = db.data.users.find(u => u.id === m.userId);
      return user ? { ...m, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role } } : m;
    });

  const tasks = db.data.tasks.filter(t => t.projectId === req.project.id);
  res.json({ ...req.project, members, tasks });
});

// PUT /api/projects/:id
router.put('/:id', authenticate, requireProjectAccess, requireProjectAdmin, [
  body('name').optional().trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  await db.read();
  const idx = db.data.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });

  const { name, description, color, status } = req.body;
  if (name) db.data.projects[idx].name = name;
  if (description !== undefined) db.data.projects[idx].description = description;
  if (color) db.data.projects[idx].color = color;
  if (status) db.data.projects[idx].status = status;
  db.data.projects[idx].updatedAt = new Date().toISOString();

  await db.write();
  res.json(db.data.projects[idx]);
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await db.read();
  const idx = db.data.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });

  db.data.projects.splice(idx, 1);
  db.data.projectMembers = db.data.projectMembers.filter(m => m.projectId !== req.params.id);
  db.data.tasks = db.data.tasks.filter(t => t.projectId !== req.params.id);
  await db.write();
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members - Add member
router.post('/:id/members', authenticate, requireProjectAccess, requireProjectAdmin, [
  body('userId').notEmpty(),
  body('role').isIn(['admin', 'member']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  await db.read();
  const { userId, role } = req.body;
  const user = db.data.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.data.projectMembers.find(m => m.projectId === req.params.id && m.userId === userId);
  if (existing) return res.status(409).json({ error: 'User already a member' });

  const member = {
    id: uuidv4(),
    projectId: req.params.id,
    userId,
    role: role || 'member',
    joinedAt: new Date().toISOString()
  };
  db.data.projectMembers.push(member);
  await db.write();
  res.status(201).json({ ...member, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, requireProjectAccess, requireProjectAdmin, async (req, res) => {
  await db.read();
  const idx = db.data.projectMembers.findIndex(m => m.projectId === req.params.id && m.userId === req.params.userId);
  if (idx === -1) return res.status(404).json({ error: 'Member not found' });
  db.data.projectMembers.splice(idx, 1);
  await db.write();
  res.json({ message: 'Member removed' });
});

export default router;
