# Local test report

Date: 6 November 2026. Results below were observed in this session. Earlier work is not marked as a pass.

| Test | Result | Evidence | Fix required |
| --- | --- | --- | --- |
| Frontend server reachable | PASS | `curl` of `http://127.0.0.1:8091/login.html` returned HTTP 200. Listener pid 99447, working directory `frontend/`. | No |
| Static pages load | PASS | login, dashboard, files, upload, search, shared, activity, alerts, profile, privacy, terms, `config.js`, and `style.css` each returned HTTP 200. | No |
| Backend root | PASS | `http://127.0.0.1:5001/` returned HTTP 200. | No |
| Updated server code can boot | PASS | A temporary process with `BACKEND_PORT=5099` returned HTTP 200, logged in, and listed files. That process was then stopped. Port 5001 was still HTTP 200 afterward. | No |
| Database connection | PASS | Login and file list on port 5099 used the updated server and the local database. | No |
| Invalid login rejected | PASS | `POST /api/auth/login` with a wrong password returned HTTP 401 and no token. | No |
| Valid login | PASS | Employee account login returned HTTP 200 and a token. The token was not printed. Role id was 3. | No |
| Protected files route without a token | PASS | `GET /api/files` returned HTTP 401. | No |
| Retention route without a token | PASS | `POST /api/files/retention/check` returned HTTP 401. | No |
| File list | PASS | `GET /api/files` with the employee token returned HTTP 200 and 2 files. | No |
| Shared-with-me list | PASS | Returned HTTP 200 and 1 file. | No |
| Activity logs | PASS | Returned HTTP 200 and 4 rows for that user. The table has more rows for other users. | No |
| Alerts | PASS | Returned HTTP 200 and 0 alerts. | No |
| Tags list | PASS | `GET /api/tags` returned HTTP 200. | No |
| Download owned file | PASS | Download of the first listed file returned HTTP 200 and 20 bytes. | No |
| Upload | NOT TESTED | Not run, to avoid adding another stored file during the backup. | Retest with a small text file when you want a write check. |
| Share, transfer, delete, restore, tag changes | NOT TESTED | Not run, because they change stored records. | Retest on a copy of the database, not on the only backup. |
| Retention check with a valid token | NOT TESTED | Not run. The route can soft-delete expired files. | Call it only when that effect is intended. |
| Shared download | NOT TESTED | Not called. | Use a file whose permission is download or edit. |
| Browser login, dashboard, search, console | NOT TESTED | No browser session was driven today. HTML responses were checked with curl only. | Open the login page, sign in, and watch the console. |
| `./docutrack.sh start` while servers already run | PASS | It reported pids 99447 and 9089 and did not start duplicates. | No |
| `./docutrack.sh stop` for servers it did not start | PASS | It stopped nothing. Both listeners stayed up. | No |
| `./docutrack.sh restart` | NOT TESTED | Restart would stop only script-owned processes. These servers are not script-owned. | Start them once with the script, then test restart. |
| Full dump restore | PASS | Plain SQL was restored into `docutrack_restore_check`. Base-table counts matched. That temporary database was dropped. The live database was not dropped. | No |
| Clean `npm install` from an empty `node_modules` | NOT TESTED | `node_modules` is already present and the API is using it. | Run `npm ci` in a copy of `backend/` when the live server does not depend on that folder. |
| Teammate clone | NOT TESTED | No GitHub push has been approved. | After the push, clone into a new folder and follow the README. |
| Mac reboot | NOT TESTED | Not done. | Restart the Mac, start PostgreSQL, then `./docutrack.sh start`. |
