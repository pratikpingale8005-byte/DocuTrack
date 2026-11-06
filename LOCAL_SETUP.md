# Local setup

DocuTrack runs on your Mac without the cloud development subscription. GitHub stores the source files. It does not store the live database, the `.env` file, or the uploaded documents.

## What must already be installed

Checked on this Mac on 6 November 2026:

| Tool | Version found |
| --- | --- |
| Node.js | 24.15.0 |
| npm | 11.12.1 |
| Python | 3.12.10 |
| PostgreSQL client | 18.6 (Homebrew) |
| Git | 2.55.0 |

PostgreSQL was listening on port 5432.

## First-time setup

```bash
cd /Users/shubhampingale/docutrack/backend
npm install
cp .env.example .env
```

Put the real database user and a new JWT secret in `backend/.env`. The copy of the working environment file for this Mac is only in:

`/Users/shubhampingale/DocuTrack_Backup/private/backend.env`

That file is outside the project and must not be committed.

Create an empty database and load the schema if `docutrack` does not already exist:

```bash
createdb docutrack
psql -d docutrack -v ON_ERROR_STOP=1 -f /Users/shubhampingale/docutrack/database/schema.sql
```

To restore accounts and file records as well, use the data dump described in `DATABASE_BACKUP_AND_RESTORE.md`. The schema file alone does not recreate users.

Copy backed-up uploads into `backend/uploads/` if that folder is empty. The application does not delete that folder on startup.

## Start

```bash
cd /Users/shubhampingale/docutrack
./docutrack.sh start
./docutrack.sh status
```

Open http://127.0.0.1:8091/login.html

Check http://127.0.0.1:5001/

## Ports

| Service | Default | Variable |
| --- | --- | --- |
| Frontend | 8091 | `FRONTEND_PORT` |
| Backend | 5001 | `BACKEND_PORT` |
| PostgreSQL | 5432 | `DB_PORT` in `backend/.env` |

On 6 November 2026, ports 8091, 5001, and 5432 were already in use by this project's frontend, this project's API, and PostgreSQL. They were left unchanged.

`./docutrack.sh stop` does not stop a server it did not start. The frontend and API that were already running before this handover were left running.

## Separate commands

Backend, from `backend/`:

```bash
node server.js
```

or:

```bash
npm start
```

Frontend, from `frontend/`:

```bash
python3 -m http.server 8091
```

## After a restart of the Mac

Start PostgreSQL first, then:

```bash
cd /Users/shubhampingale/docutrack
./docutrack.sh start
```

A Mac restart was not performed during this handover, so that step still needs to be checked by hand.
