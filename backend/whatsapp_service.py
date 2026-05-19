"""WhatsApp Cloud API client — wraps Meta Graph API for sending messages.

Requires env vars:
  WHATSAPP_API_TOKEN        — permanent system user token from Meta Business Suite
  WHATSAPP_PHONE_NUMBER_ID  — from WhatsApp Business Account phone number settings
  META_APP_SECRET           — from Meta App Dashboard → Settings → Basic

Falls back to console logging when not configured (dev/staging).
"""
import os
import hmac
import hashlib
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

_WA_API_VERSION = "v18.0"
_WA_BASE = f"https://graph.facebook.com/{_WA_API_VERSION}"


def is_configured() -> bool:
    return bool(
        os.environ.get("WHATSAPP_API_TOKEN")
        and os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
    )


async def send_text(to_phone: str, body: str) -> bool:
    """Send a WhatsApp text message. Returns True on success, False on failure."""
    if not is_configured():
        logger.info(f"[WA stub] To: {to_phone} | {body[:100]}")
        return False
    try:
        import httpx
    except ImportError:
        logger.error("httpx not installed. Run: pip install httpx")
        return False

    token = os.environ["WHATSAPP_API_TOKEN"]
    phone_id = os.environ["WHATSAPP_PHONE_NUMBER_ID"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{_WA_BASE}/{phone_id}/messages",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "text",
                "text": {"body": body},
            },
        )

    if resp.status_code != 200:
        logger.error(f"WA send failed: {resp.status_code} — {resp.text[:200]}")
        return False
    return True


def schedule_wa(to_phone: str, body: str) -> None:
    """Fire-and-forget WA send. Degrades gracefully when not configured."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(send_text(to_phone, body))
        else:
            asyncio.run(send_text(to_phone, body))
    except Exception as e:
        logger.warning(f"WA schedule failed: {e}")


def verify_signature(payload: bytes, signature_header: str) -> bool:
    """Verify Meta webhook X-Hub-Signature-256 header."""
    app_secret = os.environ.get("META_APP_SECRET", "")
    if not app_secret:
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode("utf-8"), payload, digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)
