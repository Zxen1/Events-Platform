### DB split: system vs content

This repo includes a SQL script to split your single database into:

- **`funmapco_system`**: site-wide configuration and structure (admin settings/messages, formbuilder definitions, picklists, images basket, etc.)
- **`funmapco_content`**: heavy/user-generated/operational data (members, posts, media, transactions, logs, etc.)

The script keeps your application working without code changes by creating **views** back in `funmapco_db` that point to the moved tables.

#### Script

- `db/split-funmapco-db-system-content.sql`

#### How to run

Run the script in phpMyAdmin (SQL tab) or via CLI against your MySQL/MariaDB server. Do it during maintenance because it uses `RENAME TABLE`.


