"""Tests for the Mollie payments client, DonationManager, and donation routes."""

from collections.abc import Generator
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from youskip_ai.config import Settings
from youskip_ai.donations import DonationManager
from youskip_ai.main import app
from youskip_ai.mollie import MollieClient


class TestDonationManager:
    """Test suite for DonationManager state tracking."""

    @pytest.fixture
    def temp_cache_dir(self, tmp_path: Path) -> Path:
        """Create a temporary directory for cache testing."""
        return tmp_path

    def test_initial_donation_manager_creates_file(self, temp_cache_dir: Path) -> None:
        """DonationManager should seed initial simulation values on creation."""
        db_file = temp_cache_dir / "donations.json"
        assert not db_file.exists()

        manager = DonationManager(cache_dir=str(temp_cache_dir))
        assert db_file.exists()
        stats = manager.get_stats()
        # Seed statistics should be populated by default for display
        assert stats.backers_count > 0
        assert stats.total_raised > 0.0

    def test_create_and_get_donation(self, temp_cache_dir: Path) -> None:
        """Should save a donation session and retrieve it correctly."""
        manager = DonationManager(cache_dir=str(temp_cache_dir))
        donation = manager.create_donation(
            payment_id="tr_12345",
            amount=15.50,
            currency="EUR",
            checkout_url="https://checkout.mollie.com/12345"
        )
        assert donation.id == "tr_12345"
        assert donation.amount == 15.50
        assert donation.status == "open"
        assert donation.checkout_url == "https://checkout.mollie.com/12345"

        retrieved = manager.get_donation("tr_12345")
        assert retrieved is not None
        assert retrieved.id == "tr_12345"
        assert retrieved.amount == 15.50

    def test_update_donation_status(self, temp_cache_dir: Path) -> None:
        """Should transition payment status and update aggregated statistics."""
        manager = DonationManager(cache_dir=str(temp_cache_dir))
        
        # Fresh setup - clear seed values to test pure incremental stats
        manager._save_donations({})
        
        manager.create_donation(
            payment_id="tr_payme",
            amount=50.00,
            currency="EUR",
            checkout_url="https://checkout.url"
        )
        stats_before = manager.get_stats()
        assert stats_before.total_raised == 0.0
        assert stats_before.backers_count == 0

        # Update to paid
        updated = manager.update_donation_status("tr_payme", "paid")
        assert updated is not None
        assert updated.status == "paid"

        stats_after = manager.get_stats()
        assert stats_after.total_raised == 50.0
        assert stats_after.backers_count == 1
        assert stats_after.percent_raised == 20.0  # 50 / 250 goal * 100


class TestMollieClient:
    """Test suite for MollieClient (mock and real HTTP)."""

    @pytest.mark.asyncio
    async def test_mock_mollie_client(self) -> None:
        """When api_key is 'mock', it should return sandbox credentials instantly."""
        settings = Settings(mollie_api_key="mock")
        client = MollieClient(settings=settings)
        
        payment = await client.create_payment(amount=20.0, currency="EUR")
        assert payment["id"].startswith("tr_mock")
        assert "mock_payment_id" in payment["checkout_url"]
        
        status = await client.get_payment_status(payment["id"])
        assert status == "open"

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.post")
    async def test_real_mollie_client_creation(self, mock_post: MagicMock) -> None:
        """When a real key is present, it should query Mollie API via POST."""
        settings = Settings(mollie_api_key="live_fakekey123")
        client = MollieClient(settings=settings)

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": "tr_real123",
            "amount": {"value": "10.00", "currency": "EUR"},
            "status": "open",
            "_links": {
                "checkout": {"href": "https://mollie.com/checkout/real"}
            },
            "createdAt": "2026-06-18T10:00:00Z"
        }
        mock_post.return_value = mock_response

        payment = await client.create_payment(amount=10.00, currency="EUR")
        assert payment["id"] == "tr_real123"
        assert payment["checkout_url"] == "https://mollie.com/checkout/real"
        assert mock_post.called


class TestDonationEndpoints:
    """Test suite for FastAPI donation routes."""

    @pytest.fixture
    def clean_manager(self, tmp_path: Path) -> Generator[DonationManager, None, None]:
        """Provide a clean manager with temp directory."""
        manager = DonationManager(cache_dir=str(tmp_path))
        manager._save_donations({})  # Reset seed values
        # Monkeypatch main app's _donations instance
        with patch("youskip_ai.main._donations", manager):
            yield manager

    def test_get_stats_empty(self, clean_manager: DonationManager) -> None:
        """Stats should return default zeros if no donations exist."""
        client = TestClient(app)
        resp = client.get("/api/v1/donations/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_raised"] == 0.0
        assert data["backers_count"] == 0
        assert data["percent_raised"] == 0.0

    def test_create_donation_endpoint(self, clean_manager: DonationManager) -> None:
        """POST /api/v1/donations should initiate a session and return response model."""
        client = TestClient(app)
        resp = client.post(
            "/api/v1/donations",
            json={"amount": 10.0, "currency": "EUR"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"].startswith("tr_mock")
        assert data["amount"] == 10.0
        assert data["status"] == "open"
        assert "checkout_url" in data

    def test_simulate_webhook_endpoint(self, clean_manager: DonationManager) -> None:
        """POST /api/v1/donations/simulate-webhook should force status update and affect stats."""
        # 1. Create donation
        client = TestClient(app)
        create_resp = client.post(
            "/api/v1/donations",
            json={"amount": 25.0, "currency": "EUR"}
        )
        payment_id = create_resp.json()["id"]

        # 2. Simulate webhook
        webhook_resp = client.post(f"/api/v1/donations/simulate-webhook/{payment_id}")
        assert webhook_resp.status_code == 200
        assert webhook_resp.json()["status"] == "paid"

        # 3. Check stats
        stats_resp = client.get("/api/v1/donations/stats")
        assert stats_resp.json()["total_raised"] == 25.0
        assert stats_resp.json()["backers_count"] == 1
        assert stats_resp.json()["percent_raised"] == 10.0
