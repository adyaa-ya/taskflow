import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, 'data.json');

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

// Ensure all collections exist
db.data = { ...defaultData, ...db.data };
await db.write();

export default db;
