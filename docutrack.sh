#!/bin/bash
# Start or stop the existing DocuTrack frontend and backend.
#
#   ./docutrack.sh start
#   ./docutrack.sh stop
#   ./docutrack.sh restart
#   ./docutrack.sh status
#   ./docutrack.sh logs
#
# Default ports are 8091 (frontend) and 5001 (backend).
# Override them without editing this file:
#   FRONTEND_PORT=8091 BACKEND_PORT=5001 ./docutrack.sh start
# This script never terminates a process it did not start.

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_DIR="$ROOT/backend"
LOG_DIR="$ROOT/logs"
FRONTEND_PORT="${FRONTEND_PORT:-8091}"
BACKEND_PORT="${BACKEND_PORT:-5001}"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"

mkdir -p "$LOG_DIR"

case "$FRONTEND_PORT" in
  ''|*[!0-9]*) echo "FRONTEND_PORT must be an integer from 1 to 65535" >&2; exit 1 ;;
esac
case "$BACKEND_PORT" in
  ''|*[!0-9]*) echo "BACKEND_PORT must be an integer from 1 to 65535" >&2; exit 1 ;;
esac
if [ "$FRONTEND_PORT" -lt 1 ] || [ "$FRONTEND_PORT" -gt 65535 ] || [ "$BACKEND_PORT" -lt 1 ] || [ "$BACKEND_PORT" -gt 65535 ]; then
  echo "FRONTEND_PORT and BACKEND_PORT must be integers from 1 to 65535" >&2
  exit 1
fi

write_frontend_config() {
  cat > "$FRONTEND_DIR/config.js" << EOF
window.DOCUTRACK_CONFIG = {
  apiBaseUrl: "http://localhost:${BACKEND_PORT}"
};
EOF
}

listener_pids() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null
}

pid_command() {
  ps -p "$1" -o command= 2>/dev/null
}

pid_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | awk '/^n/ { sub(/^n/, ""); print; exit }'
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$1" 2>/dev/null || echo "000"
}

is_frontend_process() {
  local pid="$1"
  local cmd cwd
  cmd="$(pid_command "$pid")"
  cwd="$(pid_cwd "$pid")"
  case "$cmd" in
    *http.server*"$FRONTEND_PORT"*) ;;
    *) return 1 ;;
  esac
  [ "$cwd" = "$FRONTEND_DIR" ]
}

is_backend_process() {
  local pid="$1"
  local cmd cwd
  cmd="$(pid_command "$pid")"
  cwd="$(pid_cwd "$pid")"
  case "$cmd" in
    *server.js*) ;;
    *) return 1 ;;
  esac
  [ "$cwd" = "$BACKEND_DIR" ]
}

single_listener() {
  local port="$1"
  local pids pid count
  pids="$(listener_pids "$port")"
  if [ -z "$pids" ]; then
    return 1
  fi
  count="$(printf '%s\n' "$pids" | wc -l | tr -d ' ')"
  if [ "$count" -ne 1 ]; then
    echo "Port $port has more than one listener. Not starting or stopping anything on it." >&2
    printf '%s\n' "$pids" >&2
    return 2
  fi
  pid="$(printf '%s\n' "$pids" | head -1)"
  printf '%s' "$pid"
  return 0
}

wait_for_http() {
  local url="$1"
  local i code
  i=0
  while [ "$i" -lt 20 ]; do
    code="$(http_code "$url")"
    if [ "$code" = "200" ]; then
      return 0
    fi
    i=$((i + 1))
    sleep 0.25
  done
  return 1
}

show_log_tail() {
  local log="$1"
  if [ -f "$log" ]; then
    echo "Last lines of $log:"
    tail -n 20 "$log"
  fi
}

