"""Isolated booking logic tests. No AWS credentials or Stripe calls are needed."""
import ast
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
import math
import re
import unittest
from unittest.mock import MagicMock
from urllib.parse import quote


class ClientError(Exception):
    def __init__(self, code):
        self.response = {"Error": {"Code": code}}


class BookingManagementTests(unittest.TestCase):
    def setUp(self):
        source = ast.parse(Path(__file__).with_name('app.py').read_text(encoding='utf-8-sig'))
        functions = {'create_booking', 'update_booking', 'refund_booking', 'rental_price', 'unavailable_vehicle_ids', 'parse_rental_dates', 'require_fields', 'ConflictError'}
        module = ast.Module(body=[node for node in source.body if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in functions], type_ignores=[])
        self.ns = dict(datetime=datetime, timezone=timezone, Decimal=Decimal, InvalidOperation=InvalidOperation, ROUND_HALF_UP=ROUND_HALF_UP, math=math, re=re, quote=quote,
            ClientError=ClientError, booking_statuses={'Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled'},
            blocking_booking_statuses={'Pending', 'Confirmed', 'Active'})
        exec(compile(module, 'app.py', 'exec'), self.ns)
        self.booking = {'id': 'BK-TEST1234', 'status': 'Confirmed', 'customer': 'Test Customer', 'email': 'test@example.com',
            'total': Decimal('100'), 'paymentStatus': 'Paid', 'paymentIntentId': 'pi_test', 'vehicleId': 1,
            'startDate': '2026-10-01T10:00', 'endDate': '2026-10-03T10:00', 'fulfillmentMode': 'pickup', 'pickupLocation': 'Airport'}
        self.table = MagicMock()
        self.table.get_item.side_effect = lambda **kw: {'Item': deepcopy(self.booking)}
        self.table.update_item.side_effect = self.update_item
        self.ns['bookings_table'] = self.table
        self.ns['vehicles_table'] = MagicMock()
        self.ns['stripe_request'] = MagicMock()
        self.ns['scan_all'] = lambda table: [deepcopy(self.booking)]
        self.ns['validate_fulfillment'] = lambda payload, vehicle: {'mode': 'pickup', 'address': 'Airport', 'distanceMiles': None}

    def update_item(self, **kwargs):
        names = kwargs.get('ExpressionAttributeNames', {})
        values = kwargs['ExpressionAttributeValues']
        for assignment in kwargs['UpdateExpression'].removeprefix('SET ').split(', '):
            field, value = assignment.split(' = ')
            self.booking[names.get(field, field)] = deepcopy(values[value])
        return {'Attributes': deepcopy(self.booking)}

    def update(self, **changes):
        return self.ns['update_booking'](self.booking['id'], {**deepcopy(self.booking), **changes})

    def test_protects_payment_and_agreement_fields(self):
        self.booking['agreementAcceptedBy'] = 'Original signer'
        saved = self.update(total=1, paymentStatus='Refunded', paymentIntentId='pi_other', agreementAcceptedBy='Forged', staffNotes='Checked license')
        self.assertEqual(saved['total'], Decimal('100'))
        self.assertEqual(saved['paymentIntentId'], 'pi_test')
        self.assertEqual(saved['agreementAcceptedBy'], 'Original signer')
        self.assertEqual(saved['staffNotes'], 'Checked license')

    def test_duplicate_payment_returns_saved_booking_even_when_dates_are_blocked(self):
        self.ns['validate_agreement'] = MagicMock()
        self.ns['vehicles_table'].get_item.return_value = {'Item': {'id': 1, 'status': 'Available', 'price': Decimal('50')}}
        start, end = self.ns['parse_rental_dates'](self.booking['startDate'], self.booking['endDate'])
        self.assertIn(1, self.ns['unavailable_vehicle_ids'](start, end))
        saved = self.ns['create_booking']({**deepcopy(self.booking), 'phone': '+12025550123', 'coverage': False})
        self.assertEqual(saved, self.booking)
        self.table.put_item.assert_not_called()
        self.ns['stripe_request'].assert_not_called()

    def test_new_payment_still_rejects_conflicting_booking(self):
        self.ns['validate_agreement'] = MagicMock()
        self.ns['vehicles_table'].get_item.return_value = {'Item': {'id': 1, 'status': 'Available', 'price': Decimal('50')}}
        with self.assertRaisesRegex(ValueError, 'already booked'):
            self.ns['create_booking']({**deepcopy(self.booking), 'phone': '+12025550123', 'coverage': False, 'paymentIntentId': 'pi_new'})
        self.table.put_item.assert_not_called()
        self.ns['stripe_request'].assert_not_called()

    def test_cancel_requires_reason_and_releases_availability(self):
        with self.assertRaisesRegex(ValueError, 'cancellation reason'):
            self.update(status='Cancelled')
        saved = self.update(status='Cancelled', cancellationReason='Customer request')
        self.assertEqual(saved['paymentStatus'], 'Paid')
        start, end = self.ns['parse_rental_dates'](saved['startDate'], saved['endDate'])
        self.assertEqual(self.ns['unavailable_vehicle_ids'](start, end), set())

    def test_terminal_booking_cannot_be_reopened(self):
        self.booking['status'] = 'Completed'
        with self.assertRaisesRegex(ValueError, 'status change'):
            self.update(status='Active')

    def test_stale_update_is_rejected(self):
        self.booking['updatedAt'] = 'new-version'
        with self.assertRaises(self.ns['ConflictError']):
            self.update(updatedAt='old-version')
        self.table.update_item.assert_not_called()

    def test_rescheduling_reprices_without_changing_amount_paid(self):
        self.ns['vehicles_table'].get_item.return_value = {'Item': {'id': 1, 'name': 'Car', 'status': 'Available', 'price': Decimal('50')}}
        saved = self.update(endDate='2026-10-04T10:00', quotedTotal=150)
        self.assertEqual(saved['total'], Decimal('150'))
        self.assertEqual(saved['paidAmount'], Decimal('100'))
        self.assertTrue(saved['agreementNeedsReview'])

    def test_vehicle_conflict_rejected(self):
        self.ns['vehicles_table'].get_item.return_value = {'Item': {'id': 2, 'name': 'Other car', 'status': 'Available', 'price': Decimal('50')}}
        self.ns['scan_all'] = lambda table: [self.booking, {**self.booking, 'id': 'OTHER', 'vehicleId': 2}]
        with self.assertRaisesRegex(ValueError, 'already booked'):
            self.update(vehicleId=2, quotedTotal=100)

    def test_refund_retries_reuse_idempotency_key_and_sync_totals(self):
        request_id = '12345678-1234-1234-1234-123456789abc'
        def stripe(method, path, params=None, **kwargs):
            if path.startswith('/payment_intents/'): return {'latest_charge': 'ch_test'}
            if path.startswith('/charges/'): return {'amount': 10000, 'amount_refunded': 2500 if self.booking.get('refundOperation', {}).get('refundId') else 0, 'currency': 'usd'}
            if path.startswith('/refunds'):
                if method == 'POST':
                    self.assertIn('refundOperation', self.booking)
                    self.assertEqual(kwargs['idempotency_key'], f'booking-refund-BK-TEST1234-{request_id}')
                return {'id': 're_test', 'status': 'succeeded'}
        self.ns['stripe_request'].side_effect = stripe
        payload = {'operation': 'refund', 'requestId': request_id, 'amount': 25, 'reason': 'Customer request'}
        saved = self.ns['update_booking'](self.booking['id'], payload)
        self.assertEqual(saved['refundedAmount'], Decimal('25'))
        self.assertEqual(saved['paymentStatus'], 'Partially refunded')
        self.ns['update_booking'](self.booking['id'], payload)
        posts = [call for call in self.ns['stripe_request'].call_args_list if call.args[0] == 'POST']
        self.assertEqual(len(posts), 1)

    def test_refund_overpayment_rejected_before_writing(self):
        self.ns['stripe_request'].side_effect = [{'latest_charge': 'ch_test'}, {'amount': 10000, 'amount_refunded': 8000, 'currency': 'usd'}]
        with self.assertRaisesRegex(ValueError, 'exceeds'):
            self.ns['refund_booking'](self.booking, {'requestId': '12345678-1234-1234-1234-123456789abc', 'amount': 30, 'reason': 'Refund'})
        self.table.update_item.assert_not_called()

    def test_pending_refund_prevents_edits(self):
        self.booking['refundOperation'] = {'id': 'request', 'status': 'pending'}
        with self.assertRaises(self.ns['ConflictError']):
            self.update(staffNotes='Edit during refund')

    def test_invalid_refund_amounts_are_rejected(self):
        for amount in ['NaN', 'Infinity', 'abc', None, '-1', '0', '1.001']:
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                self.ns['refund_booking'](self.booking, {'requestId': '12345678-1234-1234-1234-123456789abc', 'amount': amount, 'reason': 'Refund'})
        self.table.update_item.assert_not_called()

    def test_refund_network_failure_keeps_durable_request_for_retry(self):
        request_id = '12345678-1234-1234-1234-123456789abc'
        self.ns['stripe_request'].side_effect = [{'latest_charge': 'ch_test'}, {'amount': 10000, 'amount_refunded': 0, 'currency': 'usd'}, TimeoutError('Network timeout')]
        with self.assertRaises(TimeoutError):
            self.ns['refund_booking'](deepcopy(self.booking), {'requestId': request_id, 'amount': 25, 'reason': 'Refund'})
        self.assertEqual(self.booking['refundOperation']['id'], request_id)
        self.assertEqual(self.booking['refundOperation']['status'], 'processing')
        self.ns['stripe_request'].side_effect = [{'id': 're_test', 'status': 'pending'}, {'latest_charge': 'ch_test'}, {'amount': 10000, 'amount_refunded': 0}]
        self.ns['refund_booking'](deepcopy(self.booking), {'requestId': request_id})
        self.assertEqual(self.booking['refundOperation']['status'], 'pending')


if __name__ == '__main__':
    unittest.main()
