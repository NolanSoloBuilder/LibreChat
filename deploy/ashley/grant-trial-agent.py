#!/usr/bin/env python3
"""Grant the Ashley Agent to the two invited trial accounts through its ACL API."""
import json
import os
import subprocess
import urllib.parse
import urllib.request

base = os.getenv('ASHLEY_BASE', 'https://ashley.forgepane.com')
agent_id = 'agent_T6pfagyKh0-d6pm07XYQ4'
account_file = os.getenv('ASHLEY_ACCOUNTS_FILE')
accounts = json.load(open(account_file)) if account_file else json.loads(subprocess.run(
    ['gcloud', 'secrets', 'versions', 'access', 'latest',
     '--secret=ashley-trial-accounts', '--project=cited-alpha-20260701'],
    check=True, capture_output=True, text=True,
).stdout)

def request(path, token=None, body=None, method=None):
    headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/140.0.0.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urllib.request.urlopen(urllib.request.Request(
        base + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
        method=method,
    ), timeout=30) as response:
        return json.load(response)

admin_token = request('/api/auth/login', body={
    'email': accounts[0]['email'], 'password': accounts[0]['password'],
})['token']
agent = request('/api/agents/' + agent_id, admin_token)
object_id = agent['_id']
path = '/api/permissions/agent/' + object_id
search = request('/api/permissions/search-principals?q=' + urllib.parse.quote('ashley-trial-'), admin_token)
ids_by_email = {item.get('email'): item['id'] for item in search['results']}
principals = [{
    'type': 'user',
    'id': ids_by_email[account['email']],
    'accessRoleId': 'agent_viewer',
} for account in accounts[1:]]
request(path, admin_token, body={'updated': principals, 'removed': [], 'public': False}, method='PUT')
checked = request(path, admin_token)
grants = {(item.get('id'), item.get('accessRoleId')) for item in checked['principals']}
for principal in principals:
    if (principal['id'], 'agent_viewer') not in grants:
        raise RuntimeError('Trial agent ACL readback is incomplete')
if checked.get('public'):
    raise RuntimeError('Agent unexpectedly has public ACL access')
print('Granted agent_viewer to two invited users; public ACL remains disabled')
