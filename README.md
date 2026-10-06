# todo-docker (POC)

To-do list mínima, persistida en Postgres, corriendo en un contenedor Docker
y expuesta por cloudflared (desde jenkins-local) a `todo-list-docker.gerardoleon.dev`.

## 1. Docker Desktop

El daemon no estaba corriendo al preparar esto. Arráncalo antes de seguir.

## 2. Preparar la base de datos

El `pg_hba.conf` ya quedó ajustado para aceptar al rol `todoapp` sobre la DB
`tododb` desde la red de Docker (`172.16.0.0/12`). Falta crear el rol/DB y
recargar la config:

```bash
psql -U postgres -f sql/setup-host-db.sql   # te pide el password de postgres
psql -U postgres -c "SELECT pg_reload_conf();"
psql -U todoapp -d tododb -f sql/init.sql   # te pide el password que pusiste en setup-host-db.sql
```

Antes de correr `setup-host-db.sql`, cambia `CHANGE_ME` por un password real.

## 3. Configurar `.env`

```bash
cp .env.example .env
```

Edita `DATABASE_URL` con el mismo password que usaste arriba.

## 4. Build & run (Dockerfile suelto)

```bash
docker build -t todo-app .
docker run --rm -p 3000:3000 --env-file .env todo-app
```

Abre `http://localhost:3000` y prueba agregar/marcar/borrar tareas.

## 5. En el servidor (jenkins-local)

Lo despliega Jenkins con el `Jenkinsfile`. Usa el Postgres compartido de
jenkins-local (`shared-postgres`, red `shared-db`), donde tiene su propio rol
y su propia base; el pipeline los crea con `ensure-db` antes de cada deploy.

`cleaner` es un contenedor aparte con `crond` que limpia la tabla cada 2
horas — la misma tarea que en la versión suelta hace `setInterval` dentro de
la app, pero resuelta al estilo Docker (sidecar).

## 6. Exponer con cloudflared

En el servidor lo publica el contenedor `cloudflared` de
[jenkins-local](https://github.com/elparaquecosadeque/jenkins-local) (ver su
`cloudflared/config.yml`) en `https://todo-list-docker.gerardoleon.dev`.
