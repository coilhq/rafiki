#!/bin/bash

# Defaults to local environment, system k6
ENV_NAME="local"
DOCKER_MODE=false
K6_ARGS=""

# Flags:
# -e, --environment  : Set the environment (e.g., local, test)
# -d, --docker       : Use docker to run k6
# -k, --k6args       : Pass all following arguments to k6 (e.g., --out cloud --vus 10)

# parse cli args
while [[ $# -gt 0 ]]; do
  case "$1" in
  -e | --environment)
    ENV_NAME="$2"
    shift 2
    ;;
  -d | --docker)
    DOCKER_MODE=true
    shift
    ;;
  -k | --k6args)
    shift
    K6_ARGS="$@"
    break
    ;;
  *)
    echo "Unknown argument: $1"
    exit 1
    ;;
  esac
done

ENV_FILE="config/$ENV_NAME.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: Config file '$ENV_FILE' not found."
  exit 1
fi

# Load env vars
set -o allexport
source "$ENV_FILE"
set +o allexport

check_service() {
  local url=$1
  local name=$2

  if curl -s --head --request GET "$url" | grep "HTTP/1.[01]" >/dev/null; then
    echo "$name is up: $url"
  else
    echo "$name is down: $url"
    exit 1
  fi
}
# ensure docker environment is up
check_service "http://localhost:$C9_GRAPHQL_PORT/graphql" "Cloud Nine GraphQL API"
check_service "http://localhost:$C9_OPEN_PAYMENTS_PORT/" "Cloud Nine Wallet Address"
check_service "http://localhost:$HLB_OPEN_PAYMENTS_PORT/" "Happy Life Bank Address"

add_host() {
  local hostname="$1"

  # Check first to avoid unnecessary sudo prompts
  if pnpm --filter performance hostile list | grep -q "127.0.0.1 $hostname"; then
    echo "$hostname already set"
  else
    sudo pnpm --filter performance hostile set 127.0.0.1 "$hostname"
    if [ $? -ne 0 ]; then
      echo "Error: Failed to write hosts to hostfile."
      exit 1
    fi
  fi
}

add_host $C9_BACKEND_HOST
add_host $C9_AUTH_HOST
add_host $HLB_BACKEND_HOST
add_host $HLB_AUTH_HOST

CLOUD_NINE_GQL_ENDPOINT="http://$C9_BACKEND_HOST:$C9_GRAPHQL_PORT/graphql"
if [[ "$ENV_NAME" == "local" ]]; then
  # local env uses default port (80)
  CLOUD_NINE_WALLET_ADDRESS="https://$C9_BACKEND_HOST/accounts/gfranklin"
  HAPPY_LIFE_BANK_WALLET_ADDRESS="https://$HLB_BACKEND_HOST/accounts/pfry"
else
  CLOUD_NINE_WALLET_ADDRESS="https://$C9_BACKEND_HOST:$C9_OPEN_PAYMENTS_PORT/accounts/gfranklin"
  HAPPY_LIFE_BANK_WALLET_ADDRESS="https://$HLB_BACKEND_HOST:$HLB_OPEN_PAYMENTS_PORT/accounts/pfry"
fi

# run tests
if $DOCKER_MODE; then
  docker run --rm --network="$DOCKER_NETWORK" \
    -v ./scripts:/scripts \
    -v ./dist:/dist \
    -e CLOUD_NINE_GQL_ENDPOINT=$CLOUD_NINE_GQL_ENDPOINT \
    -e CLOUD_NINE_WALLET_ADDRESS=$CLOUD_NINE_WALLET_ADDRESS \
    -e HAPPY_LIFE_BANK_WALLET_ADDRESS=$HAPPY_LIFE_BANK_WALLET_ADDRESS \
    -i grafana/k6 run /scripts/create-outgoing-payments.js $K6_ARGS
else
  k6 run ./scripts/create-outgoing-payments.js \
    -e CLOUD_NINE_GQL_ENDPOINT=$CLOUD_NINE_GQL_ENDPOINT \
    -e CLOUD_NINE_WALLET_ADDRESS=$CLOUD_NINE_WALLET_ADDRESS \
    -e HAPPY_LIFE_BANK_WALLET_ADDRESS=$HAPPY_LIFE_BANK_WALLET_ADDRESS $K6_ARGS
fi

exit $?
