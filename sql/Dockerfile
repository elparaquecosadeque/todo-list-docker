FROM postgres:16-alpine
# Baked in (not bind-mounted) so Jenkins can deploy a release without the repo checkout on the host.
COPY init.sql /docker-entrypoint-initdb.d/
