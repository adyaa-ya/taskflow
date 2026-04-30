import jwt from 'jsonwebtoken';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow_secret_key_2024';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.data.users.find(u => u.id === decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireProjectAccess = (req, res, next) => {
  const projectId = req.params.projectId || req.params.id;
  const project = db.data.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Global admins always have access
  if (req.user.role === 'admin') {
    req.project = project;
    return next();
  }

  // Check if user is a member of this project
  const membership = db.data.projectMembers.find(
    m => m.projectId === projectId && m.userId === req.user.id
  );
  if (!membership) return res.status(403).json({ error: 'Access denied to this project' });

  req.project = project;
  req.projectRole = membership.role;
  next();
};

export const requireProjectAdmin = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.projectRole !== 'admin') {
    return res.status(403).json({ error: 'Project admin access required' });
  }
  next();
};

export { JWT_SECRET };
