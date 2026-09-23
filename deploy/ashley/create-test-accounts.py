#!/usr/bin/env python3
"""One-time local bootstrap while Caddy is stopped and registration is enabled."""
import json
import os
import secrets
import urllib.error
import urllib.request
from pathlib import Path

path = Path('/srv/ashley/runtime/accounts.json')
if path.exists():
    raise SystemExit('Account file already exists; refusing to replace credentials')

accounts = []
for name, email in [
    ('Ashley Trial Admin', 'ashley-admin@forgepane.com'),
    ('Ashley Trial One', 'ashley-trial-1@forgepane.com'),
    ('Ashley Trial Two', 'ashley-trial-2@forgepane.com'),
]:
    account = {'name': name, 'email': email, 'password': secrets.token_urlsafe(24)}
    request = urllib.request.Request(
        'http://127.0.0.1:3080/api/auth/register',
        data=json.dumps({**account, 'confirm_password': account['password']}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError(f'Registration failed for {email}: {response.status}')
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Registration failed for {email}: {error.code}') from error
    accounts.append(account)
    with path.open('w') as target:
        os.fchmod(target.fileno(), 0o600)
        json.dump(accounts, target)
        target.write('\n')
    print(f'Created {email}')

for account in accounts:
    request = urllib.request.Request(
        'http://127.0.0.1:3080/api/auth/login',
        data=json.dumps({'email': account['email'], 'password': account['password']}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/140.0.0.0'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        user = json.load(response).get('user', {})
        print(f"Login verified: {account['email']} role={user.get('role')}")
