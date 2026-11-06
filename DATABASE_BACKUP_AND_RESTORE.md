# Database backup and restore

The live database was not modified or deleted while these backups were made.

## Where the backups are

These files are on this Mac, outside the project, and they are not part of the Git repository:

| File | Format | Size checked |
| --- | --- | --- |
| `/Users/shubhampingale/DocuTrack_Backup/database/docutrack.dump` | PostgreSQL custom format (`pg_dump -Fc`) | 56400 bytes |
| `/Users/shubhampingale/DocuTrack_Backup/database/docutrack.sql` | Plain SQL, including data | 40475 bytes |
| `/Users/shubhampingale/DocuTrack_Backup/database/schema.sql` | Schema only | 30038 bytes |

The repository copy is `database/schema.sql`. The `\restrict` lines added by PostgreSQL 18 `pg_dump` were removed from that copy so it is ordinary SQL. The backup files still contain those lines. They are dump-safety tokens, not the database password or the JWT secret.

The plain SQL and custom dump contain account email addresses and password hashes. Do not commit them and do not upload them to GitHub.

## What was in the database

Exported on 6 November 2026 from local PostgreSQL, database `docutrack`, host `localhost`, port `5432`. The connection uses `DB_USER` from `backend/.env`. No `DB_PASSWORD` is set.

Extensions: `plpgsql` only.

Base tables and row counts at export time:

| Table | Rows |
| --- | --- |
| activity_log | 30 |
| anomaly_alerts | 0 |
| categories | 7 |
| departments | 4 |
| file_tags | 2 |
| file_versions | 9 |
| files | 6 |
| ownership_transfers | 2 |
| permissions | 7 |
| retention_policies | 3 |
| role_permissions | 13 |
| roles | 3 |
| shared_access | 3 |
| tags | 2 |
| users | 2 |
| version_changelog | 9 |

Views: `vw_department_storage_usage` (4 rows) and `vw_file_version_history` (9 rows).

24 foreign keys and 2 triggers were present. Functions included with the schema include the anomaly helpers `detect_bulk_downloads`, `detect_excessive_downloads`, and `detect_mass_deletes`.

One file row has `current_version_id` NULL.

## Restore the schema only

```bash
createdb docutrack
psql -d docutrack -v ON_ERROR_STOP=1 -f database/schema.sql
```

This creates empty tables. It does not restore users or files.

## Restore the full backup with psql

Use this only against an empty database. Do not run it against the live `docutrack` database.

```bash
createdb docutrack_restore
psql -d docutrack_restore -v ON_ERROR_STOP=1 -f /Users/shubhampingale/DocuTrack_Backup/database/docutrack.sql
```

## Restore the custom dump with pg_restore

```bash
createdb docutrack_restore
pg_restore --no-owner --dbname docutrack_restore /Users/shubhampingale/DocuTrack_Backup/database/docutrack.dump
```

## Restore check already performed

On 6 November 2026 the plain SQL backup was restored into a new database named `docutrack_restore_check`. These base-table counts matched the live database: activity_log 30, anomaly_alerts 0, categories 7, departments 4, file_tags 2, file_versions 9, files 6, ownership_transfers 2, permissions 7, retention_policies 3, role_permissions 13, roles 3, shared_access 3, tags 2, users 2, version_changelog 9.

That temporary database was dropped after the check. The live `docutrack` database was not dropped.

## Uploaded files

Database rows point at file names stored under `backend/uploads/`. Restoring the database without copying that folder leaves download links pointing at missing files. The upload backup is:

`/Users/shubhampingale/DocuTrack_Backup/uploads/`

Copy those files back into `backend/uploads/` if you rebuild the project folder. Do not delete the originals in the project.
