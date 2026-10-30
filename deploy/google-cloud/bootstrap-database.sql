-- Run in an interactive psql session connected to brandlint, as postgres.
-- Passwords are prompted by psql and do not appear in this file or command arguments.
CREATE ROLE brandlint_migrator LOGIN;
\password brandlint_migrator
CREATE ROLE brandlint_app LOGIN;
\password brandlint_app
GRANT CONNECT ON DATABASE brandlint TO brandlint_migrator, brandlint_app;
GRANT USAGE, CREATE ON SCHEMA public TO brandlint_migrator;
GRANT USAGE ON SCHEMA public TO brandlint_app;
