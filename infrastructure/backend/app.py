import base64
import json
import os
import time
import uuid
import math
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urlencode
from urllib.request import Request, urlopen

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from boto3.dynamodb.types import TypeSerializer

dynamodb = boto3.resource("dynamodb")
cognito = boto3.client("cognito-idp")
aws_region = os.environ.get("AWS_REGION", "us-east-2")
s3 = boto3.client(
    "s3",
    region_name=aws_region,
    endpoint_url=f"https://s3.{aws_region}.amazonaws.com",
    config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
)
vehicles_table = dynamodb.Table(os.environ["VEHICLES_TABLE"])
bookings_table = dynamodb.Table(os.environ["BOOKINGS_TABLE"])
user_pool_id = os.environ["USER_POOL_ID"]
photos_bucket = os.environ["PHOTOS_BUCKET"]
allowed_origins = {
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        os.environ.get("ALLOWED_ORIGIN", "http://localhost:4200"),
    ).split(",")
    if origin.strip()
}
roles = {"Administrator", "Manager", "Agent"}
vehicle_statuses = {"Available", "Rented"}
booking_statuses = {"Confirmed", "Active", "Pending", "Completed", "Cancelled"}
blocking_booking_statuses = {"Confirmed", "Active", "Pending"}
photo_extensions = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
max_photo_bytes = 8 * 1024 * 1024
stripe_secret_key = os.environ.get("STRIPE_SECRET_KEY", "")
delivery_radius_miles = 20
agreement_version = "2026-09-28"
geocode_cache = {}
places = boto3.client("geo-places", region_name=aws_region)
florida_bias_position = [-81.5158, 27.6648]


class ConflictError(Exception):
    pass


class Encoder(json.JSONEncoder):
    def default(self, value):
        if isinstance(value, Decimal):
            return int(value) if value % 1 == 0 else float(value)
        return super().default(value)


def allowed_origin_of(event):
    headers = {key.lower(): value for key, value in (event.get("headers") or {}).items()}
    origin = headers.get("origin", "")
    return origin if origin in allowed_origins else None


def response(status, body=None, origin=None):
    headers = {
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Content-Type": "application/json",
        "Vary": "Origin",
    }
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
    return {
        "statusCode": status,
        "headers": headers,
        "body": "" if body is None else json.dumps(body, cls=Encoder),
    }


def redirect(location, origin=None):
    headers = {
        "Cache-Control": "public, max-age=300",
        "Location": location,
        "Vary": "Origin",
    }
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
    return {
        "statusCode": 302,
        "headers": headers,
        "body": "",
    }


