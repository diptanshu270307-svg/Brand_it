-- Execute after migrations, as the migration owner in the brandlint database.
-- Replace identifiers if you selected different database/user names.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO brandlint_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO brandlint_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.schema_migrations FROM brandlint_app;
ALTER DEFAULT PRIVILEGES FOR ROLE brandlint_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO brandlint_app;
ALTER DEFAULT PRIVILEGES FOR ROLE brandlint_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO brandlint_app;
