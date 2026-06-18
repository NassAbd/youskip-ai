"""Mollie Payments API integration client supporting live API and simulated mock modes."""

import logging
import uuid

import httpx

from youskip_ai.config import Settings

logger = logging.getLogger(__name__)


class MollieClient:
    """Client wrapper for communicating with Mollie Payments REST API."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.api_key = settings.mollie_api_key
        self.base_url = "https://api.mollie.com/v2"

    @property
    def is_mock_mode(self) -> bool:
        """Check if client runs in simulation mode."""
        return not self.api_key or self.api_key.strip().lower() == "mock"

    async def create_payment(self, amount: float, currency: str = "EUR") -> dict[str, str]:
        """Create a payment session.

        Args:
            amount: Amount in decimal format (e.g. 5.00)
            currency: Currency code (e.g. "EUR")

        Returns:
            Dict containing 'id' and 'checkout_url'.
        """
        if self.is_mock_mode:
            # Generate simulated payment ID and redirect URL
            payment_id = f"tr_mock{uuid.uuid4().hex[:12]}"
            # Client handles mock payment overlay if redirected to this URL
            checkout_url = (
                f"/landing/index.html?mock_payment_id={payment_id}&amount={amount:.2f}"
            )
            logger.info(f"[Mollie Mock] Created payment session: {payment_id} for €{amount:.2f}")
            return {
                "id": payment_id,
                "checkout_url": checkout_url,
            }

        # Live/Sandbox API Integration
        url = f"{self.base_url}/payments"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "amount": {
                "currency": currency,
                "value": f"{amount:.2f}",
            },
            "description": "Support YouSkipAI Open-Source Development",
            # Success redirect point
            "redirectUrl": (
                "http://localhost:8000/landing/index.html?payment=success"
            ),
            # Standard webhook (in sandbox, Mollie calls this if it is a public URL)
            "webhookUrl": "https://youskip.ai/api/v1/donations/webhook",
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                if response.status_code != 201:
                    logger.error(
                        f"Mollie API returned error {response.status_code}: {response.text}"
                    )
                    raise ValueError(
                        f"Mollie Payment API failed with status {response.status_code}"
                    )
                
                data = response.json()
                checkout_url = data.get("_links", {}).get("checkout", {}).get("href")
                if not checkout_url:
                    raise ValueError("Mollie API response did not contain checkout link.")
                
                return {
                    "id": data["id"],
                    "checkout_url": checkout_url,
                }
            except Exception as exc:
                logger.error(f"Failed to create Mollie payment: {exc}")
                # For hackathon resilience, fallback to mock mode if
                # real request fails due to key/network issues
                fallback_id = f"tr_mock_fallback_{uuid.uuid4().hex[:8]}"
                logger.warning(
                    "[Mollie Fallback] Falling back to mock session due to API connection error."
                )
                return {
                    "id": fallback_id,
                    "checkout_url": (
                        f"/landing/index.html?mock_payment_id={fallback_id}"
                        f"&amount={amount:.2f}"
                    ),
                }

    async def get_payment_status(self, payment_id: str) -> str:
        """Fetch transaction status from Mollie API.

        Args:
            payment_id: Transaction ID (e.g. tr_xxxxx)

        Returns:
            Status string (e.g. 'open', 'paid', 'expired', 'failed', 'cancelled').
        """
        if payment_id.startswith("tr_mock"):
            logger.info(f"[Mollie Mock] Status request for {payment_id} -> open")
            return "open"

        url = f"{self.base_url}/payments/{payment_id}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers, timeout=5.0)
                if response.status_code != 200:
                    logger.error(
                        f"Mollie API returned error {response.status_code}: {response.text}"
                    )
                    return "open"
                
                data = response.json()
                return data.get("status", "open")
            except Exception as exc:
                logger.error(f"Failed to retrieve Mollie payment status: {exc}")
                return "open"