start_frontend() {
  local pid status
  set +e
  pid="$(single_listener "$FRONTEND_PORT")"
  status=$?
  set -e
  if [ "$status" -eq 2 ]; then
    return 1
  fi
  if [ "$status" -eq 0 ]; then
    if is_frontend_process "$pid"; then
      local code
      code="$(http_code "http://127.0.0.1:$FRONTEND_PORT/login.html")"
      if [ "$code" = "200" ]; then
        echo "Frontend: already running on port $FRONTEND_PORT (pid $pid). Not starting another copy."
        return 0
      fi
      echo "Frontend: port $FRONTEND_PORT is already used by pid $pid, but login.html returned HTTP $code."
      echo "Not starting a duplicate. Inspect that process before trying again."
      return 1
    fi
    echo "Frontend: port $FRONTEND_PORT is in use by a different process (pid $pid)."
    echo "Command: $(pid_command "$pid")"
    echo "Not stopping it, and not starting another frontend."
    return 1
  fi

  if [ ! -d "$FRONTEND_DIR" ] || [ ! -f "$FRONTEND_DIR/login.html" ]; then
    echo "Frontend: login.html was not found in $FRONTEND_DIR"
    return 1
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Frontend: python3 was not found."
    return 1
  fi

  printf '\n--- %s starting frontend on port %s ---\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$FRONTEND_PORT" >> "$FRONTEND_LOG"
  (
    cd "$FRONTEND_DIR" || exit 1
    nohup python3 -m http.server "$FRONTEND_PORT" >> "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
  )
  pid="$(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)"
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "Frontend: failed to start. See $FRONTEND_LOG"
    show_log_tail "$FRONTEND_LOG"
    rm -f "$FRONTEND_PID_FILE"
    return 1
  fi
  if ! wait_for_http "http://127.0.0.1:$FRONTEND_PORT/login.html"; then
    echo "Frontend: process $pid started, but login.html did not return HTTP 200."
    show_log_tail "$FRONTEND_LOG"
    return 1
  fi
  echo "Frontend: started (pid $pid). Log: $FRONTEND_LOG"
  return 0
}

start_backend() {
  local pid status
  set +e
  pid="$(single_listener "$BACKEND_PORT")"
  status=$?
  set -e
  if [ "$status" -eq 2 ]; then
    return 1
  fi
  if [ "$status" -eq 0 ]; then
    if is_backend_process "$pid"; then
      local code
      code="$(http_code "http://127.0.0.1:$BACKEND_PORT/")"
      if [ "$code" = "200" ]; then
        echo "Backend: already running on port $BACKEND_PORT (pid $pid). Not starting another copy."
        return 0
      fi
      echo "Backend: port $BACKEND_PORT is already used by pid $pid, but the API returned HTTP $code."
      echo "Not starting a duplicate. Inspect that process before trying again."
      return 1
    fi
    echo "Backend: port $BACKEND_PORT is in use by a different process (pid $pid)."
    echo "Command: $(pid_command "$pid")"
    echo "Not stopping it, and not starting another backend."
    return 1
  fi

  if [ ! -f "$BACKEND_DIR/server.js" ]; then
    echo "Backend: server.js was not found in $BACKEND_DIR"
    return 1
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "Backend: node was not found."
    return 1
  fi

  printf '\n--- %s starting backend on port %s ---\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$BACKEND_PORT" >> "$BACKEND_LOG"
  (
    cd "$BACKEND_DIR" || exit 1
    nohup node server.js >> "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
  )
  pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "Backend: failed to start. See $BACKEND_LOG"
    show_log_tail "$BACKEND_LOG"
    rm -f "$BACKEND_PID_FILE"
    return 1
  fi
  if ! wait_for_http "http://127.0.0.1:$BACKEND_PORT/"; then
    echo "Backend: process $pid started, but http://127.0.0.1:$BACKEND_PORT/ did not return HTTP 200."
    show_log_tail "$BACKEND_LOG"
    return 1
  fi
  echo "Backend: started (pid $pid). Log: $BACKEND_LOG"
  return 0
}

