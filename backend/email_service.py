"""Open-source email service powered by aiosmtplib.

Configuration (backend/.env):
  SMTP_HOST     e.g. smtp.gmail.com, sandbox.smtp.mailtrap.io, localhost
  SMTP_PORT     e.g. 587 (TLS), 465 (SSL), 25 (plain)
  SMTP_USER     SMTP username
  SMTP_PASS     SMTP password (or Gmail app password)
  SMTP_FROM     From address, e.g. "VENLAX <noreply@venlaxsports.com>"
  SMTP_TLS      "true" to use STARTTLS (default true), "false" for plain
  SMTP_SSL      "true" to use SMTPS (default false)

If SMTP_HOST is not set, emails are logged to the backend console instead
of being sent — this keeps local dev zero-setup while allowing the real
SMTP to be enabled just by filling in env vars.
"""
from __future__ import annotations
import os
import logging
import asyncio
from email.message import EmailMessage
from typing import Optional

try:
    import aiosmtplib  # open-source MIT
except Exception:  # pragma: no cover
    aiosmtplib = None  # type: ignore

logger = logging.getLogger(__name__)

APP_NAME = "VENLAX Sports"


def _get_frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "").rstrip("/")


def _smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST"))


async def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> bool:
    """Send an email or log it to the console if SMTP is not configured.

    Returns True on success (or on successful console-log), False if send failed.
    """
    if not to:
        return False

    sender = os.environ.get("SMTP_FROM", f"{APP_NAME} <noreply@venlaxsports.com>")

    if not _smtp_configured() or aiosmtplib is None:
        logger.info("[EMAIL:console] to=%s from=%s subject=%s\n%s", to, sender, subject, text or html)
        return True

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text or _html_to_text(html))
    msg.add_alternative(html, subtype="html")

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER") or None
    password = os.environ.get("SMTP_PASS") or None
    use_ssl = os.environ.get("SMTP_SSL", "false").lower() == "true"
    use_tls = os.environ.get("SMTP_TLS", "true").lower() == "true"

    try:
        await aiosmtplib.send(
            msg,
            hostname=host,
            port=port,
            username=user,
            password=password,
            use_tls=use_ssl,          # SMTPS (port 465)
            start_tls=not use_ssl and use_tls,  # STARTTLS (port 587)
            timeout=15,
        )
        logger.info("Email sent to=%s subject=%s", to, subject)
        return True
    except Exception as e:
        logger.exception("Email send failed to=%s subject=%s: %s", to, subject, e)
        return False


def _html_to_text(html: str) -> str:
    import re
    txt = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    txt = re.sub(r"</p>", "\n\n", txt, flags=re.IGNORECASE)
    txt = re.sub(r"<[^>]+>", "", txt)
    return txt.strip()


def _wrap(title: str, body_html: str, cta_label: Optional[str] = None, cta_url: Optional[str] = None) -> str:
    cta_block = ""
    if cta_label and cta_url:
        cta_block = (
            f'<p style="margin:28px 0"><a href="{cta_url}" '
            f'style="background:#10b981;color:#000;padding:12px 22px;border-radius:10px;'
            f'text-decoration:none;font-weight:700;display:inline-block">{cta_label}</a></p>'
        )
    return f"""
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f7f7f8;padding:32px">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:#000;padding:20px 24px">
          <div style="color:#fff;font-weight:900;font-size:20px;letter-spacing:-0.5px">
            VENLAX <span style="color:#10b981">Sports</span>
          </div>
        </div>
        <div style="padding:28px 24px;color:#111">
          <h1 style="font-size:20px;margin:0 0 14px;font-weight:800">{title}</h1>
          <div style="font-size:14px;line-height:1.6;color:#374151">{body_html}</div>
          {cta_block}
          <p style="font-size:12px;color:#9ca3af;margin-top:28px;border-top:1px solid #f3f4f6;padding-top:16px">
            You received this email from {APP_NAME}. You can disable notifications from your dashboard.
          </p>
        </div>
      </div>
    </div>
    """


# ───────── Convenience senders (used by routes) ─────────

