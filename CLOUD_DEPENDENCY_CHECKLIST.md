# Cloud dependency checklist

Checked on 6 November 2026 from the source in `/Users/shubhampingale/docutrack`.

## The application itself

| Service | Depends on the cloud subscription? | Evidence |
| --- | --- | --- |
| Frontend pages | No | Static files in `frontend/`. Served by local `python3 -m http.server`. |
| API | No | `backend/server.js` listens on the local machine. |
| Database | No | `backend/config/db.js` reads `DB_HOST`, `DB_PORT`, `DB_NAME`, and `DB_USER`. The working value is localhost port 5432. |
| File storage | No | Multer writes to `backend/uploads/` on disk. There is no S3, Cloudinary, or other storage client in the application source. |
| Login | No | bcrypt and a local JWT secret. No external auth provider. |
| Model or AI API | No | The web app does not call an AI or training service. |

No application code was found that must reach the Cursor cloud, a hosted database, or a hosted file store in order to start.

## What the subscription does affect

The Cursor cloud subscription is the development environment used to edit this project. It is not a runtime dependency of DocuTrack. After it expires:

- The copy at `/Users/shubhampingale/docutrack` remains on this Mac.
- The backup at `/Users/shubhampingale/DocuTrack_Backup/` remains on this Mac.
- Local PostgreSQL and the uploads folder remain available only if they stay on this Mac.
- GitHub will have the source only after a push is approved and completed. That push has not been done yet.

## Do not delete yet

Do not delete the cloud project, the local project folder, or the live database until you have checked all three of these yourself:

1. The project folder is still on this Mac.
2. The backup folder is still on this Mac and the dump files are non-empty.
3. The GitHub repository, after you approve a push, contains the source and not `.env`.

## Remaining risks

- `backend/.env` exists only on this Mac and in the private backup file. A new clone does not include it.
- The database data dump is only in `DocuTrack_Backup`. It is not in Git.
- Uploaded documents are only in `backend/uploads/` and `DocuTrack_Backup/uploads/`.
- If PostgreSQL is not started after a reboot, the API will fail when it queries the database.
- The JWT secret in the local `.env` should be rotated if that file is copied to anyone else. It is not in the source files.
- No second backup on an external drive was created. Copy `DocuTrack_Backup` to an external drive yourself if you want one.
