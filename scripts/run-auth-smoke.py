"""Run the bundled native probe; retain only its sanitized report."""
import json
from pathlib import Path
import re
import subprocess
import sys

EXPECTED_CASES = {'chatgpt-destination', 'chatgpt-sign-in', 'flow-destination', 'google-sign-in'}
COUNTERS = ('navigation_count', 'blocked_navigation_count', 'load_started_count', 'load_finished_count')

def sanitized_report(data):
    if data.get('kind') != 'anonymous-native-auth-smoke' or data.get('schema_version') != 1 or data.get('login_verified') is not False:
        raise ValueError('Unexpected native report schema')
    cases = data.get('cases', [])
    if len(cases) != 4 or {case.get('id') for case in cases} != EXPECTED_CASES:
        raise ValueError('Missing native probe cases')
    clean = []
    for case in cases:
        if type(case.get('created')) is not bool or type(case.get('timed_out')) is not bool:
            raise ValueError('Invalid native view outcome')
        counts = {name: case.get(name) for name in COUNTERS}
        if any(type(value) is not int or value < 0 for value in counts.values()):
            raise ValueError('Invalid native navigation counters')
        hosts = case.get('hosts')
        if not isinstance(hosts, list) or any(not isinstance(host, str) or not re.fullmatch(r'[a-z0-9.-]+', host) for host in hosts):
            raise ValueError('Native report must contain only hostnames')
        metadata = {}
        for name, pattern in [('blocked_hosts', r'[a-z0-9.-]+'), ('blocked_schemes', r'[a-z][a-z0-9+.-]*')]:
            values = case.get(name)
            if not isinstance(values, list) or any(not isinstance(value, str) or not re.fullmatch(pattern, value) for value in values):
                raise ValueError('Native blocked navigation metadata must contain only hostnames or schemes')
            metadata[name] = values
        clean.append({'id': case['id'], 'created': case['created'], **counts, 'hosts': hosts, **metadata, 'timed_out': case['timed_out']})
    return {'kind': data['kind'], 'schema_version': 1, 'created_count': sum(case['created'] for case in clean), 'loaded_count': sum(case['load_finished_count'] > 0 for case in clean), 'login_verified': False, 'interpretation': 'Anonymous native document-load observations only. Sign-in, MFA, popup completion, and restart session persistence require interactive testing.', 'cases': clean}

def main():
    result = subprocess.run([sys.argv[1], '--auth-smoke'], capture_output=True, text=True, timeout=120)
    reports = [line.removeprefix('AUTH_SMOKE_REPORT ') for line in result.stdout.splitlines() if line.startswith('AUTH_SMOKE_REPORT ')]
    if len(reports) != 1:
        raise ValueError(f'Native probe produced no unique report (exit {result.returncode})')
    report = sanitized_report(json.loads(reports[0]))
    Path(sys.argv[2]).write_text(json.dumps(report, indent=2) + '\n')
    print(f"Native WebView probe: {report['created_count']}/4 created; {report['loaded_count']}/4 document loads finished; login remains unverified.")
    if result.returncode != 0 or report['created_count'] != 4:
        raise ValueError('Native WebView construction failed')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.TimeoutExpired) as error:
        sys.exit(str(error))
