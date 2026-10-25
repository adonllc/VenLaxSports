"""Only the unsubscribe link remains. The early list is no longer collected; the stored contacts are emailed
by conversion_campaign, and links in emails already sent keep working."""
from bson import ObjectId
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from datetime import datetime, timezone

import conversion_campaign

router = APIRouter()


@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(request: Request, token: str):
    """One-click unsubscribe from VenLax Sports launch emails."""
    db = request.app.state.db
    cid = conversion_campaign.decode_unsub_token(token)
    ok = False
    if cid:
        try:
            res = await db.waitlist.update_one({"_id": ObjectId(cid)},
                                               {"$set": {"unsubscribed_at": datetime.now(timezone.utc).isoformat()}})
            ok = res.matched_count > 0
        except Exception:
            ok = False
    msg = "You have been unsubscribed. You will not get more launch emails from VenLax Sports." if ok else \
          "This unsubscribe link is not valid. Reply to any of our emails and we will remove you."
    return HTMLResponse(f"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>"
                        f"<body style='font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#3D3D3D'>"
                        f"<h2>VenLax Sports</h2><p>{msg}</p></body>")
