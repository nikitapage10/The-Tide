#!/usr/bin/env bash
# Runs the SQL migrations + RLS tests against a throwaway local Postgres.
# Requires PostgreSQL 15+ server binaries (initdb, pg_ctl, postgres, psql).
# This exercises SQL, RLS and functions with a STUB of Supabase's auth/storage
# schemas. It does not run GoTrue, PostgREST or the Storage API.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | tail -1)")}"
if [ ! -x "$PGBIN/pg_ctl" ]; then echo "SKIPPED: PostgreSQL server binaries not found (set PGBIN)"; exit 2; fi
DATA="$ROOT/.tmp-pg/data"; SOCK="$ROOT/.tmp-pg/sock"; PORT="${TIDE_TEST_PG_PORT:-54329}"
rm -rf "$ROOT/.tmp-pg"; mkdir -p "$DATA" "$SOCK"
RUNAS=()
if [ "$(id -u)" = "0" ]; then
  id tidepg >/dev/null 2>&1 || useradd -M -s /bin/false tidepg
  chown -R tidepg "$ROOT/.tmp-pg"; RUNAS=(runuser -u tidepg --)
fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$ROOT/.tmp-pg/log" -w start >/dev/null
trap '"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true' EXIT
PSQL=("$PGBIN/psql" -h "$SOCK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrate: $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
OUT="$ROOT/.tmp-pg/results.txt"
"${PSQL[@]}" -f "$ROOT/tests/db/rls.test.sql" 2>&1 | tee "$ROOT/.tmp-pg/raw.txt" | sed -n "s/.*NOTICE:  //p" | tee "$OUT"
PASS=$(grep -c '^ok - ' "$OUT" || true); FAIL=$(grep -c '^not ok - ' "$OUT" || true)
echo "SQL tests: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] && [ "$PASS" -gt 0 ]
