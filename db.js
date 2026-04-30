import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;

try { mkdirSync(dir, { recursive: true }); } catch {}

const file = join(dir, 'data.json');

const defaultData = {
  users: [],
  projects: [],
  projectMembers: [],
  tasks: [],
  comments: []
};

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

await db.read();
db.data = { ...defaultData, ...db.data };
await db.write();

export default db;