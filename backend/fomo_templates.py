"""Registered-player emails that use real facts about the player's own city: the next open league, spots left, how many
players have joined there. Each template says what real data it needs ("needs"); a player without it is skipped, never
sent made-up numbers.

Tokens: {name} {league} {league_id} {city} {sport} {start_date} {days_left} {days_word} {spots_left} {spots_word}
        {players_in_city}
Each template has several subject lines; the admin picks one (subject_variant).
"""
import conversion_campaign as cc

# A league counts as "almost full" when this many spots or fewer remain
FEW_SPOTS = 6
# Only mention how many players are in a city once it is at least this many
CROWD_MIN = 15

FOMO_TEMPLATES: dict[str, dict] = {
    "m11_league_near": {
        "label": "11 A league in your city is open",
        "needs": "league",
        "subjects": [
            "{league} starts soon",
            "{name}, a {sport} league in {city} is open for sign-up",
            "Your {city} {sport} league is open: grab your place",
        ],
        "title": "A league in {city} is open",
        "cta": ("See {league}", "/leagues/{league_id}"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p><strong>{{league}}</strong> in {{city}} starts shortly. Registration is open now, and every league has a limited number of places.</p>
          <p>A VenLax league is a ranked season of {{sport}} matches against players at your level, played when it suits you.</p>
          <p>Singles $9.99 per player. Doubles $19.99 per team, one payment covers you and your partner. Entry fees are refundable until the league starts.</p>
          <p>When a league fills or starts, registration closes and the next chance is the next season. Don't be the one who waits.</p>
          <p>Questions? Write to {cc.SUPPORT}.</p>""",
    },
    "m12_few_spots": {
        "label": "12 Only a few spots left (sent only when really nearly full)",
        "needs": "few_spots",
        "subjects": [
            "{league} is almost full",
            "Last call for {sport} in {city}",
            "{name}, a few spots left in {league}",
        ],
        "title": "Almost full",
        "cta": ("Take a spot", "/leagues/{league_id}"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p><strong>{{league}}</strong> has only a few spots left and starts shortly.</p>
          <p>When the last spots go, registration for this league closes, and the next chance to play is the next season.</p>
          <p>Entry fees are refundable until the league starts, so there is no risk in holding a place. Questions? Write to {cc.SUPPORT}.</p>""",
    },
    "m13_no_partner": {
        "label": "13 Doubles without a partner (needs partner auto-assign live)",
        "needs": "doubles_league",
        "subjects": [
            "Doubles without a partner? No problem",
            "Sign up solo. We'll find you a partner.",
            "{city} doubles: no partner needed",
        ],
        "title": "No partner? No problem",
        "cta": ("See {league}", "/leagues/{league_id}"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p>Want to play doubles but have nobody to play with? You can still join <strong>{{league}}</strong>.</p>
          <ul style="padding-left:18px;margin:0 0 16px">
            <li>Sign up on your own and add a friend later, any time before the league starts.</li>
            <li>Or ask VenLax to find a partner: pay your half ($9.99) and we pair you with a waiting player by level and location. They pay the other half.</li>
            <li>Bringing your own partner? One team fee of $19.99 covers you both, and your partner joins free.</li>
            <li>Not happy with the match? Ask for a different partner until the league starts.</li>
          </ul>
          <p>Questions? Write to {cc.SUPPORT}.</p>""",
    },
    "m14_first_free": {
        "label": "14 Your first league is free",
        "needs": None,
        "subjects": [
            "Your first league is on us",
            "First league free: use code PLAY1FREE",
            "{name}, play your first league free",
        ],
        "title": "Your first league is free",
        "cta": ("Find a league", "/leagues"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p>Joining your first VenLax league costs nothing. Use the code <strong>PLAY1FREE</strong> at checkout.</p>
          <p>Pick Tennis or Pickleball, Singles or Doubles, in your city, and start climbing the standings against players at your level.</p>
          <p>Questions? Write to {cc.SUPPORT}.</p>""",
    },
    "m15_crowd": {
        "label": "15 Players in your city are signing up (real count)",
        "needs": "crowd",
        "subjects": [
            "{players_in_city} players in {city} are already in",
            "{city} is filling up",
            "{name}, your {city} league has players waiting",
        ],
        "title": "{city} is getting going",
        "cta": ("Join them", "/leagues?city={city}"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p><strong>{{players_in_city}} players</strong> in {{city}} have joined a VenLax league. More players near you means closer ratings, easier doubles partners and faster matches.</p>
          <p>Next up: <strong>{{league}}</strong>, starting shortly. Every league has a limited number of places.</p>
          <p>Questions? Write to {cc.SUPPORT}.</p>""",
    },
    "m16_bring_partner": {
        "label": "16 Bring your doubles partner, or we pair you (needs partner auto-assign live)",
        "needs": "waiting_team",
        "subjects": [
            "Bring your partner to activate your team in {league}",
            "{name}, your doubles team still needs a partner",
            "No partner yet? We can pair you at your level",
        ],
        "title": "Your team needs a partner",
        "cta": ("Open my dashboard", "/dashboard"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p>Your doubles team in <strong>{{league}}</strong> is not active yet because it has no partner. The league starts shortly, and a team without a partner cannot play.</p>
          <p><strong>Two ways to get your team in:</strong></p>
          <ul style="padding-left:18px;margin:0 0 16px">
            <li><strong>Bring your partner.</strong> Add them from your dashboard by email. They join free: your team fee already covers both of you.</li>
            <li><strong>Let us know and we will pair you.</strong> Tap "Let VenLax find me a partner" on your dashboard. We will pair you with another waiting player in your league at your level, near you, and you each end up paying half (anything extra you paid comes back as VenLax Credit).</li>
          </ul>
          <p>You can ask for a different partner any time until the league starts. Questions? Write to {cc.SUPPORT}.</p>""",
    },
}
