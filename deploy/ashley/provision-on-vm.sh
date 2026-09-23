#!/usr/bin/env bash
set -euo pipefail
cd /srv/ashley/release
email=$(python3 -c 'import json; print(json.load(open("/srv/ashley/runtime/accounts.json"))[0]["email"])')
password=$(python3 -c 'import json; print(json.load(open("/srv/ashley/runtime/accounts.json"))[0]["password"])')
agent_id=$(python3 - <<'PY'
import json
import urllib.request
account = json.load(open('/srv/ashley/runtime/accounts.json'))[0]
headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/140.0.0.0'}
request = urllib.request.Request(
    'http://127.0.0.1:3080/api/auth/login',
    data=json.dumps({'email': account['email'], 'password': account['password']}).encode(),
    headers=headers,
)
token = json.load(urllib.request.urlopen(request))['token']
headers['Authorization'] = 'Bearer ' + token
request = urllib.request.Request('http://127.0.0.1:3080/api/agents', headers=headers)
matches = [agent for agent in json.load(urllib.request.urlopen(request))['data'] if agent['name'] == 'Ashley Assistant']
if len(matches) > 1:
    raise SystemExit('Multiple Ashley Assistant agents found; choose an ID explicitly')
print(matches[0]['id'] if matches else '')
PY
)
docker compose --env-file /srv/ashley/runtime/app.env exec -T \
  -e LIBRECHAT_URL=http://127.0.0.1:3080 \
  -e LIBRECHAT_EMAIL="$email" \
  -e LIBRECHAT_PASSWORD="$password" \
  -e SELECTION_AGENT_ID="$agent_id" \
  api node /app/services/selection-demo/provision.mjs
