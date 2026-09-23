#!/usr/bin/env python3
"""Exercise a deployed trial account through the public LibreChat API."""
import argparse
import json
import re
import subprocess
import urllib.error
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('prompt')
parser.add_argument('--agent-id', required=True)
parser.add_argument('--account-index', type=int, default=1)
parser.add_argument('--base', default='https://ashley.forgepane.com')
parser.add_argument('--conversation-id', default='new')
parser.add_argument('--parent-message-id', default='00000000-0000-0000-0000-000000000000')
args = parser.parse_args()

result = subprocess.run(
    ['gcloud', 'secrets', 'versions', 'access', 'latest',
     '--secret=ashley-trial-accounts', '--project=cited-alpha-20260701'],
    check=True, capture_output=True, text=True,
)
account = json.loads(result.stdout)[args.account_index]
headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/140.0.0.0'}

def request(path, data=None, token=None):
    current = {**headers, **({'Authorization': 'Bearer ' + token} if token else {})}
    try:
        return urllib.request.urlopen(
            urllib.request.Request(
                args.base + path,
                data=json.dumps(data).encode() if data is not None else None,
                headers=current,
            ), timeout=300,
        )
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{path}: HTTP {error.code} {error.read().decode()[:500]}') from error

with request('/api/auth/login', {'email': account['email'], 'password': account['password']}) as response:
    auth = json.load(response)
token = auth['token']
body = {
    'text': args.prompt,
    'sender': 'User',
    'isCreatedByUser': True,
    'endpoint': 'agents',
    'agent_id': args.agent_id,
    'model': 'gemini-3.1-pro-preview',
    'messageId': str(uuid.uuid4()),
    'parentMessageId': args.parent_message_id,
    'conversationId': args.conversation_id,
    'isContinued': False,
}
with request('/api/agents/chat', body, token) as response:
    started = json.load(response)

tools = []
final = None
with request('/api/agents/chat/stream/' + started['streamId'], token=token) as response:
    for raw in response:
        line = raw.decode().strip()
        if not line.startswith('data:'):
            continue
        try:
            event = json.loads(line[5:])
        except ValueError:
            continue
        if event.get('event') == 'on_run_step':
            details = event.get('data', {}).get('stepDetails', {})
            tools.extend(call.get('name') for call in details.get('tool_calls', []) if call.get('name'))
        if event.get('final'):
            final = event
            break
        if event.get('error'):
            raise RuntimeError(str(event['error'])[:500])

if final is None:
    raise RuntimeError('Generation ended without a final response')
message = final.get('responseMessage', {})
text = '\n'.join(part.get('text', '') for part in message.get('content', []) if part.get('type') == 'text')
print(json.dumps({
    'account': account['email'],
    'conversation_id': started['conversationId'],
    'message_id': message.get('messageId'),
    'tools': tools,
    'ui_markers': len(re.findall(r'\\ui\{[^}]+\}', text)),
    'renderable_ui_markers': len(re.findall(r'\\ui\{\w+(?:,\w+)*\}', text)),
    'url_count': len(re.findall(r'https?://[^\s)]+', text)),
    'text': text[:3000],
}, ensure_ascii=False, indent=2))
