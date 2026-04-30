# TaskFlow — Project Management App

A full-stack project management web app with role-based access control, task tracking, and team collaboration features.

## 🚀 Live Demo

> Deploy to Railway and add your URL here

---

## ✨ Features

### Authentication
- Signup / Login with JWT tokens (7-day expiry)
- Passwords hashed with bcrypt
- First user auto-assigned Admin role

### Role-Based Access Control (RBAC)
| Action | Admin (Global) | Project Admin | Member |
|---|---|---|---|
| Create projects | ✅ | ❌ | ❌ |
| Delete projects | ✅ | ❌ | ❌ |
| Add/remove project members | ✅ | ✅ | ❌ |
| Create/edit/delete tasks | ✅ | ✅ | Own tasks only |
| View project & tasks | ✅ | ✅ | ✅ (if member) |
| View all users | ✅ | ✅ | ✅ |

### Projects
- Create, edit, and delete projects (Admin only)
- Custom project colors
- Progress tracking (completed/total tasks)
- Per-project member management with roles (Admin/Member)

### Task Management
- Create tasks with title, description, status, priority, assignee, due date, and tags
- Kanban board view (To Do → In Progress → Review → Done)
- List view with inline filtering
- Priority levels: Low, Medium, High, Urgent
- Overdue task detection

### Dashboard
- Overview stats: total projects, my tasks, completed, overdue
- Task status distribution chart
- Recent tasks feed

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | JSON file (lowdb) — swap to PostgreSQL for production |
| Auth | JWT + bcryptjs |
| Validation | express-validator |
| Frontend | Vanilla JS SPA (no build step) |
| Fonts | Syne + DM Sans (Google Fonts) |

---

## 📡 REST API Reference

### Auth
```
POST /api/auth/signup      — Register new user
POST /api/auth/login       — Login, returns JWT token
GET  /api/auth/me          — Get current user profile
GET  /api/auth/users       — List all users
```

### Projects
```
GET    /api/projects                      — List accessible projects
POST   /api/projects                      — Create project (Admin)
GET    /api/projects/:id                  — Get project details + members + tasks
PUT    /api/projects/:id                  — Update project
DELETE /api/projects/:id                  — Delete project (Admin)
POST   /api/projects/:id/members          — Add member to project
DELETE /api/projects/:id/members/:userId  — Remove member
```

### Tasks
```
GET    /api/projects/:projectId/tasks           — List tasks
POST   /api/projects/:projectId/tasks           — Create task
PUT    /api/projects/:projectId/tasks/:taskId   — Update task
DELETE /api/projects/:projectId/tasks/:taskId   — Delete task
GET    /api/tasks/dashboard/overview            — Dashboard stats
```

---

## 🏃 Running Locally

```bash
# Clone and install
git clone <your-repo-url>
cd taskflow
npm install

# Configure environment
cp .env.example .env
# Edit .env with your JWT secret

# Start server
npm start
# → App running at http://localhost:3000
```

---

## 🚢 Deploy to Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variable: `JWT_SECRET=your_secure_random_string`
5. Railway auto-detects Node.js and deploys

> **Note:** The app uses a JSON file database (`data.json`). For production, swap `lowdb` for a PostgreSQL plugin on Railway — update `db.js` to use `pg` with a connection string from `DATABASE_URL`.

---

## 🗂 Project Structure

```
taskflow/
├── server.js           # Express app entry point
├── db.js               # Database (lowdb JSON)
├── middleware/
│   └── auth.js         # JWT auth + RBAC middleware
├── routes/
│   ├── auth.js         # Auth endpoints
│   ├── projects.js     # Project + member endpoints
│   └── tasks.js        # Task endpoints + dashboard
├── public/
│   └── index.html      # Full frontend SPA
├── railway.toml        # Railway deployment config
├── .env.example        # Environment variable template
└── package.json
```

---

## 🔐 Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire in 7 days
- All routes protected by authentication middleware
- RBAC enforced at both project and global level
- Input validation on all POST/PUT endpoints

---

## 📝 Test Accounts (after first deploy)

Create accounts via the signup page. The **first user to sign up** is automatically granted Admin role.

**Quick test flow:**
1. Sign up as Admin (first account)
2. Create a project
3. Sign up as a Member (second account)  
4. As Admin: add the member to the project
5. Log in as Member: verify limited access

---

## 📹 Demo Video

> Add link to your 2-5 minute demo video here
