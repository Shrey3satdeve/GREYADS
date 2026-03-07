"""
Greyads Backend API Tests - Auth, Events, Tickets, Scanner, Admin
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def seeded():
    """Ensure seed data exists"""
    r = requests.post(f"{BASE_URL}/api/seed")
    assert r.status_code == 200
    return r.json()

@pytest.fixture(scope="module")
def user_token(seeded):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "user@test.com", "password": "Test@123"})
    assert r.status_code == 200
    return r.json()["token"]

@pytest.fixture(scope="module")
def staff_token(seeded):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "staff@greyads.com", "password": "Staff@123"})
    assert r.status_code == 200
    return r.json()["token"]

@pytest.fixture(scope="module")
def admin_token(seeded):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@greyads.com", "password": "Admin@123"})
    assert r.status_code == 200
    return r.json()["token"]

@pytest.fixture(scope="module")
def first_event_id(seeded):
    r = requests.get(f"{BASE_URL}/api/events")
    assert r.status_code == 200
    events = r.json()["events"]
    assert len(events) > 0
    return events[0]["id"]


# ============ Auth Tests ============
class TestAuth:
    """Auth endpoint tests"""

    def test_register_new_user(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST_User", "email": "TEST_newuser@greyads.com", "password": "Pass@123"
        })
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "user"
        assert data["user"]["email"] == "TEST_newuser@greyads.com"

    def test_register_duplicate_email(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "TEST_User", "email": "TEST_newuser@greyads.com", "password": "Pass@123"
        })
        assert r.status_code == 400

    def test_login_user(self, seeded):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "user@test.com", "password": "Test@123"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "user"

    def test_login_staff(self, seeded):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "staff@greyads.com", "password": "Staff@123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "staff"

    def test_login_admin(self, seeded):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@greyads.com", "password": "Admin@123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_login_invalid_password(self, seeded):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "user@test.com", "password": "wrongpass"})
        assert r.status_code == 401

    def test_get_me(self, user_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "user@test.com"

    def test_get_me_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ============ Event Tests ============
class TestEvents:
    """Event endpoint tests"""

    def test_list_events(self, seeded):
        r = requests.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        data = r.json()
        assert "events" in data
        assert len(data["events"]) > 0
        event = data["events"][0]
        assert "id" in event
        assert "title" in event
        assert "price" in event
        assert "available_tickets" in event

    def test_list_events_with_category_filter(self, seeded):
        r = requests.get(f"{BASE_URL}/api/events?category=Music")
        assert r.status_code == 200
        events = r.json()["events"]
        for e in events:
            assert e["category"] == "Music"

    def test_list_events_with_search(self, seeded):
        r = requests.get(f"{BASE_URL}/api/events?search=Tech")
        assert r.status_code == 200
        events = r.json()["events"]
        assert len(events) >= 1

    def test_get_event_by_id(self, first_event_id):
        r = requests.get(f"{BASE_URL}/api/events/{first_event_id}")
        assert r.status_code == 200
        event = r.json()["event"]
        assert event["id"] == first_event_id

    def test_get_event_invalid_id(self):
        r = requests.get(f"{BASE_URL}/api/events/invalidid123")
        assert r.status_code == 400

    def test_get_event_not_found(self):
        r = requests.get(f"{BASE_URL}/api/events/000000000000000000000000")
        assert r.status_code == 404


# ============ Ticket Tests ============
class TestTickets:
    """Ticket endpoint tests"""

    def test_book_ticket(self, user_token, first_event_id):
        r = requests.post(f"{BASE_URL}/api/tickets/book",
                          json={"event_id": first_event_id, "quantity": 1},
                          headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        ticket = r.json()["ticket"]
        assert "qr_token" in ticket
        assert "booking_ref" in ticket
        assert ticket["status"] == "valid"
        assert ticket["event_id"] == first_event_id

    def test_book_ticket_unauthenticated(self, first_event_id):
        r = requests.post(f"{BASE_URL}/api/tickets/book", json={"event_id": first_event_id, "quantity": 1})
        assert r.status_code == 401

    def test_my_tickets(self, user_token):
        r = requests.get(f"{BASE_URL}/api/tickets/my", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        tickets = r.json()["tickets"]
        assert len(tickets) > 0
        assert "qr_token" in tickets[0]

    def test_get_ticket_by_id(self, user_token):
        # Get a ticket first
        tickets_r = requests.get(f"{BASE_URL}/api/tickets/my", headers={"Authorization": f"Bearer {user_token}"})
        ticket_id = tickets_r.json()["tickets"][0]["id"]
        r = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        assert r.json()["ticket"]["id"] == ticket_id


# ============ Scanner Tests ============
class TestScanner:
    """Scanner endpoint tests (staff only)"""

    def test_verify_valid_qr(self, staff_token, user_token):
        # Get a valid ticket's QR token
        tickets_r = requests.get(f"{BASE_URL}/api/tickets/my", headers={"Authorization": f"Bearer {user_token}"})
        tickets = tickets_r.json()["tickets"]
        # Find a valid ticket
        valid_ticket = next((t for t in tickets if t["status"] == "valid"), None)
        if not valid_ticket:
            pytest.skip("No valid tickets available for scanning")
        qr_token = valid_ticket["qr_token"]
        r = requests.post(f"{BASE_URL}/api/scanner/verify",
                          json={"qr_token": qr_token},
                          headers={"Authorization": f"Bearer {staff_token}"})
        assert r.status_code == 200
        assert r.json()["status"] == "success"

    def test_verify_already_used_qr(self, staff_token, user_token):
        # Get the same ticket we just scanned
        tickets_r = requests.get(f"{BASE_URL}/api/tickets/my", headers={"Authorization": f"Bearer {user_token}"})
        tickets = tickets_r.json()["tickets"]
        used_ticket = next((t for t in tickets if t["status"] == "used"), None)
        if not used_ticket:
            pytest.skip("No used tickets available")
        r = requests.post(f"{BASE_URL}/api/scanner/verify",
                          json={"qr_token": used_ticket["qr_token"]},
                          headers={"Authorization": f"Bearer {staff_token}"})
        assert r.status_code == 200
        assert r.json()["status"] == "already_used"

    def test_verify_invalid_qr(self, staff_token):
        r = requests.post(f"{BASE_URL}/api/scanner/verify",
                          json={"qr_token": "invalid-fake-token"},
                          headers={"Authorization": f"Bearer {staff_token}"})
        assert r.status_code == 200
        assert r.json()["status"] == "invalid"

    def test_verify_qr_as_user_forbidden(self, user_token):
        r = requests.post(f"{BASE_URL}/api/scanner/verify",
                          json={"qr_token": "some-token"},
                          headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_scan_history(self, staff_token):
        r = requests.get(f"{BASE_URL}/api/scanner/history", headers={"Authorization": f"Bearer {staff_token}"})
        assert r.status_code == 200
        assert "logs" in r.json()

    def test_scan_history_unauthorized(self, user_token):
        r = requests.get(f"{BASE_URL}/api/scanner/history", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403


# ============ Admin Tests ============
class TestAdmin:
    """Admin endpoint tests"""

    def test_admin_stats(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert "total_events" in data
        assert "total_users" in data
        assert "total_tickets" in data
        assert "total_revenue" in data
        assert "todays_scans" in data
        assert data["total_events"] > 0

    def test_admin_stats_forbidden_for_user(self, user_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_admin_users(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) > 0
        assert "email" in users[0]
        assert "role" in users[0]

    def test_admin_tickets(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/tickets", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert "tickets" in r.json()
