// CI/CD for todo-list on the self-hosted Jenkins (see the jenkins-local repo).
// Every new commit on master: images tagged <build>-<sha> → release → deploy (waits for healthchecks).
// The database lives in jenkins-local's shared Postgres: ensure-db (role + db) and sql/init.sql are idempotent.
//
// A release is the compose file of one tag, kept in $JENKINS_HOME/deploy-state/todo-list/<tag>/.
// Deploys and rollbacks run from the target tag's release, so the old compose config comes back with the old images.
// A failed deploy rolls back to the last tag that went live. "Build with Parameters" + DEPLOY_TAG = manual rollback.
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timeout(time: 20, unit: 'MINUTES')
  }

  parameters {
    string(name: 'DEPLOY_TAG', defaultValue: '',
      description: 'Vacío: construir y desplegar este commit. Un tag existente (p. ej. 12-a1b2c3d): rollback a esa versión sin construir.')
  }

  environment {
    RELEASES = "${JENKINS_HOME}/deploy-state/todo-list"
    LAST_GOOD = "${JENKINS_HOME}/deploy-state/todo-list/last-good"
    KEEP_RELEASES = '5'
  }

  stages {
    stage('Versión') {
      steps {
        script {
          env.ROLLBACK_ONLY = params.DEPLOY_TAG?.trim() ? 'true' : 'false'
          env.TAG = env.ROLLBACK_ONLY == 'true' ? params.DEPLOY_TAG.trim() : "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} · ${env.TAG}${env.ROLLBACK_ONLY == 'true' ? ' (rollback)' : ''}"
        }
        sh '''
          mkdir -p "$RELEASES"
          echo "Versión en producción: $(cat "$LAST_GOOD" 2>/dev/null || echo ninguna)"
          echo "Releases disponibles para rollback: $(ls -1t "$RELEASES" | grep -v last-good | tr '\n' ' ')"
          if [ "$ROLLBACK_ONLY" = true ] && [ ! -f "$RELEASES/$TAG/docker-compose.yml" ]; then
            echo "No existe el release $TAG. Usa uno de la lista de arriba." >&2; exit 1
          fi
        '''
      }
    }

    stage('Imágenes y release') {
      when { environment name: 'ROLLBACK_ONLY', value: 'false' }
      steps {
        // DB_PASSWORD is only interpolated, never baked into an image.
        sh 'export TODO_TAG="$TAG" DB_PASSWORD=unused; docker compose build --pull || docker compose build'
        sh '''
          mkdir -p "$RELEASES/$TAG"
          cp docker-compose.yml "$RELEASES/$TAG/"
          git log -1 --format='%H %an: %s' > "$RELEASES/$TAG/commit.txt"
        '''
      }
    }

    stage('Deploy') {
      steps {
        script { env.DEPLOY_STARTED = 'true' }
        withCredentials([string(credentialsId: 'todo-list-db-password', variable: 'DB_PASSWORD')]) {
          sh '''
            ensure-db todoapp tododb
            docker exec -i shared-postgres psql -U todoapp -d tododb -v ON_ERROR_STOP=1 -q < sql/init.sql
          '''
          sh 'TODO_TAG="$TAG" docker compose -f "$RELEASES/$TAG/docker-compose.yml" up -d --no-build --wait --wait-timeout 120'
        }
      }
    }
  }

  post {
    success {
      sh '''
        echo "$TAG" > "$LAST_GOOD"
        ls -1t "$RELEASES" | grep -v last-good | tail -n +"$((KEEP_RELEASES + 1))" | grep -vx "$TAG" \
          | xargs -r -I{} rm -rf "$RELEASES/{}"
        # Keep the images of the last N builds for instant rollback; never the one just deployed.
        for repo in todo-list-app todo-list-cleaner; do
          docker images "$repo" --format '{{.Tag}}' | grep -E '^[0-9]+-' | sort -t- -k1,1nr \
            | tail -n +"$((KEEP_RELEASES + 1))" | grep -vx "$TAG" | xargs -r -I{} docker rmi "$repo:{}" >/dev/null || true
        done
      '''
      script { currentBuild.description = "En producción: ${env.TAG}" }
    }
    failure {
      script {
        if (env.ROLLBACK_ONLY == 'false' && env.TAG) {
          sh 'rm -rf "$RELEASES/$TAG"'
        }
        if (env.DEPLOY_STARTED == 'true') {
          sh 'docker compose -p todo-list logs --tail 60 || true'
          def previous = sh(script: 'cat "$LAST_GOOD" 2>/dev/null || true', returnStdout: true).trim()
          if (previous && previous != env.TAG) {
            echo "Deploy de ${env.TAG} falló: volviendo a ${previous}"
            withCredentials([string(credentialsId: 'todo-list-db-password', variable: 'DB_PASSWORD')]) {
              withEnv(["PREVIOUS=${previous}"]) {
                sh 'TODO_TAG="$PREVIOUS" docker compose -f "$RELEASES/$PREVIOUS/docker-compose.yml" up -d --no-build --wait --wait-timeout 120'
              }
            }
            currentBuild.description = "Falló; se restauró ${previous}"
          } else {
            echo 'No hay una versión buena previa a la que volver.'
          }
        }
      }
    }
    always {
      sh 'docker image prune -f >/dev/null || true'
    }
  }
}