def body_of(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    return json.loads(raw, parse_float=Decimal)


def claims_of(event):
    return event.get("requestContext", {}).get("authorizer", {}).get("claims", {}) or {}


def require_admin(event):
    if claims_of(event).get("custom:role") != "Administrator":
        raise PermissionError("Administrator access is required.")


def require_fields(payload, fields):
    missing = [field for field in fields if payload.get(field) in (None, "")]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")


def normalize_photo_urls(payload):
    image_urls = payload.get("imageUrls") or ([payload["imageUrl"]] if payload.get("imageUrl") else [])
    if not isinstance(image_urls, list) or not 1 <= len(image_urls) <= 15:
        raise ValueError("A vehicle must have between 1 and 15 photos.")
    if any(not isinstance(url, str) or not url.startswith(("http://", "https://")) for url in image_urls):
        raise ValueError("Vehicle photos must use valid HTTP(S) URLs.")
    return image_urls


def normalize_pickup_locations(payload):
    locations = payload.get("pickupLocations") or []
    if not isinstance(locations, list) or len(locations) > 15:
        raise ValueError("Pickup locations must be a list of up to 15 addresses.")
    normalized = []
    for location in locations:
        if not isinstance(location, str) or not location.strip() or len(location.strip()) > 250:
            raise ValueError("Each pickup location must be a valid address of up to 250 characters.")
        address = location.strip()
        if address not in normalized:
            normalized.append(address)
    return normalized


def normalize_car_location(payload):
    location = payload.get("carLocation") or ""
    if not isinstance(location, str) or len(location.strip()) > 250:
        raise ValueError("Car location must be an address of up to 250 characters.")
    return location.strip()


def normalize_feature_groups(payload):
    groups = payload.get("features")
    if isinstance(groups, str):
        items = [item.strip() for item in groups.split(",") if item.strip()]
        groups = [{"group": "Vehicle features", "items": items}]
    if not isinstance(groups, list) or not 1 <= len(groups) <= 12:
        raise ValueError("Vehicle features must contain between 1 and 12 groups.")
    normalized = []
    for feature_group in groups:
        if not isinstance(feature_group, dict):
            raise ValueError("Each vehicle feature group must include a header and feature list.")
        group = feature_group.get("group")
        items = feature_group.get("items")
        if not isinstance(group, str) or not group.strip() or len(group.strip()) > 80:
            raise ValueError("Each vehicle feature group needs a header of up to 80 characters.")
        if not isinstance(items, list) or not 1 <= len(items) <= 50:
            raise ValueError("Each vehicle feature group must contain between 1 and 50 features.")
        clean_items = []
        for item in items:
            if not isinstance(item, str) or not item.strip() or len(item.strip()) > 120:
                raise ValueError("Vehicle features must be text up to 120 characters each.")
            value = item.strip()
            if value not in clean_items:
                clean_items.append(value)
        normalized.append({"group": group.strip(), "items": clean_items})
    return normalized


def normalize_included_groups(payload):
    groups = payload.get("included")
    if isinstance(groups, str):
        items = [item.strip() for item in groups.split(",") if item.strip()]
        groups = [{"group": "Included", "items": items}]
    elif isinstance(groups, list) and groups and all(isinstance(item, str) for item in groups):
        groups = [{"group": "Included", "items": groups}]
    if not isinstance(groups, list) or not 1 <= len(groups) <= 12:
        raise ValueError("Included items must contain between 1 and 12 groups.")
    normalized = []
    for included_group in groups:
        if not isinstance(included_group, dict):
            raise ValueError("Each included group must have a header and item list.")
        group = included_group.get("group")
        items = included_group.get("items")
        if not isinstance(group, str) or not group.strip() or len(group.strip()) > 80:
            raise ValueError("Each included group needs a header of up to 80 characters.")
        if not isinstance(items, list) or not 1 <= len(items) <= 50:
            raise ValueError("Each included group must contain between 1 and 50 items.")
        clean_items = []
        for item in items:
            if not isinstance(item, str) or not item.strip() or len(item.strip()) > 120:
                raise ValueError("Included items must be text up to 120 characters each.")
            value = item.strip()
            if value not in clean_items:
                clean_items.append(value)
        normalized.append({"group": group.strip(), "items": clean_items})
    return normalized


def normalize_vehicle_groups(vehicle):
    vehicle["features"] = normalize_feature_groups(vehicle)
    vehicle["included"] = normalize_included_groups(vehicle)
    return vehicle


def scan_all(table):
    items = []
    kwargs = {}
    while True:
        page = table.scan(**kwargs)
        items.extend(page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            return items
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def seed_vehicles():
    if vehicles_table.scan(Select="COUNT", Limit=1).get("Count", 0):
        return
    with open(os.path.join(os.path.dirname(__file__), "seed.json"), encoding="utf-8") as seed_file:
        vehicles = json.load(seed_file, parse_float=Decimal)
    with vehicles_table.batch_writer() as batch:
        for vehicle in vehicles:
            batch.put_item(Item=vehicle)


def list_vehicles():
    seed_vehicles()
    vehicles = [normalize_vehicle_groups(vehicle) for vehicle in scan_all(vehicles_table)]
    return sorted(vehicles, key=lambda item: (item.get("year", 0), item.get("name", "")), reverse=True)


def parse_rental_dates(start_value, end_value):
    try:
        start = datetime.fromisoformat(str(start_value).replace("Z", "+00:00"))
        end = datetime.fromisoformat(str(end_value).replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Enter valid pickup and return dates.") from error
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if end <= start:
        raise ValueError("Return date and time must be after the pickup date and time.")
    return start, end


def unavailable_vehicle_ids(start, end, exclude_booking_id=None):
    unavailable = set()
    for booking in scan_all(bookings_table):
        if booking.get("id") == exclude_booking_id:
            continue
        if booking.get("status") not in blocking_booking_statuses:
            continue
        if not booking.get("vehicleId") or not booking.get("startDate") or not booking.get("endDate"):
            continue
        try:
            booked_start, booked_end = parse_rental_dates(booking["startDate"], booking["endDate"])
        except ValueError:
            continue
        if booked_start < end and booked_end > start:
            unavailable.add(int(booking["vehicleId"]))
    return unavailable


def vehicle_availability(start_value, end_value):
    start, end = parse_rental_dates(start_value, end_value)
    unavailable = unavailable_vehicle_ids(start, end)
    return {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "unavailableVehicleIds": sorted(unavailable),
    }


def geocode_address(address):
    normalized = str(address or "").strip()
    if len(normalized) < 8 or len(normalized) > 200:
        raise ValueError("Enter a complete delivery address of up to 200 characters.")
    if normalized in geocode_cache:
        return geocode_cache[normalized]
    try:
        response_body = places.search_text(
            QueryText=normalized,
            BiasPosition=florida_bias_position,
            MaxResults=1,
        )
    except (BotoCoreError, ClientError) as error:
        raise ValueError("The delivery address could not be checked. Please try again.") from error
    if not response_body.get("ResultItems"):
        raise ValueError("We could not find that delivery address. Check it and try again.")
    match = response_body["ResultItems"][0]
    position = match.get("Position") or []
    if len(position) != 2:
        raise ValueError("We could not find that delivery address. Check it and try again.")
    geocoded = {
        "address": (match.get("Address") or {}).get("Label", match.get("Title", normalized)),
        "latitude": float(position[1]),
        "longitude": float(position[0]),
    }
    if len(geocode_cache) >= 100:
        geocode_cache.clear()
    geocode_cache[normalized] = geocoded
    return geocoded


def delivery_check(payload):
    require_fields(payload, ["vehicleId", "address"])
    vehicle = vehicles_table.get_item(Key={"id": int(payload["vehicleId"])}).get("Item")
    if not vehicle:
        raise ValueError("The selected vehicle was not found.")
    if not vehicle.get("carLocation"):
        raise ValueError("Delivery is unavailable because this vehicle has no home location.")
    origin = geocode_address(vehicle["carLocation"])
    destination = geocode_address(payload["address"])
    lat1, lon1 = math.radians(origin["latitude"]), math.radians(origin["longitude"])
    lat2, lon2 = math.radians(destination["latitude"]), math.radians(destination["longitude"])
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    haversine = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    miles = 3958.7613 * 2 * math.asin(math.sqrt(haversine))
    return {
        "eligible": miles <= delivery_radius_miles,
        "distanceMiles": round(miles, 1),
        "maxDistanceMiles": delivery_radius_miles,
        "address": destination["address"],
    }


def validate_fulfillment(payload, vehicle):
    mode = str(payload.get("fulfillmentMode", "pickup")).lower()
    address = str(payload.get("pickupLocation", "")).strip()
    if mode == "pickup":
        allowed = [vehicle.get("carLocation"), *(vehicle.get("pickupLocations") or [])]
        if not address or address not in allowed:
            raise ValueError("Choose a valid pickup location for this vehicle.")
        return {"mode": mode, "address": address, "distanceMiles": None}
    if mode != "delivery":
        raise ValueError("Choose pickup or delivery.")
    result = delivery_check({"vehicleId": vehicle["id"], "address": address})
    if not result["eligible"]:
        raise ValueError(f"Delivery is limited to {delivery_radius_miles} miles from the vehicle location.")
    return {"mode": mode, "address": result["address"], "distanceMiles": result["distanceMiles"]}


def create_vehicle(payload):
    require_fields(payload, ["name", "year", "trim", "category", "price", "status", "plate"])
    if payload["status"] not in vehicle_statuses:
        raise ValueError("Invalid vehicle status.")
    image_urls = normalize_photo_urls(payload)
    payload["imageUrls"] = image_urls
    payload["imageUrl"] = image_urls[0]
    payload["carLocation"] = normalize_car_location(payload)
    payload["pickupLocations"] = normalize_pickup_locations(payload)
    feature_groups = normalize_feature_groups(payload)
    included_groups = normalize_included_groups(payload)
    identifier = int(time.time() * 1000)
    payload.pop("features", None)
    payload.pop("included", None)
    rules = [item.strip() for item in re.split(r"[\r\n,]+", payload.pop("rules", "")) if item.strip()]
    if not rules:
        raise ValueError("Vehicle features, included items, and rules are required.")
    vehicle = {
        **payload,
        "id": identifier,
        "year": int(payload["year"]),
        "seats": int(payload.get("seats", 5)),
        "mpg": int(payload.get("mpg", 0)),
        "price": Decimal(str(payload["price"])),
        "rating": None,
        "reviewCount": 0,
        "trips": 0,
        "review": "New listing — book this car and be the first to review it.",
        "reviewer": "",
        "turoUrl": "",
        "color": "#e8edf3",
        "emoji": payload["category"],
        "features": feature_groups,
        "included": included_groups,
        "rules": rules,
        "extras": [],
        "reviews": [],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    vehicles_table.put_item(Item=vehicle, ConditionExpression="attribute_not_exists(id)")
    return vehicle


def create_photo_upload(event, payload):
    require_fields(payload, ["contentType", "size"])
    content_type = str(payload["contentType"]).lower()
    if content_type not in photo_extensions:
        raise ValueError("Vehicle photos must be JPEG, PNG, or WebP.")
    size = int(payload["size"])
    if size < 1 or size > max_photo_bytes:
        raise ValueError("Vehicle photos must be no larger than 8 MB.")
    key = f"{uuid.uuid4().hex}.{photo_extensions[content_type]}"
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": photos_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=300,
    )
    domain = event["requestContext"]["domainName"]
    stage = event["requestContext"]["stage"]
    return {
        "uploadUrl": upload_url,
        "imageUrl": f"https://{domain}/{stage}/photos/{key}",
        "expiresIn": 300,
    }


def get_photo(key, origin=None):
    if not key or "/" in key or "." not in key:
        raise ValueError("Invalid photo key.")
    location = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": photos_bucket, "Key": key},
        ExpiresIn=900,
    )
    return redirect(location, origin)


def update_vehicle(identifier, payload):
    payload["id"] = int(identifier)
    if payload.get("status") not in vehicle_statuses:
        raise ValueError("Invalid vehicle status.")
    image_urls = normalize_photo_urls(payload)
    payload["imageUrls"] = image_urls
    payload["imageUrl"] = image_urls[0]
    payload["carLocation"] = normalize_car_location(payload)
    payload["pickupLocations"] = normalize_pickup_locations(payload)
    payload["features"] = normalize_feature_groups(payload)
    payload["included"] = normalize_included_groups(payload)
    payload["updatedAt"] = datetime.now(timezone.utc).isoformat()
    vehicles_table.put_item(Item=payload, ConditionExpression="attribute_exists(id)")
    return payload


def create_vehicle_review(identifier, payload):
    require_fields(payload, ["bookingId", "email", "rating", "body"])
    try:
        vehicle_id = int(identifier)
        rating_value = Decimal(str(payload["rating"]))
        rating = int(rating_value)
    except (InvalidOperation, OverflowError, TypeError, ValueError) as error:
        raise ValueError("Choose a rating from 1 to 5 stars.") from error
    if rating_value != rating or rating < 1 or rating > 5:
        raise ValueError("Choose a rating from 1 to 5 stars.")

    booking_id = str(payload["bookingId"]).strip().upper()
    email = str(payload["email"]).strip().lower()
    body = str(payload["body"]).strip()
    if not re.fullmatch(r"BK-[A-Z0-9]{8}", booking_id) or len(email) > 254:
        raise ValueError("Enter a valid booking ID and booking email.")
    if len(body) < 10 or len(body) > 1000:
        raise ValueError("Your review must be between 10 and 1,000 characters.")

    booking = bookings_table.get_item(Key={"id": booking_id}).get("Item")
    if (
        not booking
        or int(booking.get("vehicleId", 0)) != vehicle_id
        or str(booking.get("email", "")).strip().lower() != email
    ):
        raise ValueError("The booking ID and email do not match a rental for this vehicle.")
    if booking.get("paymentStatus") != "Paid":
        raise ValueError("Only paid rentals can be reviewed.")
    try:
        _start, end = parse_rental_dates(booking.get("startDate"), booking.get("endDate"))
    except ValueError as error:
        raise ValueError("This booking does not have a valid completed rental period.") from error
    if end > datetime.now(timezone.utc):
        raise ValueError("You can review this vehicle after the rental has ended.")
    if booking.get("reviewedAt"):
        raise ConflictError("A review has already been submitted for this booking.")

    vehicle = vehicles_table.get_item(Key={"id": vehicle_id}).get("Item")
    if not vehicle:
        raise ValueError("The vehicle for this booking no longer exists.")

    old_count = int(vehicle.get("reviewCount", 0))
    old_rating = Decimal(str(vehicle.get("rating") or 0))
    new_count = old_count + 1
    new_rating = ((old_rating * old_count + Decimal(rating)) / new_count).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    now = datetime.now(timezone.utc)
    review = {
        "id": uuid.uuid4().hex,
        "author": str(booking.get("customer", "Verified customer")).strip()[:80],
        "date": now.strftime("%b %d, %Y").replace(" 0", " "),
        "rating": rating,
        "body": body,
    }
    reviews = list(vehicle.get("reviews") or [])[-99:] + [review]

    client = bookings_table.meta.client
    serializer = TypeSerializer()
    serialize = serializer.serialize
    try:
        client.transact_write_items(TransactItems=[
            {
                "Update": {
                    "TableName": bookings_table.name,
                    "Key": {"id": serialize(booking_id)},
                    "UpdateExpression": "SET reviewedAt = :now, reviewVehicleId = :vehicle",
                    "ConditionExpression": "attribute_exists(id) AND attribute_not_exists(reviewedAt) AND #email = :email AND vehicleId = :vehicle",
                    "ExpressionAttributeNames": {"#email": "email"},
                    "ExpressionAttributeValues": {
                        ":now": serialize(now.isoformat()),
                        ":vehicle": serialize(vehicle_id),
                        ":email": serialize(booking.get("email", "")),
                    },
                }
            },
            {
                "Update": {
                    "TableName": vehicles_table.name,
                    "Key": {"id": serialize(vehicle_id)},
                    "UpdateExpression": "SET reviews = :reviews, reviewCount = :count, rating = :rating, review = :body, reviewer = :author, updatedAt = :now",
                    "ConditionExpression": "attribute_exists(id) AND reviewCount = :old_count",
                    "ExpressionAttributeValues": {
                        ":reviews": serialize(reviews),
                        ":count": serialize(new_count),
                        ":rating": serialize(new_rating),
                        ":body": serialize(body),
                        ":author": serialize(review["author"]),
                        ":now": serialize(now.isoformat()),
                        ":old_count": serialize(old_count),
                    },
                }
            },
        ])
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "TransactionCanceledException":
            raise ConflictError("This booking was already reviewed, or the ratings changed. Please refresh and try again.") from error
        raise
    return normalize_vehicle_groups(vehicles_table.get_item(Key={"id": vehicle_id}, ConsistentRead=True)["Item"])


def rental_price(payload, exclude_booking_id=None):
    require_fields(payload, ["vehicleId", "startDate", "endDate"])
    start, end = parse_rental_dates(payload["startDate"], payload["endDate"])
    vehicle = vehicles_table.get_item(Key={"id": int(payload["vehicleId"])}).get("Item")
    if not vehicle or vehicle.get("status") != "Available":
        raise ValueError("The selected vehicle is not available.")
    if int(payload["vehicleId"]) in unavailable_vehicle_ids(start, end, exclude_booking_id):
        raise ValueError("The selected vehicle is already booked for those dates.")
    if not isinstance(payload.get("coverage"), bool):
        raise ValueError("Coverage must be true or false.")
    fulfillment = validate_fulfillment(payload, vehicle)
    rental_days = math.ceil((end - start).total_seconds() / 86400)
    subtotal = Decimal(str(vehicle["price"])) * rental_days
    tax = (subtotal * Decimal("0.08")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = (subtotal + tax).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return vehicle, start, end, total, int((total * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)), fulfillment


def stripe_request(method, path, params=None, idempotency_key=None):
    if not stripe_secret_key:
        raise ValueError("Payments are not configured.")
    encoded = urlencode(params or {}).encode()
    request = Request(
        f"https://api.stripe.com/v1{path}",
        data=encoded if method != "GET" else None,
        method=method,
        headers={
            "Authorization": f"Bearer {stripe_secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
            **({"Idempotency-Key": idempotency_key} if idempotency_key else {}),
        },
    )
    try:
        with urlopen(request, timeout=10) as result:
            return json.loads(result.read().decode())
    except HTTPError as error:
        try:
            message = json.loads(error.read().decode()).get("error", {}).get("message")
        except (ValueError, json.JSONDecodeError):
            message = None
        raise ValueError(message or "Stripe could not process the payment request.") from error


def validate_agreement(payload):
    require_fields(payload, ["agreementVersion", "agreementAcceptedAt", "agreementAcceptedBy"])
    if payload.get("agreementAccepted") is not True:
        raise ValueError("The rental agreement must be accepted before payment.")
    if str(payload["agreementVersion"]) != agreement_version:
        raise ValueError("The rental agreement has changed. Review and accept the latest version.")
    accepted_by = " ".join(str(payload["agreementAcceptedBy"]).split())
    if not 2 <= len(accepted_by) <= 120:
        raise ValueError("Enter the renter's full name before accepting the agreement.")
    if payload.get("customer") and accepted_by.casefold() != " ".join(str(payload["customer"]).split()).casefold():
        raise ValueError("The agreement signer must match the renter's name.")
    try:
        accepted_at = datetime.fromisoformat(str(payload["agreementAcceptedAt"]).replace("Z", "+00:00"))
        if accepted_at.tzinfo is None:
            raise ValueError
    except (TypeError, ValueError) as error:
        raise ValueError("The rental agreement acceptance time is invalid.") from error
    now = datetime.now(timezone.utc)
    if (accepted_at - now).total_seconds() > 300 or (now - accepted_at).total_seconds() > 604800:
        raise ValueError("Review and accept the rental agreement again before payment.")


def create_payment_intent(payload):
    validate_agreement(payload)
    vehicle, _start, _end, _total, amount, fulfillment = rental_price(payload)
    params = {
        "amount": amount,
        "currency": "usd",
        "payment_method_types[]": "card",
        "description": f"{vehicle.get('year', '')} {vehicle['name']} rental",
        "metadata[vehicleId]": str(int(payload["vehicleId"])),
        "metadata[startDate]": str(payload["startDate"]),
        "metadata[endDate]": str(payload["endDate"]),
        "metadata[coverage]": str(payload["coverage"]).lower(),
        "metadata[fulfillmentMode]": fulfillment["mode"],
        "metadata[pickupLocation]": fulfillment["address"],
        "metadata[agreementVersion]": agreement_version,
        "metadata[agreementAcceptedAt]": str(payload["agreementAcceptedAt"]),
        "metadata[agreementAcceptedBy]": str(payload["agreementAcceptedBy"]).strip(),
    }
    if str(payload.get("email", "")).strip():
        params["receipt_email"] = str(payload["email"]).strip()
    intent = stripe_request("POST", "/payment_intents", params)
    return {
        "id": intent["id"],
        "clientSecret": intent["client_secret"],
        "amount": amount,
        "currency": intent["currency"],
    }


def create_booking(payload):
    require_fields(payload, ["customer", "email", "phone", "vehicleId", "startDate", "endDate", "paymentIntentId"])
    validate_agreement(payload)
    payment_intent_id = str(payload["paymentIntentId"])
    if not payment_intent_id.startswith("pi_"):
        raise ValueError("Invalid payment reference.")
    existing = next(
        (booking for booking in scan_all(bookings_table) if booking.get("paymentIntentId") == payment_intent_id),
        None,
    )
    if existing:
        return existing
    # A saved booking blocks its own dates; retries must return it before availability checks.
    vehicle, start, end, total, amount, fulfillment = rental_price(payload)
    intent = stripe_request("GET", f"/payment_intents/{quote(payment_intent_id, safe='')}")
    metadata = intent.get("metadata") or {}
    expected_metadata = {
        "vehicleId": str(int(payload["vehicleId"])),
        "startDate": str(payload["startDate"]),
        "endDate": str(payload["endDate"]),
        "coverage": str(payload["coverage"]).lower(),
        "fulfillmentMode": fulfillment["mode"],
        "pickupLocation": fulfillment["address"],
        "agreementVersion": agreement_version,
        "agreementAcceptedAt": str(payload["agreementAcceptedAt"]),
        "agreementAcceptedBy": str(payload["agreementAcceptedBy"]).strip(),
    }
    if intent.get("status") != "succeeded":
        raise ValueError("Payment has not completed.")
    if intent.get("currency") != "usd" or int(intent.get("amount_received", 0)) != amount:
        raise ValueError("The paid amount does not match this booking.")
    if any(metadata.get(key) != value for key, value in expected_metadata.items()):
        raise ValueError("The payment details do not match this booking.")
    identifier = f"BK-{uuid.uuid4().hex[:8].upper()}"
    booking = {
        **payload,
        "id": identifier,
        "vehicleId": int(payload["vehicleId"]),
        "vehicle": vehicle["name"],
        "period": f"{start.strftime('%b %-d, %-I:%M %p')} – {end.strftime('%b %-d, %-I:%M %p')}",
        "total": total,
        "fulfillmentMode": fulfillment["mode"],
        "pickupLocation": fulfillment["address"],
        "deliveryDistanceMiles": fulfillment["distanceMiles"],
        "paymentIntentId": payment_intent_id,
        "paymentStatus": "Paid",
        "paidAmount": total,
        "refundedAmount": Decimal("0"),
        "status": "Confirmed",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    bookings_table.put_item(Item=booking, ConditionExpression="attribute_not_exists(id)")
    return booking


def update_booking(identifier, payload):
    existing = bookings_table.get_item(Key={"id": identifier}, ConsistentRead=True).get("Item")
    if not existing:
        raise ValueError("The booking no longer exists.")
    if payload.get("operation") == "refund":
        return refund_booking(existing, payload)
    if (existing.get("refundOperation") or {}).get("status") not in {None, "succeeded", "failed", "canceled"}:
        raise ConflictError("Finish checking the pending refund before editing this booking.")
    if payload.get("status") not in booking_statuses:
        raise ValueError("Invalid booking status.")
    transitions = {
        "Pending": {"Pending", "Confirmed", "Cancelled"},
        "Confirmed": {"Confirmed", "Active", "Cancelled"},
        "Active": {"Active", "Completed"},
        "Completed": {"Completed"},
        "Cancelled": {"Cancelled"},
    }
    if payload["status"] not in transitions.get(existing.get("status"), set()):
        raise ValueError("This status change is not allowed. Refresh the booking and try again.")
    updates = {"status": payload["status"]}
    rental_fields = ("vehicleId", "startDate", "endDate", "pickupLocation", "fulfillmentMode")
    rental_changed = any(field in payload and payload[field] != existing.get(field) for field in rental_fields)
    if rental_changed:
        if existing["status"] not in {"Pending", "Confirmed"} or payload["status"] not in {"Pending", "Confirmed"}:
            raise ValueError("Only pending or confirmed bookings can be rescheduled or assigned another vehicle.")
        revised = {**existing, **{field: payload[field] for field in rental_fields if field in payload}}
        revised.setdefault("coverage", False)
        vehicle, start, end, total, _amount, fulfillment = rental_price(revised, identifier)
        updates.update({
            **{field: revised[field] for field in rental_fields},
            "vehicle": vehicle["name"], "total": total,
            "period": f"{start.isoformat()} - {end.isoformat()}",
            "pickupLocation": fulfillment["address"], "deliveryDistanceMiles": fulfillment["distanceMiles"],
            "paidAmount": existing.get("paidAmount", existing["total"] if existing.get("paymentStatus") == "Paid" else Decimal("0")),
            "agreementNeedsReview": True,
        })
        if payload.get("quotedTotal") is None or Decimal(str(payload["quotedTotal"])) != total:
            raise ValueError(f"The updated rental total is ${total:.2f}. Review the current vehicle rate and try again.")
    for field, limit in {"customer": 150, "email": 254, "phone": 40, "staffNotes": 4000, "cancellationReason": 1000}.items():
        if field not in payload:
            continue
        if not isinstance(payload[field], str) or len(payload[field].strip()) > limit:
            raise ValueError(f"Invalid {field}.")
        updates[field] = payload[field].strip()
    if "customer" in updates and not updates["customer"]:
        raise ValueError("Customer name is required.")
    if updates.get("customer", existing.get("customer")) != existing.get("customer"):
        updates["agreementNeedsReview"] = True
    if updates.get("email") and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", updates["email"]):
        raise ValueError("Enter a valid email address.")
    if updates["status"] == "Cancelled" and not updates.get("cancellationReason", existing.get("cancellationReason", "")):
        raise ValueError("Enter a cancellation reason.")
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    names = {f"#f{i}": field for i, field in enumerate(updates)}
    values = {f":v{i}": value for i, value in enumerate(updates.values())}
    names["#version"] = "updatedAt"
    names["#status"] = "status"
    values[":status"] = existing["status"]
    condition = "attribute_exists(id) AND #status = :status"
    if "updatedAt" in existing:
        values[":version"] = existing["updatedAt"]
        condition += " AND #version = :version"
    else:
        condition += " AND attribute_not_exists(#version)"
    if payload.get("updatedAt") != existing.get("updatedAt"):
        raise ConflictError("This booking was updated by someone else. Refresh and try again.")
    try:
        result = bookings_table.update_item(
            Key={"id": identifier},
            UpdateExpression="SET " + ", ".join(f"#f{i} = :v{i}" for i in range(len(updates))),
            ExpressionAttributeNames=names, ExpressionAttributeValues=values,
            ConditionExpression=condition, ReturnValues="ALL_NEW",
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            raise ConflictError("This booking changed. Refresh and try again.") from error
        raise
    return result["Attributes"]


def refund_booking(booking, payload):
    identifier = booking["id"]
    operation = booking.get("refundOperation") or {}
    request_id = str(payload.get("requestId", ""))
    if not re.fullmatch(r"[a-f0-9-]{36}", request_id):
        raise ValueError("Invalid refund request ID.")
    if operation.get("id") == request_id and operation.get("status") in {"succeeded", "failed", "canceled"}:
        pass
    elif operation and operation.get("status") not in {"succeeded", "failed", "canceled"}:
        if operation["id"] != request_id:
            raise ConflictError("A refund is already being processed. Refresh and check its status.")
    else:
        if payload.get("updatedAt") != booking.get("updatedAt"):
            raise ConflictError("This booking changed. Refresh before issuing the refund.")
        try:
            amount = Decimal(str(payload.get("amount", "0")))
            valid_amount = amount.is_finite() and amount > 0 and amount == amount.quantize(Decimal("0.01"))
        except InvalidOperation:
            valid_amount = False
        if not valid_amount:
            raise ValueError("Enter a positive refund amount with at most two decimal places.")
        reason = str(payload.get("reason", "")).strip()
        if not reason or len(reason) > 1000:
            raise ValueError("Enter a refund reason of up to 1000 characters.")
        if not booking.get("paymentIntentId"):
            raise ValueError("This booking has no Stripe payment to refund.")
        intent = stripe_request("GET", f"/payment_intents/{quote(booking['paymentIntentId'], safe='')}")
        charge = stripe_request("GET", f"/charges/{quote(str(intent.get('latest_charge', '')), safe='')}")
        if charge.get("currency") != "usd" or int(amount * 100) > charge["amount"] - charge["amount_refunded"]:
            raise ValueError("The refund exceeds the remaining refundable payment.")
        operation = {"id": request_id, "amount": amount, "reason": reason, "status": "processing", "createdAt": datetime.now(timezone.utc).isoformat()}
        names = {"#op": "refundOperation", "#version": "updatedAt"}
        values = {":op": operation, ":now": operation["createdAt"]}
        condition = "attribute_exists(id)"
        if booking.get("updatedAt"):
            condition += " AND #version = :version"
            values[":version"] = booking["updatedAt"]
        else:
            condition += " AND attribute_not_exists(#version)"
        try:
            bookings_table.update_item(Key={"id": identifier}, UpdateExpression="SET #op = :op, #version = :now",
                ExpressionAttributeNames=names, ExpressionAttributeValues=values, ConditionExpression=condition)
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                raise ConflictError("This booking changed. Refresh before issuing the refund.") from error
            raise
    if operation.get("refundId"):
        refund = stripe_request("GET", f"/refunds/{quote(operation['refundId'], safe='')}")
    else:
        if (datetime.now(timezone.utc) - datetime.fromisoformat(operation["createdAt"])).total_seconds() >= 86400:
            raise ValueError("This refund needs reconciliation in Stripe before retrying; its retry window has expired.")
        refund = stripe_request("POST", "/refunds", {
            "payment_intent": booking["paymentIntentId"], "amount": int(operation["amount"] * 100),
            "reason": "requested_by_customer", "metadata[bookingId]": identifier,
            "metadata[staffReason]": operation["reason"][:500],
        }, idempotency_key=f"booking-refund-{identifier}-{operation['id']}")
    operation = {**operation, "refundId": refund["id"], "status": refund["status"]}
    # Persist the Stripe reference before synchronizing totals, so retries retrieve the same refund.
    bookings_table.update_item(Key={"id": identifier}, UpdateExpression="SET refundOperation = :op",
        ConditionExpression="refundOperation.id = :id", ExpressionAttributeValues={":op": operation, ":id": request_id})
    intent = stripe_request("GET", f"/payment_intents/{quote(booking['paymentIntentId'], safe='')}")
    charge = stripe_request("GET", f"/charges/{quote(str(intent['latest_charge']), safe='')}")
    paid = Decimal(charge["amount"]) / 100
    refunded = Decimal(charge["amount_refunded"]) / 100
    result = bookings_table.update_item(Key={"id": identifier},
        UpdateExpression="SET paidAmount = :paid, refundedAmount = :refunded, paymentStatus = :status, updatedAt = :now",
        ConditionExpression="refundOperation.id = :id",
        ExpressionAttributeValues={":paid": paid, ":refunded": refunded,
            ":status": "Refunded" if refunded == paid else "Partially refunded" if refunded else "Paid",
            ":now": datetime.now(timezone.utc).isoformat(), ":id": request_id}, ReturnValues="ALL_NEW")
    return result["Attributes"]


def attributes(user):
    values = {
        attribute["Name"]: attribute["Value"]
        for attribute in (user.get("Attributes") or user.get("UserAttributes") or [])
    }
    status = "Suspended" if not user.get("Enabled", True) else "Invited" if user.get("UserStatus") == "FORCE_CHANGE_PASSWORD" else "Active"
    name = values.get("name") or values.get("email") or user["Username"]
    return {
        "id": user["Username"],
        "name": name,
        "email": values.get("email", ""),
        "role": values.get("custom:role", "Agent"),
        "status": status,
        "initials": "".join(part[0] for part in name.split())[:2].upper(),
        "lastActive": "Invitation sent" if status == "Invited" else user.get("UserLastModifiedDate", datetime.now(timezone.utc)).isoformat(),
    }


def list_users():
    users = []
    token = None
    while True:
        kwargs = {"UserPoolId": user_pool_id, "Limit": 60}
        if token:
            kwargs["PaginationToken"] = token
        page = cognito.list_users(**kwargs)
        users.extend(attributes(user) for user in page.get("Users", []))
        token = page.get("PaginationToken")
        if not token:
            return sorted(users, key=lambda user: user["name"])


def create_user(payload):
    require_fields(payload, ["name", "email", "role"])
    if payload["role"] not in roles:
        raise ValueError("Invalid user role.")
    result = cognito.admin_create_user(
        UserPoolId=user_pool_id,
        Username=payload["email"].strip().lower(),
        UserAttributes=[
            {"Name": "email", "Value": payload["email"].strip().lower()},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "name", "Value": payload["name"].strip()},
            {"Name": "custom:role", "Value": payload["role"]},
        ],
        DesiredDeliveryMediums=["EMAIL"],
    )
    return attributes(result["User"])


def update_user(identifier, payload):
    require_fields(payload, ["name", "email", "role", "status"])
    if payload["role"] not in roles:
        raise ValueError("Invalid user role.")
    cognito.admin_update_user_attributes(
        UserPoolId=user_pool_id,
        Username=identifier,
        UserAttributes=[
            {"Name": "name", "Value": payload["name"].strip()},
            {"Name": "email", "Value": payload["email"].strip().lower()},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "custom:role", "Value": payload["role"]},
        ],
    )
    if payload["status"] == "Suspended":
        cognito.admin_disable_user(UserPoolId=user_pool_id, Username=identifier)
    else:
        cognito.admin_enable_user(UserPoolId=user_pool_id, Username=identifier)
    user = cognito.admin_get_user(UserPoolId=user_pool_id, Username=identifier)
    user["Enabled"] = user.get("Enabled", True)
    return attributes(user)


def delete_user(event, identifier):
    claims = claims_of(event)
    if identifier == claims.get("cognito:username"):
        raise ValueError("You cannot delete your own account.")
    target = next((user for user in list_users() if user["id"] == identifier), None)
    if target and target["role"] == "Administrator":
        admin_count = sum(user["role"] == "Administrator" and user["status"] != "Suspended" for user in list_users())
        if admin_count <= 1:
            raise ValueError("The last active administrator cannot be deleted.")
    cognito.admin_delete_user(UserPoolId=user_pool_id, Username=identifier)


def handler(event, _context):
    method = event.get("httpMethod", "")
    path = event.get("resource", event.get("path", ""))
    identifier = unquote((event.get("pathParameters") or {}).get("id", ""))
    origin = allowed_origin_of(event)

    def reply(status, body=None):
        return response(status, body, origin)

    try:
        if method == "OPTIONS":
            return reply(204)
        if path == "/vehicles" and method == "GET":
            return reply(200, list_vehicles())
        if path == "/availability" and method == "GET":
            query = event.get("queryStringParameters") or {}
            return reply(200, vehicle_availability(query.get("start"), query.get("end")))
        if path == "/delivery/check" and method == "POST":
            return reply(200, delivery_check(body_of(event)))
        if path == "/vehicles" and method == "POST":
            return reply(201, create_vehicle(body_of(event)))
        if path == "/vehicles/{id}" and method == "PUT":
            return reply(200, update_vehicle(identifier, body_of(event)))
        if path == "/vehicles/{id}" and method == "DELETE":
            vehicles_table.delete_item(Key={"id": int(identifier)}, ConditionExpression="attribute_exists(id)")
            return reply(204)
        if path == "/vehicles/{id}/reviews" and method == "POST":
            return reply(201, create_vehicle_review(identifier, body_of(event)))
        if path == "/uploads" and method == "POST":
            return reply(201, create_photo_upload(event, body_of(event)))
        if path == "/photos/{key}" and method == "GET":
            return get_photo(unquote((event.get("pathParameters") or {}).get("key", "")), origin)
        if path == "/payments/intents" and method == "POST":
            return reply(201, create_payment_intent(body_of(event)))
        if path == "/bookings" and method == "POST":
            return reply(201, create_booking(body_of(event)))
        if path == "/bookings" and method == "GET":
            items = sorted(scan_all(bookings_table), key=lambda item: item.get("createdAt", ""), reverse=True)
            return reply(200, items)
        if path == "/bookings/{id}" and method == "PUT":
            return reply(200, update_booking(identifier, body_of(event)))
        if path.startswith("/users"):
            require_admin(event)
            if path == "/users" and method == "GET":
                return reply(200, list_users())
            if path == "/users" and method == "POST":
                return reply(201, create_user(body_of(event)))
            if path == "/users/{id}" and method == "PUT":
                return reply(200, update_user(identifier, body_of(event)))
            if path == "/users/{id}" and method == "DELETE":
                delete_user(event, identifier)
                return reply(204)
        return reply(404, {"message": "Route not found."})
    except PermissionError as error:
        return reply(403, {"message": str(error)})
    except ConflictError as error:
        return reply(409, {"message": str(error)})
    except (ValueError, KeyError) as error:
        return reply(400, {"message": str(error)})
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code == "ConditionalCheckFailedException":
            return reply(404, {"message": "The requested record was not found."})
        if code in {"UsernameExistsException", "AliasExistsException"}:
            return reply(409, {"message": "A Cognito user with that email already exists."})
        print(json.dumps(error.response, default=str))
        return reply(500, {"message": "AWS could not complete the request."})
    except Exception as error:
        print(repr(error))
        return reply(500, {"message": "An unexpected backend error occurred."})
