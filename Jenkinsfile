// ============================================================
//  TechNexa Solutions — Jenkins CI/CD pipeline
//  Builds the site image and rolls it out onto the single-node
//  k3s cluster running on this EC2 host.
//
//  Trigger: SCM polling every ~2 min (no inbound webhook needed).
//  Manual:  "Build Now" in the Jenkins UI.
// ============================================================
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    skipDefaultCheckout(true)
  }

  triggers {
    pollSCM('H/2 * * * *')
  }

  environment {
    IMAGE = 'cybernexa:1.0'
    DEPLOYMENT = 'cybernexa'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log --oneline -1'
        sh 'git rev-parse --short HEAD > .build-rev'
      }
    }

    stage('Build image') {
      steps {
        sh 'sudo docker build -t "${IMAGE}" .'
      }
    }

    stage('Import into k3s') {
      steps {
        sh 'sudo docker save "${IMAGE}" | sudo k3s ctr images import -'
      }
    }

    stage('Deploy to k3s') {
      steps {
        sh 'sudo k3s kubectl apply -f k8s/'
        sh 'sudo k3s kubectl rollout restart deployment/${DEPLOYMENT}'
      }
    }

    stage('Verify rollout') {
      steps {
        sh 'sudo k3s kubectl rollout status deployment/${DEPLOYMENT} --timeout=180s'
        sh 'sudo k3s kubectl get pods -l app=${DEPLOYMENT} -o wide'
      }
    }

    stage('Smoke test') {
      steps {
        sh 'echo "--- pod health ---"; sudo k3s kubectl get pods -l app=${DEPLOYMENT} -o jsonpath="{.items[*].status.phase}"; echo'
        sh 'echo "--- app health ---"; curl -fsS -m 10 http://127.0.0.1:30542/healthz || curl -fsS -m 10 http://localhost/healthz'
        sh 'echo "--- homepage ---"; curl -fsS -m 10 -o /dev/null -w "HTTP %{http_code}\\n" http://127.0.0.1:30542/ || curl -fsS -m 10 -o /dev/null -w "HTTP %{http_code}\\n" http://localhost/'
      }
    }
  }

  post {
    success {
      echo 'TechNexa deployed successfully to k3s'
    }
    failure {
      echo '❌ Deploy FAILED — check the stage logs above'
    }
    always {
      sh 'sudo k3s kubectl get pods -l app=${DEPLOYMENT} || true'
    }
  }
}
