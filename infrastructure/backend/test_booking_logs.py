import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import unittest
from unittest.mock import MagicMock
import booking_logs as logs

class BookingLogsTests(unittest.TestCase):
    def test_rejects_invalid_events_and_arbitrary_text(self):
        for details in [{'blockers': 'email@example.com'}, {'stage': 'secret'}, {'completed': 'yes'}]:
            with self.assertRaises(ValueError):
                logs.browser_event({'attemptId': 'a' * 36, 'event': 'progress', 'details': details})
        with self.assertRaises(ValueError):
            logs.browser_event({'attemptId': 'a' * 36, 'event': 'api_succeeded'})

    def test_only_safe_details_are_kept(self):
        result = logs.browser_event({'attemptId': 'a' * 36, 'event': 'progress', 'details': {
            'blockers': 'dates,agreement', 'email': 'secret@example.com', 'clientSecret': 'secret', 'completed': False}})
        self.assertEqual(result[2], {'blockers': 'dates,agreement', 'completed': False})

    def test_storage_failure_does_not_break_checkout(self):
        table = MagicMock(); table.put_item.side_effect = RuntimeError('offline')
        logs.write_event(table, 'a' * 36, 'api_failed', {'status': 500})

    def test_retention_and_pagination(self):
        table = MagicMock()
        logs.write_event(table, 'a' * 36, 'progress', {}, 'browser')
        item = table.put_item.call_args.kwargs['Item']
        self.assertEqual(item['source'], 'browser')
        self.assertGreater(item['expiresAt'], logs.time.time() + 89 * 86400)
        key = {'day': item['day'], 'id': item['id']}
        table.query.return_value = {'Items': [item], 'LastEvaluatedKey': key}
        page = logs.list_events(table, {'day': item['day']})
        logs.list_events(table, {'day': item['day'], 'cursor': page['cursor']})
        self.assertEqual(table.query.call_args.kwargs['ExclusiveStartKey'], key)
        with self.assertRaises(ValueError):
            logs.list_events(table, {'day': '2000-01-01', 'cursor': page['cursor']})

class BookingLogAccessTests(unittest.TestCase):
    def setUp(self):
        import ast
        from urllib.parse import unquote
        source = ast.parse(Path(__file__).with_name('app.py').read_text(encoding='utf-8-sig'))
        module = ast.Module(body=[node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in {'handle_request', 'claims_of'}], type_ignores=[])
        self.list = MagicMock(return_value={'items': []})
        self.ns = {'unquote': unquote, 'allowed_origin_of': lambda event: None,
                   'response': lambda status, body=None, origin=None: {'statusCode': status, 'body': body},
                   'roles': {'Administrator', 'Manager', 'Agent'}, 'logs_table': MagicMock(), 'list_events': self.list}
        exec(compile(module, 'app.py', 'exec'), self.ns)

    def test_anonymous_read_is_denied_by_backend(self):
        result = self.ns['handle_request']({'httpMethod': 'GET', 'resource': '/booking-logs'}, None)
        self.assertEqual(result['statusCode'], 403)
        self.list.assert_not_called()

    def test_all_staff_roles_can_read(self):
        for role in ('Agent', 'Manager', 'Administrator'):
            result = self.ns['handle_request']({'httpMethod': 'GET', 'resource': '/booking-logs',
                'requestContext': {'authorizer': {'claims': {'sub': 'staff', 'custom:role': role}}}}, None)
            self.assertEqual(result['statusCode'], 200)

if __name__ == '__main__': unittest.main()
