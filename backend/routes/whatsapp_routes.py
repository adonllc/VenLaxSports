"""WhatsApp Cloud API webhook — verification handshake and incoming event handler."""
import os
import json
import logging

from fastapi import APIRouter, HTTPException, Request, Response
from whatsapp_service import verify_signature

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/webhook")
async def wa_verify(request: Request):
    """Meta webhook verification — GET request with hub.challenge that we echo back."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")

    expected_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
    if mode == "subscribe" and token == expected_token:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def wa_receive(request: Request):
    """Receive incoming WA events (delivery receipts, read receipts, inbound messages).

    Signature verification is enforced when META_APP_SECRET is set.
    """
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256", "")

    if not os.environ.get("META_APP_SECRET"):
        logger.warning("META_APP_SECRET not set — webhook signature verification disabled")
    elif not verify_signature(body, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = json.loads(body)
        changes = data.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {})
        if "statuses" in changes:
            for status in changes["statuses"]:
                logger.info(f"WA message status: {status.get('status')} — id {status.get('id')}")
        if "messages" in changes:
            for msg in changes["messages"]:
                logger.info(f"WA inbound from {msg.get('from')}: {msg.get('text', {}).get('body', '')[:80]}")
    except Exception as e:
        logger.warning(f"WA webhook parse error: {e}")

    return {"status": "ok"}
