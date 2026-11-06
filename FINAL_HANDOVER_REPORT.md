# DocuTrack final handover report

Date: 6 November 2026.

This report describes the project that is on this Mac. It does not claim that every feature was retested today. See `LOCAL_TEST_REPORT.md` for the checks that were actually run.

## Project structure

```text
/Users/shubhampingale/docutrack
  frontend/          HTML, CSS, JavaScript, favicon, config.js
  backend/
    server.js
    package.json
    package-lock.json
    .env             local only, not for Git
    .env.example
    config/db.js
    routes/          auth, files, tags, test
    controllers/     login, files, share, download, tags, activity, alerts, retention, ownership
    middleware/      JWT check and Multer upload
    uploads/         file bytes, not for Git
  database/schema.sql
  docutrack.sh
  README.md and the other handover documents
```

There is no separate database model layer and there was no SQL file in the project before this handover. `database/schema.sql` was exported from the live local database.

## Technology stack

- Frontend: HTML, CSS, and JavaScript
- Backend: Node.js 24.15.0, Express 5.2.1
- Database: PostgreSQL 18.6, database `docutrack` on localhost port 5432
- Auth: JWT (jsonwebtoken 9.0.3) and bcryptjs 3.0.3
- Uploads: Multer 2.3.0
- Frontend port: 8091, through `python3 -m http.server`
- Backend port: 5001, from `node server.js`
- API address in `frontend/config.js`: `http://localhost:5001`

## Completed features in the source

These routes and pages exist in the source. "Completed" here means the code is present, not that every path was clicked today.

- Login page and `POST /api/auth/login`
- Dashboard, My Files, Upload, Shared With Me, Search, Activity, Alerts, Profile
- Privacy Policy and Terms
- Upload, list, download, soft-delete, restore
- Share, shared download, ownership transfer, tags
- Activity logs and anomaly alerts
- Retention check route
- Startup script with start, stop, restart, status, and logs

## Features that need verification

- Upload of a new file was not repeated on 6 November 2026.
- Share, transfer, delete, restore, and tag changes were not submitted, because those writes were avoided during the backup.
- The retention check was not called with a valid token, because it can soft-delete expired files.
- Browser login, search, and the dashboard were not clicked in a browser today. The HTML pages returned HTTP 200 to curl.
- A teammate has not cloned the repository. Nothing has been pushed yet.
- The Mac was not rebooted to retest startup.

## Known bugs and limitations

- No registration route.
- Express does not enforce `role_permissions`. The retention button is hidden in the browser for non-admins only.
- Search is client-side.
- The UI shows the current file version, not the changelog stored in `version_changelog`.
- One file has `current_version_id` NULL.
- CORS accepts any origin.
- Tokens are stored in `localStorage` and expire after one hour.
- `npm test` exits 1 on purpose.
- Some server errors include the database error message.

## External dependencies

Runtime dependencies are the npm packages in `backend/package.json`, a local PostgreSQL server, and Python's built-in HTTP server. There is no cloud file store and no external authentication service.

`node_modules` is installed in `backend/node_modules` and is not committed. Reinstall with `npm install` from `backend/`.

## Exact local startup

```bash
cd /Users/shubhampingale/docutrack
./docutrack.sh start
```

Login page: http://127.0.0.1:8091/login.html

API: http://127.0.0.1:5001/

## Backup locations

- Source after this handover will be copied to `/Users/shubhampingale/DocuTrack_Backup/source/`
- Database dumps: `/Users/shubhampingale/DocuTrack_Backup/database/`
- Uploads: `/Users/shubhampingale/DocuTrack_Backup/uploads/`
- Private env file: `/Users/shubhampingale/DocuTrack_Backup/private/backend.env`

## GitHub

Git was not initialized at the start of this handover. The repository should stay unpublished until you choose private or public. Do not push `.env`, dumps, or uploads.
