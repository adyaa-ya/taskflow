import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import { authenticate, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role } = req.body;
  await db.read();

  if (db.data.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const isFirstUser = db.data.users.length === 0;

  const user = {
    id: uuidv4(),
    name,
    email,
    password: hashedPassword,
    role: isFirstUser ? 'admin' : (role === 'admin' ? 'admin' : 'member'),
    createdAt: new Date().toISOString(),
    avatar: name.charAt(0).toUpperCase()
  };

  db.data.users.push(user);
  await db.write();

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userWithoutPassword } = user;
  res.status(201).json({ token, user: userWithoutPassword });
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  await db.read();

  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userWithoutPassword } = user;
  res.json({ token, user: userWithoutPassword });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const { password: _, ...user } = req.user;
  res.json(user);
});

// GET /api/auth/users (admin only - list all users for assignment)
router.get('/users', authenticate, async (req, res) => {
  await db.read();
  const users = db.data.users.map(({ password: _, ...u }) => u);
  res.json(users);
});

export default router;
