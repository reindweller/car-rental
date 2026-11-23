"""Bounded, anonymous booking diagnostics. Browser events are untrusted reports."""
import base64
import json
import re
import time
import uuid
from datetime import datetime, timezone

BROWSER_EVENTS = {
    'booking_started', 'progress', 'page_left', 'submit_clicked',
    'payment_form_retry', 'availability_started', 'availability_checked',
    'availability_failed', 'payment_intent_started', 'payment_intent_created',
    'payment_confirmation_started', 'payment_succeeded', 'booking_save_started',
    'booking_confirmed', 'submit_failed',
}
DETAILS = {'vehicleId', 'blockers', 'completedSteps', 'availabilityError', 'deliveryError', 'paymentError',
           'completed', 'available', 'paid', 'stage', 'bookingId', 'status', 'reason', 'requestId'}
BLOCKERS = {'vehicle', 'dates', 'availability', 'vehicle_unavailable', 'location',
            'customer_details', 'agreement', 'payment_form', 'card_details'}


def valid_attempt(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-fA-F-]{36}', value) is not None


def browser_event(payload):
    if not isinstance(payload, dict) or not valid_attempt(payload.get('attemptId')):
        raise ValueError('Invalid booking attempt reference.')
    if payload.get('event') not in BROWSER_EVENTS:
        raise ValueError('Invalid booking event.')
    raw = payload.get('details', {})
    if not isinstance(raw, dict) or len(raw) > 12:
        raise ValueError('Invalid booking event details.')
    details = {}
    for key, value in raw.items():
        if key not in DETAILS or key in {'status', 'reason', 'requestId'}:
            continue
        if key in {'blockers', 'completedSteps'}:
            if not isinstance(value, str) or any(part not in BLOCKERS for part in value.split(',') if part):
                raise ValueError('Invalid booking blockers.')
        elif key == 'stage':
            if value not in {'payment_intent', 'payment_confirmation', 'booking_save'}:
                raise ValueError('Invalid booking stage.')
        elif key == 'bookingId':
            if not isinstance(value, str) or not re.fullmatch(r'BK-[A-Z0-9]{8}', value):
                raise ValueError('Invalid booking reference.')
        elif key == 'vehicleId':
            if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value < 10**16:
                raise ValueError('Invalid vehicle reference.')
        elif not isinstance(value, bool):
            raise ValueError('Invalid booking flag.')
        details[key] = value
    return payload['attemptId'], payload['event'], details


def write_event(table, attempt, event, details, source='server'):
    # Log storage failure must not turn a successful payment/booking into an error.
    now = datetime.now(timezone.utc)
    item = {'day': now.date().isoformat(), 'id': now.isoformat() + '#' + uuid.uuid4().hex,
            'createdAt': now.isoformat(), 'attemptId': attempt, 'event': event,
            'source': source, 'details': details, 'expiresAt': int(time.time()) + 90 * 86400}
    try:
        table.put_item(Item=item)
    except Exception:
        print(json.dumps({'event': 'booking_log_write_failed', 'attemptId': attempt}))


def list_events(table, query):
    day = query.get('day', datetime.now(timezone.utc).date().isoformat())
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day):
        raise ValueError('Use a UTC date in YYYY-MM-DD format.')
    datetime.strptime(day, '%Y-%m-%d')
    args = {'KeyConditionExpression': '#day = :day', 'ExpressionAttributeNames': {'#day': 'day'},
            'ExpressionAttributeValues': {':day': day}, 'Limit': 100, 'ScanIndexForward': False}
    cursor = query.get('cursor')
    if cursor:
        try:
            if len(cursor) > 1024:
                raise ValueError()
            key = json.loads(base64.urlsafe_b64decode(cursor).decode())
            if set(key) != {'day', 'id'} or key['day'] != day or not isinstance(key['id'], str):
                raise ValueError()
            args['ExclusiveStartKey'] = key
        except Exception as error:
            raise ValueError('Invalid logs cursor.') from error
    result = table.query(**args)
    response = {'items': [item for item in result.get('Items', []) if item.get('expiresAt', 0) > time.time()]}
    if result.get('LastEvaluatedKey'):
        response['cursor'] = base64.urlsafe_b64encode(json.dumps(result['LastEvaluatedKey']).encode()).decode()
    return response
