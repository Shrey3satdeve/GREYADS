from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, hashlib, base64, json
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from bson import ObjectId
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

SECRET_KEY = os.environ.get('SECRET_KEY') or 'greyads-fallback-dev-key-not-for-production'
if SECRET_KEY == 'greyads-fallback-dev-key-not-for-production':
    logger.warning("⚠️  SECRET_KEY not set in environment — using dev fallback. Set SECRET_KEY in .env for production!")
ALGORITHM = "HS256"

# ============ PhonePe Config (Test/Sandbox) ============
PHONEPE_MERCHANT_ID = "PGTESTPAYUAT86"
PHONEPE_SALT_KEY = "96434309-7796-489d-8924-ab56988a6076"
PHONEPE_SALT_INDEX = "1"
PHONEPE_BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox"

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ PyObjectId & BaseDocument ============
def validate_object_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    raise ValueError("Invalid ObjectId")

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]

class BaseDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

    def to_mongo(self):
        d = self.model_dump(by_alias=True, exclude_none=True)
        if "_id" in d and d["_id"]:
            d["_id"] = ObjectId(d["_id"])
        return d

    @classmethod
    def from_mongo(cls, data):
        if data is None:
            return None
        if "_id" in data:
            data["_id"] = str(data["_id"])
        return cls(**data)

# ============ Database Models ============
class User(BaseDocument):
    name: str
    email: str
    password_hash: str
    role: str = "user"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Event(BaseDocument):
    title: str
    description: str
    date: datetime
    venue: str
    cover_image_url: str
    category: str
    price: float
    currency: str = "INR"
    total_tickets: int
    available_tickets: int
    organizer_name: str
    tags: List[str] = []
    status: str = "upcoming"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Ticket(BaseDocument):
    event_id: str
    user_id: str
    user_name: str
    user_email: str
    event_title: str
    event_date: datetime
    event_venue: str
    qr_token: str
    booking_ref: str
    status: str = "valid"
    quantity: int = 1
    total_price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScanLog(BaseDocument):
    ticket_id: str
    qr_token: str
    scanner_id: str
    scanner_name: str
    event_id: str
    event_title: str
    attendee_name: str
    status: str
    note: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ Request Models ============
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class BookTicketRequest(BaseModel):
    event_id: str
    quantity: int = 1

class VerifyQRRequest(BaseModel):
    qr_token: str

class CreateEventRequest(BaseModel):
    title: str
    description: str
    date: str
    venue: str
    cover_image_url: Optional[str] = None
    cover_image_data: Optional[str] = None   # base64 poster upload
    category: str
    price: float
    total_tickets: int
    organizer_name: str
    tags: List[str] = []

class PaymentInitiateRequest(BaseModel):
    event_id: str
    quantity: int = 1
    mobile: Optional[str] = "9999999999"

class PaymentWebhookRequest(BaseModel):
    response: Optional[str] = None

# ============ Auth Helpers ============
def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        return User.from_mongo(user_doc)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_staff(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    return current_user

# ============ Formatters ============
def fmt_event(e: dict) -> dict:
    return {
        "id": str(e["_id"]),
        "title": e["title"],
        "description": e["description"],
        "date": e["date"].isoformat() if hasattr(e.get("date"), "isoformat") else str(e.get("date", "")),
        "venue": e["venue"],
        "cover_image_url": e["cover_image_url"],
        "category": e["category"],
        "price": e["price"],
        "currency": e.get("currency", "INR"),
        "total_tickets": e["total_tickets"],
        "available_tickets": e["available_tickets"],
        "organizer_name": e["organizer_name"],
        "tags": e.get("tags", []),
        "status": e.get("status", "upcoming"),
    }

def fmt_ticket(t: dict) -> dict:
    return {
        "id": str(t["_id"]),
        "event_id": t.get("event_id"),
        "user_id": t.get("user_id"),
        "user_name": t.get("user_name"),
        "user_email": t.get("user_email"),
        "event_title": t.get("event_title"),
        "event_date": t["event_date"].isoformat() if hasattr(t.get("event_date"), "isoformat") else str(t.get("event_date", "")),
        "event_venue": t.get("event_venue"),
        "qr_token": t.get("qr_token"),
        "booking_ref": t.get("booking_ref"),
        "status": t.get("status", "valid"),
        "quantity": t.get("quantity", 1),
        "total_price": t.get("total_price", 0),
        "created_at": t["created_at"].isoformat() if hasattr(t.get("created_at"), "isoformat") else str(t.get("created_at", "")),
    }

# ============ Auth Routes ============
@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(name=req.name, email=req.email, password_hash=hash_password(req.password), phone=req.phone, role="user")
    result = await db.users.insert_one(user.to_mongo())
    user.id = str(result.inserted_id)
    token = create_token(user.id, user.email, user.role)
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "phone": user.phone, "avatar_url": user.avatar_url}}

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user_doc = await db.users.find_one({"email": req.email})
    if not user_doc or not verify_password(req.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = User.from_mongo(user_doc)
    token = create_token(user.id, user.email, user.role)
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "phone": user.phone, "avatar_url": user.avatar_url}}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email, "role": current_user.role, "phone": current_user.phone, "avatar_url": current_user.avatar_url}

