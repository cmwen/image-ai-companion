import copy
import runpy
import unittest

probe = runpy.run_path('scripts/run-auth-smoke.py')

class NativeAuthReportTests(unittest.TestCase):
    def setUp(self):
        self.report = {'kind': 'anonymous-native-auth-smoke', 'schema_version': 1, 'login_verified': False, 'cases': [{'id': case_id, 'created': True, 'timed_out': False, 'hosts': ['accounts.google.com'], **{name: 1 for name in probe['COUNTERS']}} for case_id in probe['EXPECTED_CASES']]}

    def test_keeps_only_sanitized_observations(self):
        self.report['cases'][0]['url'] = 'https://accounts.google.com/?token=private'
        report = probe['sanitized_report'](self.report)
        self.assertEqual(report['created_count'], 4)
        self.assertEqual(report['loaded_count'], 4)
        self.assertFalse(report['login_verified'])
        self.assertNotIn('url', report['cases'][0])

    def test_rejects_auth_success_claims_and_incomplete_case_sets(self):
        self.report['login_verified'] = True
        with self.assertRaises(ValueError):
            probe['sanitized_report'](self.report)
        self.report['login_verified'] = False
        self.report['cases'].pop()
        with self.assertRaises(ValueError):
            probe['sanitized_report'](self.report)

    def test_rejects_sensitive_urls_disguised_as_hostnames(self):
        self.report['cases'][0]['hosts'] = ['https://accounts.google.com/?token=private']
        with self.assertRaises(ValueError):
            probe['sanitized_report'](self.report)

if __name__ == '__main__':
    unittest.main()
