# DocuTrack

DocuTrack is a college document and file management system. People sign in, upload files, keep later uploads of the same name as new versions, share a file with view, edit, or download permission, and review their own activity.

The browser pages are static HTML, CSS, and JavaScript. The API is Node.js and Express. PostgreSQL stores accounts and file records. Uploaded bytes are stored on the server disk.

This repository does not include `node_modules`, the real `.env` file, the database data, or the uploaded documents. Those stay on the machine that runs the app.

## Features

- Login with email and password. Passwords are stored as bcrypt hashes. The API returns a JWT that expires after one hour.
- Upload a file up to 50 MB. The server records a SHA-256 hash, chooses a category from the extension, and checks the department storage quota.
- Uploading the same file name again as the same owner creates the next version.
- List your files, download them, soft-delete them, and restore them.
- Share a file with another user id as view, edit, or download. A shared download is allowed only for download or edit.
- Transfer ownership, and add or remove tags.
- Activity log and anomaly alerts for the signed-in user.
- A retention check can flag a file, create a notification, or soft-delete it when that file's stored policy has expired.
- Privacy Policy and Terms pages.

## Technology stack

| Part | Used here |
| --- | --- |
| Frontend | HTML, CSS, JavaScript. No frontend framework. |
| Backend | Node.js 24.15.0 and Express 5.2.1 |
| Database | PostgreSQL 18.6, database name `docutrack` |
| Auth | jsonwebtoken 9.0.3 and bcryptjs 3.0.3 |
| Uploads | Multer 2.3.0, stored in `backend/uploads/` |
| Other packages | cors 2.8.6, dotenv 17.4.2, pg 8.23.0 |

Versions above are the versions installed from `backend/package-lock.json` on 6 November 2026.

## Architecture

```text
Browser (frontend/, port 8091)
  -> HTTP API (backend/server.js, port 5001)
       -> PostgreSQL (localhost:5432, database docutrack)
       -> backend/uploads/ for file bytes
```

`frontend/config.js` sets the API address. `frontend/app.js` uses that address for every API call.

## Database setup

PostgreSQL must already be running locally.

```bash
createdb docutrack
psql -d docutrack -f database/schema.sql
```

`database/schema.sql` creates tables, views, functions, and triggers. It does not contain user accounts or uploaded-file rows. A full data backup is kept outside this repository. See `DATABASE_BACKUP_AND_RESTORE.md`.

## Installation

From the project root:

```bash
cd /Users/shubhampingale/docutrack/backend
npm install
cp .env.example .env
```

Edit `backend/.env` on your machine. Do not commit it.

Required variables:

| Variable | Purpose |
| --- | --- |
| `DB_USER` | PostgreSQL user |
| `DB_HOST` | Database host, usually `localhost` |
| `DB_NAME` | Database name, `docutrack` |
| `DB_PORT` | Database port, usually `5432` |
| `JWT_SECRET` | Long random string used to sign tokens |

`DB_PASSWORD` is optional. The current pool uses it only when it is set. The local database used for this project accepts the local user without a password.

`BACKEND_PORT` is optional. The default API port is `5001`.

## Local startup

From the project root:

```bash
cd /Users/shubhampingale/docutrack
./docutrack.sh start
./docutrack.sh status
./docutrack.sh logs
./docutrack.sh stop
./docutrack.sh restart
```

`stop` and `restart` affect only processes this script started. If a port is already used by something else, the script reports that process and does not stop it.

Default addresses:

- Login page: http://127.0.0.1:8091/login.html
- API: http://127.0.0.1:5001/

To use other ports without editing application code:

```bash
FRONTEND_PORT=8091 BACKEND_PORT=5001 ./docutrack.sh start
```

You can also start the processes separately:

```bash
cd /Users/shubhampingale/docutrack/backend
node server.js
```

```bash
cd /Users/shubhampingale/docutrack/frontend
python3 -m http.server 8091
```

If you change `BACKEND_PORT`, run `./docutrack.sh start` so it rewrites `frontend/config.js`, or edit `frontend/config.js` yourself. The pages load `config.js` before `app.js`.

## API overview

All file routes require `Authorization: Bearer <token>` except login.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Email and password login |
| GET | `/` | API running check |
| POST | `/api/files/upload` | Upload. Form field name is `file` |
| GET | `/api/files` | Files owned by the caller |
| GET | `/api/files/shared-with-me` | Files shared with the caller |
| GET | `/api/files/:id/download` | Download an owned file |
| GET | `/api/files/:id/shared-download` | Download a shared file when permission allows it |
| POST | `/api/files/:id/share` | Share. Body: `shared_with`, `permission_type` |
| DELETE | `/api/files/:id` | Soft-delete |
| POST | `/api/files/:id/restore` | Restore |
| POST | `/api/files/:id/transfer-ownership` | Transfer. Body: `to_user_id`, `reason` |
| GET, POST, DELETE | `/api/files/:id/tags` | List, add, or remove tags |
| GET, POST | `/api/tags` | List or create tags |
| GET | `/api/files/activity-logs` | Activity for the caller |
| GET | `/api/files/anomaly-alerts` | Alerts for the caller |
| POST | `/api/files/retention/check` | Apply stored retention actions to expired files |

There is no registration route. Accounts must already exist in the database.

## Screenshots

No screenshots are stored in this repository. Add them here after you capture the login page, dashboard, and file list from a local run.

## Known limitations

- `npm test` is not a real test suite. It prints an error and exits 1.
- The server does not read the `role_permissions` table. Hiding the retention button for non-admins is done in the browser only. Any valid token can call the retention route.
- Search filters files already loaded in the browser. It is not a database search.
- The file pages show the current version, not the full version changelog.
- One stored file has no `current_version_id`.
- CORS is enabled with no origin allow-list.
- The JWT is stored in browser `localStorage`.
- Activity and alerts returned by the API are limited to the signed-in user.
- Uploaded documents and the data dump are not in Git. Restore them from the local backup.

## Team

The group sheet for this college project lists Pratik Pingale, Piyush Rajput, Aryan shah, Sara Patil, and Priyansi mukharejee. Those spellings are the ones written on the sheet and were not separately confirmed as legal names.

## More setup notes

- `LOCAL_SETUP.md`
- `DATABASE_BACKUP_AND_RESTORE.md`
- `FINAL_HANDOVER_REPORT.md`
- `LOCAL_TEST_REPORT.md`
- `CLOUD_DEPENDENCY_CHECKLIST.md`
- `MODEL_TRAINING_PREPARATION.md`