stop_recorded() {
  local name="$1"
  local pid_file="$2"
  local kind="$3"
  local pid cmd

  if [ ! -f "$pid_file" ]; then
    echo "$name: this script has no recorded process. Nothing was stopped."
    return 0
  fi
  pid="$(tr -d '[:space:]' < "$pid_file")"
  if [ -z "$pid" ]; then
    echo "$name: pid file was empty. Nothing was stopped."
    rm -f "$pid_file"
    return 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "$name: recorded pid $pid is not running. Removed the stale pid file."
    rm -f "$pid_file"
    return 0
  fi

  if [ "$kind" = "frontend" ]; then
    if ! is_frontend_process "$pid"; then
      echo "$name: pid $pid is not the DocuTrack frontend started for this project. Not stopping it."
      echo "Command: $(pid_command "$pid")"
      return 1
    fi
  else
    if ! is_backend_process "$pid"; then
      echo "$name: pid $pid is not the DocuTrack backend started for this project. Not stopping it."
      echo "Command: $(pid_command "$pid")"
      return 1
    fi
  fi

  kill "$pid" 2>/dev/null || true
  local i=0
  while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 20 ]; do
    i=$((i + 1))
    sleep 0.25
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.2
  fi
  if kill -0 "$pid" 2>/dev/null; then
    echo "$name: could not stop pid $pid."
    return 1
  fi
  rm -f "$pid_file"
  echo "$name: stopped pid $pid."
  return 0
}

status_one() {
  local name="$1"
  local port="$2"
  local url="$3"
  local kind="$4"
  local pid_file="$5"
  local pid status code recorded

  set +e
  pid="$(single_listener "$port")"
  status=$?
  set -e
  if [ "$status" -eq 2 ]; then
    return
  fi
  if [ "$status" -ne 0 ]; then
    echo "$name: not running (nothing is listening on port $port)."
    return
  fi
  code="$(http_code "$url")"
  recorded="no"
  if [ -f "$pid_file" ] && [ "$(tr -d '[:space:]' < "$pid_file")" = "$pid" ]; then
    recorded="yes"
  fi
  if [ "$kind" = "frontend" ] && is_frontend_process "$pid"; then
    echo "$name: running (pid $pid, port $port, HTTP $code, started by this script: $recorded)."
  elif [ "$kind" = "backend" ] && is_backend_process "$pid"; then
    echo "$name: running (pid $pid, port $port, HTTP $code, started by this script: $recorded)."
  else
    echo "$name: port $port is in use by a different process (pid $pid, HTTP $code)."
    echo "Command: $(pid_command "$pid")"
  fi
}

cmd="${1:-}"
case "$cmd" in
  start)
    set -e
    front_ok=0
    back_ok=0
    write_frontend_config
    export BACKEND_PORT
    start_frontend || front_ok=1
    start_backend || back_ok=1
    echo "Login page: http://127.0.0.1:$FRONTEND_PORT/login.html"
    echo "API: http://127.0.0.1:$BACKEND_PORT"
    if [ "$front_ok" -ne 0 ] || [ "$back_ok" -ne 0 ]; then
      exit 1
    fi
    ;;
  stop)
    set -e
    stop_ok=0
    stop_recorded "Frontend" "$FRONTEND_PID_FILE" "frontend" || stop_ok=1
    stop_recorded "Backend" "$BACKEND_PID_FILE" "backend" || stop_ok=1
    if [ "$stop_ok" -ne 0 ]; then
      exit 1
    fi
    ;;
  restart)
    "$0" stop || exit 1
    "$0" start
    ;;
  status)
    status_one "Frontend" "$FRONTEND_PORT" "http://127.0.0.1:$FRONTEND_PORT/login.html" "frontend" "$FRONTEND_PID_FILE"
    status_one "Backend" "$BACKEND_PORT" "http://127.0.0.1:$BACKEND_PORT/" "backend" "$BACKEND_PID_FILE"
    ;;
  logs)
    if [ -f "$FRONTEND_LOG" ]; then
      echo "===== $FRONTEND_LOG ====="
      tail -n 40 "$FRONTEND_LOG"
    else
      echo "No frontend log yet: $FRONTEND_LOG"
    fi
    if [ -f "$BACKEND_LOG" ]; then
      echo "===== $BACKEND_LOG ====="
      tail -n 40 "$BACKEND_LOG"
    else
      echo "No backend log yet: $BACKEND_LOG"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