async def send_match_scheduled(to: str, player_name: str, opponent_name: str, sport: str,
                               scheduled_date: str, venue: Optional[str], match_id: str) -> None:
    url = f"{_get_frontend_url()}/dashboard" if _get_frontend_url() else "/dashboard"
    venue_line = f"<li><strong>Venue:</strong> {venue}</li>" if venue else ""
    body = f"""
      <p>Hi {player_name}, a match has been scheduled for you.</p>
      <ul style="padding-left:18px;margin:0 0 0">
        <li><strong>Opponent:</strong> {opponent_name}</li>
        <li><strong>Sport:</strong> {sport.title()}</li>
        <li><strong>Date:</strong> {scheduled_date}</li>
        {venue_line}
      </ul>
      <p>Good luck!</p>
    """
    await send_email(to, f"New {sport.title()} match scheduled — vs {opponent_name}",
                     _wrap("Match scheduled", body, "View match", url))


async def send_score_reported(to: str, recipient_name: str, opponent_name: str, sport: str,
                              won: bool, league_id: str, league_name: str) -> None:
    url = f"{_get_frontend_url()}/leagues/{league_id}/standings" if _get_frontend_url() else f"/leagues/{league_id}/standings"
    headline = "Congrats — you won!" if won else "Match result posted"
    tone = "Great game! Keep the streak going." if won else "Tough one — next match is yours for the taking."
    body = f"""
      <p>Hi {recipient_name},</p>
      <p>{tone}</p>
      <p>Your {sport} match vs <strong>{opponent_name}</strong> in <em>{league_name}</em> has been scored.</p>
    """
    await send_email(to, f"Match result — {league_name}",
                     _wrap(headline, body, "View standings", url))


async def send_registration_confirmed(to: str, player_name: str, league_name: str,
                                      sport: str, league_id: str, paid: bool, amount: float = 0.0,
                                      currency: str = "USD") -> None:
    url = f"{_get_frontend_url()}/leagues/{league_id}" if _get_frontend_url() else f"/leagues/{league_id}"
    sym = "₹" if currency == "INR" else "$"
    pay_line = f"<li><strong>Entry fee:</strong> {sym}{amount:.2f}</li>" if paid and amount > 0 else ""
    body = f"""
      <p>Hi {player_name}, you're in!</p>
      <ul style="padding-left:18px;margin:0">
        <li><strong>League:</strong> {league_name}</li>
        <li><strong>Sport:</strong> {sport.title()}</li>
        {pay_line}
      </ul>
      <p>Head to your dashboard to schedule your first match.</p>
    """
    subject = f"You're registered — {league_name}"
    await send_email(to, subject, _wrap("Registration confirmed", body, "Open league", url))


async def send_password_reset(to: str, player_name: str, reset_url: str) -> None:
    body = f"""
      <p>Hi {player_name},</p>
      <p>We received a request to reset your {APP_NAME} password. Click the button below to choose a new password.
         This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
    """
    await send_email(to, f"Reset your {APP_NAME} password",
                     _wrap("Password reset", body, "Reset password", reset_url))


async def send_partner_invite(to: str, inviter_name: str, league_name: str,
                               sport: str, entry_fee: float, accept_url: str) -> None:
    fee_line = f"<li><strong>Entry fee:</strong> ${entry_fee:.2f} (split or per team)</li>" if entry_fee > 0 else ""
    body = f"""
      <p><strong>{inviter_name}</strong> has invited you to join them as a doubles partner in a VENLAX Round Robin league.</p>
      <ul style="padding-left:18px;margin:0 0 12px">
        <li><strong>League:</strong> {league_name}</li>
        <li><strong>Sport:</strong> {sport.title()}</li>
        {fee_line}
      </ul>
      <p>Click below to accept and confirm your spot. This invite expires in 72 hours.</p>
    """
    await send_email(
        to,
        f"{inviter_name} invited you to a Round Robin doubles league",
        _wrap("You're invited!", body, "Accept & Join", accept_url),
    )


async def send_league_started(to: str, player_name: str, league_name: str, league_id: str) -> None:
    url = f"{_get_frontend_url()}/round-robin/{league_id}" if _get_frontend_url() else f"/round-robin/{league_id}"
    body = f"""
      <p>Hi {player_name},</p>
      <p>Your Round Robin league <strong>{league_name}</strong> has reached minimum players and the schedule has been generated!</p>
      <p>Check your schedule and start coordinating match times with your opponents.</p>
    """
    await send_email(to, f"Schedule generated — {league_name}",
                     _wrap("Your league has started!", body, "View schedule", url))


