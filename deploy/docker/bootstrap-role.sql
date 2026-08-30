SELECT format(
  'CREATE ROLE tablenow_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tablenow_app') \gexec

SELECT format('ALTER ROLE tablenow_app PASSWORD %L', :'app_password') \gexec
GRANT CONNECT ON DATABASE tablenow_v2 TO tablenow_app;
