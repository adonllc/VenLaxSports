"""Weekly email campaign scheduler for feedback + referral upsell"""

import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from email_service import send_email
import secrets
import string

async def get_db():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]

def generate_referral_code():
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(6))
    return f"REF_{random_part}"

async def send_weekly_campaign():
    """
    Run weekly (Mondays 9am UTC):
    1. Fetch users registered in last 30 days
    2. Exclude users with completed first match
    3. Send appropriate email (waitlist vs completed_reg)
    4. Track email send
    """
    db = await get_db()

    # Define time windows
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Fetch users registered in last 30 days
    recent_users = await db.users.find({
        "created_at": {
            "$gte": thirty_days_ago.isoformat(),
            "$lte": now.isoformat()
        }
    }).to_list(None)

    print(f"[CAMPAIGN] Found {len(recent_users)} users registered in last 30 days")

    for user in recent_users:
        user_id = str(user.get("_id"))
        email = user.get("email")
        name = user.get("name", "Player")

        # Check if user has completed a match
        match_count = await db.matches.count_documents({
            "$or": [
                {"player1_id": user_id, "status": "completed"},
                {"player2_id": user_id, "status": "completed"}
            ]
        })

        if match_count > 0:
            print(f"[CAMPAIGN] Skipping {email} - has completed a match")
            continue

        # Determine campaign type
        waitlist_count = await db.waitlist.count_documents({"user_id": user_id})
        campaign_type = "waitlist" if waitlist_count > 0 else "completed_reg"

        # Check how many emails already sent this week (prevent duplicates)
        existing_campaign = await db.email_campaigns.find_one({
            "user_id": user_id,
            "sent_at": {
                "$gte": (now - timedelta(days=7)).isoformat()
            }
        })

        if existing_campaign:
            print(f"[CAMPAIGN] Already sent email to {email} this week")
            continue

        # Generate referral code if not exists
        if not user.get("referral_code"):
            ref_code = generate_referral_code()
            await db.users.update_one(
                {"_id": user.get("_id")},
                {"$set": {"referral_code": ref_code}}
            )
        else:
            ref_code = user.get("referral_code")

        # Determine week number (0-6 since registration)
        created_at = datetime.fromisoformat(user.get("created_at"))
        days_since_reg = (now - created_at).days
        week_number = min(days_since_reg // 7 + 1, 6)  # 1-6

        # Skip if already sent 6 emails
        sent_count = await db.email_campaigns.count_documents({"user_id": user_id})
        if sent_count >= 6:
            print(f"[CAMPAIGN] Already sent 6 emails to {email}")
            continue

        # Build email content
        if campaign_type == "waitlist":
            subject = "Help Us Build VenLax Better"
            html_content = f"""
            <h2>Hi {name}!</h2>
            <p>You're on our waitlist. We'd love to hear from you!</p>

            <p><strong>Share Feedback:</strong></p>
            <p>Help us improve the platform - any suggestions or concerns?</p>
            <p><a href="FEEDBACK_FORM_URL">Share Your Feedback</a></p>

            <p><strong>Refer a Friend:</strong></p>
            <p>Know someone who loves tennis/pickleball? They get $5 off their first league, you earn $5 credit!</p>
            <p>Your code: <strong>{ref_code}</strong></p>
            <p>Share: https://venlaxsports.com/auth?ref={ref_code}</p>

            <p>Thanks!</p>
            """
        else:  # completed_reg
            subject = "Quick Feedback & Earn Referral Credits"
            html_content = f"""
            <h2>Welcome to VenLax, {name}!</h2>
            <p>You're all signed up. How's your experience?</p>

            <p><strong>Share Feedback:</strong></p>
            <p>Any issues or suggestions? Let us know!</p>
            <p><a href="FEEDBACK_FORM_URL">Share Your Feedback</a></p>

            <p><strong>Refer Friends & Earn:</strong></p>
            <p>Each friend you refer earns you $5 credit toward league entries.</p>
            <p>Your code: <strong>{ref_code}</strong></p>
            <p>Share: https://venlaxsports.com/auth?ref={ref_code}</p>

            <p>Keep playing!</p>
            """

        # Send email
        try:
            await send_email(
                to_email=email,
                subject=subject,
                html_content=html_content
            )

            # Log campaign send
            await db.email_campaigns.insert_one({
                "user_id": user_id,
                "user_email": email,
                "campaign_type": campaign_type,
                "week_number": week_number,
                "sent_at": now.isoformat(),
                "opened_at": None,
                "feedback_submitted": False,
                "referral_clicked": False,
                "created_at": now.isoformat()
            })

            print(f"[CAMPAIGN] Sent {campaign_type} email to {email} (week {week_number})")

        except Exception as e:
            print(f"[CAMPAIGN] ERROR sending email to {email}: {str(e)}")

# Run this weekly via APScheduler or cron
# In production, integrate with your task scheduler
if __name__ == "__main__":
    asyncio.run(send_weekly_campaign())