async def send_playoff_qualified(to: str, player_name: str, league_name: str,
                                  league_id: str, seed: int) -> None:
    url = f"{_get_frontend_url()}/round-robin/{league_id}" if _get_frontend_url() else f"/round-robin/{league_id}"
    body = f"""
      <p>Hi {player_name},</p>
      <p>Congratulations! You've qualified for the playoffs in <strong>{league_name}</strong> as seed #{seed}.</p>
      <p>Playoff brackets are now live — check the Playoffs tab to see your matchup.</p>
    """
    await send_email(to, f"You qualified for playoffs — {league_name}",
                     _wrap("Playoffs qualification confirmed!", body, "View bracket", url))


async def send_otp(to: str, player_name: str, otp: str) -> None:
    body = f"""
      <p>Hi {player_name},</p>
      <p>Your verification code is:</p>
      <p style="font-size:36px;font-weight:900;letter-spacing:8px;text-align:center;
                background:#f3f4f6;border-radius:12px;padding:16px 0;margin:20px 0">
        {otp}
      </p>
      <p>This code expires in <strong>10 minutes</strong>. If you didn't create a VENLAX account, you can safely ignore this email.</p>
    """
    await send_email(to, f"Your VENLAX verification code: {otp}",
                     _wrap("Verify your email", body))


async def send_schedule_released(to: str, player_name: str, league_name: str, league_id: str, league_type: str = "flex") -> None:
    path = f"/round-robin/{league_id}" if league_type == "round_robin" else f"/leagues/{league_id}"
    url = f"{_get_frontend_url()}{path}" if _get_frontend_url() else path
    body = f"""
      <p>Hi {player_name},</p>
      <p>The schedule for <strong>{league_name}</strong> is now live!</p>
      <p>Log in to view your matches, coordinate times with opponents, and track standings.</p>
    """
    await send_email(to, f"Schedule released — {league_name}",
                     _wrap("Your schedule is ready", body, "View schedule", url))


async def send_season_open(to: str, player_name: str, city: str, sport: str,
                            league_name: str, join_url: str) -> None:
    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    body = f"""
      <p>Hi {player_name},</p>
      <p>Great news — <strong>{league_name}</strong> just opened registration in {city}!</p>
      <p>Spots fill fast. Secure yours now.</p>
    """
    subject = f"{city} {sport.title()} is open — grab your spot"
    await send_email(to, subject, _wrap(f"{sport_emoji} New League Open", body, "Join Now", join_url))


async def send_last_spots(to: str, player_name: str, city: str, sport: str,
                           spots_left: int, join_url: str) -> None:
    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    body = f"""
      <p>Hi {player_name},</p>
      <p>Only <strong>{spots_left} spot{'s' if spots_left != 1 else ''}</strong> left in the {city} {sport.title()} league you were interested in.</p>
      <p>Join now before it fills up.</p>
    """
    subject = f"Only {spots_left} spot{'s' if spots_left != 1 else ''} left in {city} {sport.title()}"
    await send_email(to, subject, _wrap(f"{sport_emoji} Last Spots Remaining", body, "Claim Your Spot", join_url))


async def send_waitlist_open(to: str, player_name: str, city: str, sport: str,
                              waitlist_url: str) -> None:
    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    body = f"""
      <p>Hi {player_name},</p>
      <p>The {city} {sport.title()} league you were interested in is now full.</p>
      <p>Join the waitlist below — we'll notify you the moment a spot opens.</p>
    """
    subject = f"{city} {sport.title()} is full — you're on the waitlist"
    await send_email(to, subject, _wrap(f"{sport_emoji} You're on the Waitlist", body, "View League", waitlist_url))


async def send_partner_declined(initiator_email: str, initiator_name: str, league_name: str) -> None:
    body = f"""
      <p>Hi {initiator_name},</p>
      <p>Your doubles partner has declined the invite to join <strong>{league_name}</strong>.</p>
      <p>Your registration slot has been released. You can submit a new invite with a different partner by visiting the league page.</p>
    """
    await send_email(
        initiator_email,
        f"Your doubles partner declined the invite for {league_name}",
        _wrap("Partner declined", body),
    )


async def send_generic(to: str, subject: str, body: str) -> None:
    html_body = "".join(f"<p>{line}</p>" for line in body.split("\n\n") if line.strip())
    await send_email(to, subject, _wrap(subject, html_body, None, None))


# Fire-and-forget helper so route handlers don't block on SMTP
def schedule(coro) -> None:
    """Schedule an email coroutine without awaiting (best-effort delivery)."""
    try:
        asyncio.get_event_loop().create_task(coro)
    except RuntimeError:
        # No running loop (e.g. in tests) — run synchronously
        asyncio.run(coro)