# ============ Event Routes ============
@api_router.get("/events")
async def list_events(category: Optional[str] = None, search: Optional[str] = None, limit: int = 20, skip: int = 0):
    query: dict = {}
    if category and category != "All":
        query["category"] = category
    if search:
        query["$or"] = [{"title": {"$regex": search, "$options": "i"}}, {"venue": {"$regex": search, "$options": "i"}}]
    events = await db.events.find(query).skip(skip).limit(limit).to_list(limit)
    return {"events": [fmt_event(e) for e in events]}

@api_router.get("/events/{event_id}")
async def get_event(event_id: str):
    try:
        event = await db.events.find_one({"_id": ObjectId(event_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"event": fmt_event(event)}

@api_router.post("/events")
async def create_event(req: CreateEventRequest, current_user: User = Depends(require_admin)):
    event_date = datetime.fromisoformat(req.date.replace('Z', '+00:00'))
    # Determine cover image: uploaded poster takes priority over URL
    cover_url = req.cover_image_url or ''
    if req.cover_image_data:
        # Store base64 data URI directly
        cover_url = req.cover_image_data
    elif not cover_url:
        # Default by category
        defaults = {
            'Music': 'https://images.unsplash.com/photo-1571751239008-50cad6cb9265?w=800&q=80',
            'Technology': 'https://images.unsplash.com/photo-1540317228636-69a076b0b248?w=800&q=80',
            'Food': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
            'Business': 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80',
            'Sports': 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80',
            'Arts': 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80',
            'Fashion': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
        }
        cover_url = defaults.get(req.category, defaults['Music'])
    event = Event(title=req.title, description=req.description, date=event_date, venue=req.venue,
                  cover_image_url=cover_url, category=req.category, price=req.price,
                  total_tickets=req.total_tickets, available_tickets=req.total_tickets,
                  organizer_name=req.organizer_name, tags=req.tags)
    result = await db.events.insert_one(event.to_mongo())
    created = await db.events.find_one({"_id": result.inserted_id})
    return {"event": fmt_event(created)}

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: User = Depends(require_admin)):
    await db.events.delete_one({"_id": ObjectId(event_id)})
    return {"success": True}

# ============ Ticket Routes ============
@api_router.post("/tickets/book")
async def book_ticket(req: BookTicketRequest, current_user: User = Depends(get_current_user)):
    try:
        event_doc = await db.events.find_one({"_id": ObjectId(req.event_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    if not event_doc:
        raise HTTPException(status_code=404, detail="Event not found")
    event = Event.from_mongo(dict(event_doc))
    if event.available_tickets < req.quantity:
        raise HTTPException(status_code=400, detail="Not enough tickets available")
    ticket = Ticket(
        event_id=req.event_id, user_id=current_user.id, user_name=current_user.name,
        user_email=current_user.email, event_title=event.title, event_date=event.date,
        event_venue=event.venue, qr_token=str(uuid.uuid4()),
        booking_ref=f"GRY-{uuid.uuid4().hex[:6].upper()}",
        quantity=req.quantity, total_price=event.price * req.quantity
    )
    result = await db.tickets.insert_one(ticket.to_mongo())
    await db.events.update_one({"_id": ObjectId(req.event_id)}, {"$inc": {"available_tickets": -req.quantity}})
    created = await db.tickets.find_one({"_id": result.inserted_id})
    return {"ticket": fmt_ticket(created)}

@api_router.get("/tickets/my")
async def my_tickets(current_user: User = Depends(get_current_user)):
    tickets = await db.tickets.find({"user_id": current_user.id}).sort("created_at", -1).to_list(100)
    return {"tickets": [fmt_ticket(t) for t in tickets]}

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: User = Depends(get_current_user)):
    try:
        ticket_doc = await db.tickets.find_one({"_id": ObjectId(ticket_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    if not ticket_doc:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket = Ticket.from_mongo(dict(ticket_doc))
    if ticket.user_id != current_user.id and current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"ticket": fmt_ticket(ticket_doc)}

# ============ Scanner Routes ============
@api_router.post("/scanner/verify")
async def verify_ticket(req: VerifyQRRequest, current_user: User = Depends(require_staff)):
    ticket_doc = await db.tickets.find_one({"qr_token": req.qr_token})
    if not ticket_doc:
        log = ScanLog(ticket_id="unknown", qr_token=req.qr_token, scanner_id=current_user.id,
                      scanner_name=current_user.name, event_id="unknown", event_title="Unknown",
                      attendee_name="Unknown", status="invalid", note="QR token not found")
        await db.scan_logs.insert_one(log.to_mongo())
        return {"status": "invalid", "message": "Invalid QR code — ticket not found"}
    ticket = Ticket.from_mongo(dict(ticket_doc))
    if ticket.status == "used":
        log = ScanLog(ticket_id=ticket.id or "unknown", qr_token=req.qr_token, scanner_id=current_user.id,
                      scanner_name=current_user.name, event_id=ticket.event_id, event_title=ticket.event_title,
                      attendee_name=ticket.user_name, status="already_used", note="Ticket already used")
        await db.scan_logs.insert_one(log.to_mongo())
        return {"status": "already_used", "message": "Ticket already used", "ticket": fmt_ticket(ticket_doc)}
    if ticket.status == "cancelled":
        return {"status": "invalid", "message": "Ticket has been cancelled"}
    await db.tickets.update_one({"qr_token": req.qr_token}, {"$set": {"status": "used"}})
    log = ScanLog(ticket_id=ticket.id or "unknown", qr_token=req.qr_token, scanner_id=current_user.id,
                  scanner_name=current_user.name, event_id=ticket.event_id, event_title=ticket.event_title,
                  attendee_name=ticket.user_name, status="success")
    await db.scan_logs.insert_one(log.to_mongo())
    updated_doc = dict(ticket_doc)
    updated_doc["status"] = "used"
    return {"status": "success", "message": "Ticket verified successfully", "ticket": fmt_ticket(updated_doc)}

@api_router.get("/scanner/history")
async def scan_history(current_user: User = Depends(require_staff)):
    logs = await db.scan_logs.find({"scanner_id": current_user.id}).sort("timestamp", -1).to_list(50)
    return {"logs": [{"id": str(l["_id"]), "qr_token": l.get("qr_token", ""), "event_title": l.get("event_title", ""),
                      "attendee_name": l.get("attendee_name", ""), "status": l["status"],
                      "note": l.get("note"), "timestamp": l["timestamp"].isoformat()} for l in logs]}

# ============ Admin Routes ============
@api_router.get("/admin/stats")
async def admin_stats(current_user: User = Depends(require_admin)):
    total_events = await db.events.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    total_tickets = await db.tickets.count_documents({})
    # Use aggregation pipeline for revenue calculation (efficient - no full doc load)
    revenue_result = await db.tickets.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$total_price"}}}
    ]).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    todays_scans = await db.scan_logs.count_documents({"timestamp": {"$gte": today_start}})
    recent_events = await db.events.find().sort("created_at", -1).limit(5).to_list(5)
    return {"total_events": total_events, "total_users": total_users, "total_tickets": total_tickets,
            "total_revenue": total_revenue, "todays_scans": todays_scans,
            "recent_events": [fmt_event(e) for e in recent_events]}

@api_router.get("/admin/users")
async def admin_users(current_user: User = Depends(require_admin)):
    users = await db.users.find().sort("created_at", -1).to_list(100)
    return {"users": [{"id": str(u["_id"]), "name": u["name"], "email": u["email"], "role": u["role"],
                       "phone": u.get("phone"),
                       "created_at": u["created_at"].isoformat() if hasattr(u.get("created_at"), "isoformat") else ""} for u in users]}

@api_router.get("/admin/tickets")
async def admin_tickets(current_user: User = Depends(require_admin)):
    tickets = await db.tickets.find().sort("created_at", -1).to_list(100)
    return {"tickets": [fmt_ticket(t) for t in tickets]}

# ============ Seed Data ============
@api_router.post("/seed")
async def seed_data():
    count = await db.events.count_documents({})
    if count > 0:
        return {"message": "Already seeded", "events": count}
    users = [
        {"name": "Alex Johnson", "email": "user@test.com", "password": "Test@123", "role": "user"},
        {"name": "Jake Turner", "email": "staff@greyads.com", "password": "Staff@123", "role": "staff"},
        {"name": "Sarah Chen", "email": "admin@greyads.com", "password": "Admin@123", "role": "admin"},
    ]
    user_ids = {}
    for u in users:
        user = User(name=u["name"], email=u["email"], password_hash=hash_password(u["password"]), role=u["role"])
        result = await db.users.insert_one(user.to_mongo())
        user_ids[u["email"]] = str(result.inserted_id)

    events_data = [
        {"title": "Neon Dreams Music Festival", "description": "An unforgettable night of electronic music, live performances, and mesmerizing light shows. Join thousands of music lovers under the open sky for a cinematic audio-visual experience.", "date": datetime(2026, 3, 14, 20, 0, tzinfo=timezone.utc), "venue": "MMRDA Grounds, BKC, Mumbai", "cover_image_url": "https://images.unsplash.com/photo-1571751239008-50cad6cb9265?w=800&q=80", "category": "Music", "price": 999, "total_tickets": 500, "organizer_name": "GreyAdz Events", "tags": ["music", "festival", "electronic"]},
        {"title": "Tech Summit 2026", "description": "Connect with India's brightest minds in technology. World-class keynotes, hands-on workshops, and high-value networking with top founders and VCs shaping the future.", "date": datetime(2026, 3, 19, 9, 0, tzinfo=timezone.utc), "venue": "Bombay Exhibition Centre, Goregaon", "cover_image_url": "https://images.unsplash.com/photo-1540317228636-69a076b0b248?w=800&q=80", "category": "Technology", "price": 1499, "total_tickets": 300, "organizer_name": "TechIndia", "tags": ["tech", "startup", "networking"]},
        {"title": "Street Food Carnival", "description": "Discover 50+ vendors serving the best street food from across India. Live music, cultural performances, and culinary delights in a vibrant outdoor setting.", "date": datetime(2026, 3, 22, 12, 0, tzinfo=timezone.utc), "venue": "Phoenix Mills, Lower Parel", "cover_image_url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80", "category": "Food", "price": 299, "total_tickets": 800, "organizer_name": "Foodie Collective", "tags": ["food", "culture", "street food"]},
        {"title": "Startup Pitch Night", "description": "Watch 10 of India's most promising startups pitch to leading investors. Network, learn, and get inspired by the next generation of founders.", "date": datetime(2026, 3, 26, 18, 0, tzinfo=timezone.utc), "venue": "WeWork BKC, Bandra Kurla Complex", "cover_image_url": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80", "category": "Business", "price": 499, "total_tickets": 150, "organizer_name": "Startup Grind Mumbai", "tags": ["startup", "pitching", "investors"]},
        {"title": "Midnight Rave", "description": "The city's most exclusive after-hours party. World-class DJs, premium cocktails, and an electric atmosphere that goes until dawn.", "date": datetime(2026, 3, 28, 22, 0, tzinfo=timezone.utc), "venue": "Kitty Su, The Lalit, Andheri", "cover_image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80", "category": "Music", "price": 799, "total_tickets": 200, "organizer_name": "Club Collective", "tags": ["party", "nightlife", "music"]},
    ]
    event_ids = []
    for e in events_data:
        event = Event(title=e["title"], description=e["description"], date=e["date"], venue=e["venue"],
                      cover_image_url=e["cover_image_url"], category=e["category"], price=e["price"],
                      total_tickets=e["total_tickets"], available_tickets=e["total_tickets"],
                      organizer_name=e["organizer_name"], tags=e["tags"])
        result = await db.events.insert_one(event.to_mongo())
        event_ids.append(str(result.inserted_id))

    user_id = user_ids.get("user@test.com")
    if user_id and len(event_ids) >= 2:
        for i in range(2):
            e = events_data[i]
            ticket = Ticket(event_id=event_ids[i], user_id=user_id, user_name="Alex Johnson",
                            user_email="user@test.com", event_title=e["title"], event_date=e["date"],
                            event_venue=e["venue"], qr_token=str(uuid.uuid4()),
                            booking_ref=f"GRY-{uuid.uuid4().hex[:6].upper()}",
                            quantity=1, total_price=e["price"])
            await db.tickets.insert_one(ticket.to_mongo())

    return {"message": "Seed data created", "users": len(users), "events": len(events_data), "tickets": 2}

# ============ PhonePe Helpers ============
def phonepe_checksum(payload_b64: str, endpoint: str) -> str:
    data = payload_b64 + endpoint + PHONEPE_SALT_KEY
    return hashlib.sha256(data.encode()).hexdigest() + "###" + PHONEPE_SALT_INDEX

def phonepe_status_checksum(merchant_id: str, txn_id: str) -> str:
    endpoint = f"/pg/v1/status/{merchant_id}/{txn_id}"
    data = endpoint + PHONEPE_SALT_KEY
    return hashlib.sha256(data.encode()).hexdigest() + "###" + PHONEPE_SALT_INDEX

# ============ Payment Routes ============
@api_router.post("/payments/initiate")
async def initiate_payment(req: PaymentInitiateRequest, current_user: User = Depends(get_current_user)):
    # Fetch event
    try:
        event_doc = await db.events.find_one({"_id": ObjectId(req.event_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    if not event_doc:
        raise HTTPException(status_code=404, detail="Event not found")
    event = Event.from_mongo(dict(event_doc))
    if event.available_tickets < req.quantity:
        raise HTTPException(status_code=400, detail="Not enough tickets available")

    amount_paise = int(event.price * req.quantity * 100)  # PhonePe uses paise
    txn_id = f"GRY-{uuid.uuid4().hex[:12].upper()}"

    # Create pending ticket
    ticket = Ticket(
        event_id=req.event_id, user_id=current_user.id, user_name=current_user.name,
        user_email=current_user.email, event_title=event.title, event_date=event.date,
        event_venue=event.venue, qr_token=str(uuid.uuid4()),
        booking_ref=txn_id, status="pending",
        quantity=req.quantity, total_price=event.price * req.quantity
    )
    ticket_result = await db.tickets.insert_one(ticket.to_mongo())
    ticket_id = str(ticket_result.inserted_id)

    # Build PhonePe payload
    backend_url = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://event-ui-pro.preview.emergentagent.com/api")
    redirect_url = f"{backend_url}/payments/callback/{txn_id}"
    callback_url = f"{backend_url}/payments/webhook"

    payload = {
        "merchantId": PHONEPE_MERCHANT_ID,
        "merchantTransactionId": txn_id,
        "merchantUserId": f"MU{current_user.id[:8]}",
        "amount": amount_paise,
        "redirectUrl": redirect_url,
        "redirectMode": "GET",
        "callbackUrl": callback_url,
        "mobileNumber": req.mobile or "9999999999",
        "paymentInstrument": {"type": "PAY_PAGE"}
    }
    payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    checksum = phonepe_checksum(payload_b64, "/pg/v1/pay")

    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.post(
                f"{PHONEPE_BASE_URL}/pg/v1/pay",
                headers={"Content-Type": "application/json", "X-VERIFY": checksum},
                json={"request": payload_b64}
            )
            data = resp.json()
    except Exception as e:
        logger.error(f"PhonePe API error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error. Please try again.")

    if not data.get("success"):
        raise HTTPException(status_code=400, detail=data.get("message", "Payment initiation failed"))

    redirect_info = data["data"]["instrumentResponse"]["redirectInfo"]
    # Store txn_id → ticket_id mapping
    await db.payment_orders.insert_one({
        "txn_id": txn_id, "ticket_id": ticket_id, "event_id": req.event_id,
        "user_id": current_user.id, "amount": amount_paise, "status": "pending",
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "payment_url": redirect_info["url"],
        "txn_id": txn_id,
        "ticket_id": ticket_id,
        "amount": event.price * req.quantity
    }

@api_router.get("/payments/status/{txn_id}")
async def payment_status(txn_id: str, current_user: User = Depends(get_current_user)):
    order = await db.payment_orders.find_one({"txn_id": txn_id})
    if not order:
        raise HTTPException(status_code=404, detail="Transaction not found")

    checksum = phonepe_status_checksum(PHONEPE_MERCHANT_ID, txn_id)
    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.get(
                f"{PHONEPE_BASE_URL}/pg/v1/status/{PHONEPE_MERCHANT_ID}/{txn_id}",
                headers={"Content-Type": "application/json", "X-VERIFY": checksum, "X-MERCHANT-ID": PHONEPE_MERCHANT_ID}
            )
            data = resp.json()
    except Exception as e:
        logger.error(f"PhonePe status error: {e}")
        raise HTTPException(status_code=502, detail="Unable to check payment status")

    pg_status = data.get("data", {}).get("state", "PENDING")
    ticket_id = order.get("ticket_id")

    if pg_status == "COMPLETED":
        await db.tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": {"status": "valid"}})
        await db.events.update_one({"_id": ObjectId(order["event_id"])}, {"$inc": {"available_tickets": -order.get("quantity", 1)}})
        await db.payment_orders.update_one({"txn_id": txn_id}, {"$set": {"status": "completed"}})
        return {"status": "COMPLETED", "ticket_id": ticket_id, "txn_id": txn_id}
    elif pg_status == "FAILED":
        await db.tickets.delete_one({"_id": ObjectId(ticket_id)})
        await db.payment_orders.update_one({"txn_id": txn_id}, {"$set": {"status": "failed"}})
        return {"status": "FAILED", "ticket_id": None, "txn_id": txn_id}
    else:
        return {"status": "PENDING", "ticket_id": ticket_id, "txn_id": txn_id}

@api_router.get("/payments/callback/{txn_id}")
async def payment_callback(txn_id: str):
    """PhonePe redirects user here after payment. Redirect to frontend."""
    frontend_url = os.environ.get("EXPO_PACKAGER_HOSTNAME", "https://event-ui-pro.preview.emergentagent.com")
    return RedirectResponse(url=f"{frontend_url}/payment-result?txn_id={txn_id}")

@api_router.post("/payments/webhook")
async def payment_webhook(req: PaymentWebhookRequest):
    """PhonePe server-to-server callback"""
    if req.response:
        try:
            decoded = json.loads(base64.b64decode(req.response).decode())
            txn_id = decoded.get("data", {}).get("merchantTransactionId")
            state = decoded.get("data", {}).get("state")
            if txn_id and state == "COMPLETED":
                order = await db.payment_orders.find_one({"txn_id": txn_id})
                if order:
                    ticket_id = order.get("ticket_id")
                    await db.tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": {"status": "valid"}})
                    await db.events.update_one({"_id": ObjectId(order["event_id"])}, {"$inc": {"available_tickets": -1}})
                    await db.payment_orders.update_one({"txn_id": txn_id}, {"$set": {"status": "completed"}})
        except Exception as e:
            logger.error(f"Webhook error: {e}")
    return {"success": True}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
