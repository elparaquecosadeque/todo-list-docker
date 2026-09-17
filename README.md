# todo-docker (POC)

To-do list mínima, persistida en Postgres, corriendo en un contenedor Docker
y expuesta por cloudflared a `todo-list-docker.gerardoleon.dev`.

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

## 5. Alternativa: docker-compose (Postgres propio + cron sidecar)

Usa las variables `DB_USER` / `DB_PASSWORD` / `DB_NAME` del mismo `.env`
(no necesita el Postgres nativo del host):

```bash
docker compose up --build
```

`db` trae su propio volumen y corre `sql/init.sql` al crearse. `cleaner` es
un contenedor aparte con `crond` que limpia la tabla cada 2 horas — la misma
tarea que en la versión suelta hace `setInterval` dentro de la app, pero
resuelta al estilo Docker (sidecar).

## 6. Exponer con cloudflared

```bash
cloudflared tunnel login                          # abre el navegador, autentica con tu cuenta de Cloudflare
cloudflared tunnel create todo-docker-poc         # imprime un TUNNEL_ID
cloudflared tunnel route dns todo-docker-poc todo-list-docker.gerardoleon.dev
```

Edita `cloudflared/config.yml` y reemplaza `<TUNNEL_ID>` (dos lugares) con el
ID que te dio `tunnel create`.

```bash
cloudflared tunnel --config cloudflared/config.yml run todo-docker-poc
```

Con la app corriendo (paso 4 o 5) y el túnel arriba, abre
`https://todo-list-docker.gerardoleon.dev`.
