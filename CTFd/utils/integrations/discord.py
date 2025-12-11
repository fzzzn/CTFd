import json
import requests
from flask import current_app

from CTFd.utils import get_config


def send_discord_webhook(webhook_url, title, content=None, color=None, username=None, avatar_url=None):
    """
    Send a message to Discord via webhook

    Args:
        webhook_url (str): Discord webhook URL
        title (str): Title of the embed
        content (str): Content/description of the embed
        color (int): Color of the embed (decimal format)
        username (str): Override webhook username
        avatar_url (str): Override webhook avatar

    Returns:
        bool: True if successful, False otherwise
    """
    if not webhook_url:
        return False

    # Prepare the embed
    embed = {
        "title": title,
        "color": color or 0x5CC9BB,  # Default to CTFd blue-green
        "timestamp": None  # Discord will use current timestamp
    }

    if content:
        embed["description"] = content

    # Prepare the payload
    payload = {
        "embeds": [embed]
    }

    if username:
        payload["username"] = username

    if avatar_url:
        payload["avatar_url"] = avatar_url

    try:
        print(f"DEBUG: Sending Discord webhook to: {webhook_url[:50]}...")
        print(f"DEBUG: Payload: {payload}")

        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        print(f"DEBUG: Discord response status: {response.status_code}")

        if response.status_code == 204:  # Discord webhook success status
            print("DEBUG: Discord webhook sent successfully")
            return True
        else:
            print(
                f"DEBUG: Discord webhook failed with status {response.status_code}: {response.text}")
            current_app.logger.warning(
                f"Discord webhook failed with status {response.status_code}: {response.text}"
            )
            return False

    except requests.exceptions.RequestException as e:
        print(f"DEBUG: Discord webhook exception: {str(e)}")
        current_app.logger.error(f"Discord webhook error: {str(e)}")
        return False


def send_notification_to_discord(notification_data):
    """
    Send a CTFd notification to Discord

    Args:
        notification_data (dict): Notification data from CTFd events
    """
    webhook_url = get_config("discord_webhook_url")

    if not webhook_url:
        print("DEBUG: No Discord webhook URL configured")
        return False

    # Only show first 50 chars for security
    print(f"DEBUG: Using webhook URL: {webhook_url[:50]}...")

    # Extract notification details
    title = notification_data.get("title", "CTFd Notification")
    content = notification_data.get("content", "")

    # Determine color based on notification type
    notif_type = notification_data.get("type", "alert")
    color_map = {
        "alert": 0xFF6B6B,    # Red for alerts
        "toast": 0x5CC9BB,    # CTFd green for general notifications
        "info": 0x4ECDC4,     # Teal for info
        "success": 0x45B7D1,  # Blue for success
        "warning": 0xF9CA24,  # Yellow for warnings
        "error": 0xFF6B6B     # Red for errors
    }

    color = color_map.get(notif_type, 0x5CC9BB)

    # Get webhook name (custom name or fall back to CTF name)
    webhook_name = get_config("discord_webhook_name") or get_config("ctf_name", "CTFd")
    username = f"{webhook_name} Notifications"

    print(
        f"DEBUG: Sending notification to Discord - Title: '{title}', Type: '{notif_type}', Color: {hex(color)}")

    return send_discord_webhook(
        webhook_url=webhook_url,
        title=title,
        content=content,
        color=color,
        username=username
    )


def send_solve_to_discord(webhook_url, challenge, user, team, is_first_blood=False):
    """
    Send a challenge solve notification to Discord

    Args:
        webhook_url (str): Discord webhook URL
        challenge: Challenge object
        user: User object
        team: Team object (optional)
        is_first_blood (bool): Whether this is the first solve of the challenge
    """
    solves_enabled = get_config("discord_solves_enabled")

    print(
        f"DEBUG: Discord solve config - webhook_url: {bool(webhook_url)}, solves_enabled: {solves_enabled}")

    if not webhook_url or not solves_enabled:
        print(
            f"DEBUG: Discord solve notification skipped - webhook_url: {bool(webhook_url)}, solves_enabled: {solves_enabled}")
        return False

    # Extract data from objects
    challenge_name = challenge.name if challenge else "Unknown Challenge"
    challenge_value = challenge.value if challenge else 0
    challenge_category = challenge.category if challenge else "Unknown"
    user_name = user.name if user else "Unknown User"
    team_name = team.name if team else None

    # Prepare solve notification with first blood detection
    # Get webhook name (custom name or fall back to CTF name)
    webhook_name = get_config("discord_webhook_name") or get_config("ctf_name", "CTFd")

    # Choose title and color based on first blood status
    if is_first_blood:
        title_prefix = "FIRST BLOOD! 🩸"
        color = 0xFF0000  # Red for first blood
    else:
        title_prefix = "Challenge Solved"
        color = 0x00FF00  # Green for regular solves

    title = f"{title_prefix} {challenge_name}"

    description = f"**Team:** {team_name}\n**User:** {user_name}\n**Category:** {challenge_category}\n**Points:** {challenge_value}"

    # Add first blood prefix to description if applicable
    if is_first_blood:
        description = f"{description}"

    print(
        f"DEBUG: Sending Discord solve notification - Title: {title}, First Blood: {is_first_blood}")

    result = send_discord_webhook(
        webhook_url=webhook_url,
        title=title,
        content=description,
        color=color,
        username=f"{webhook_name} Solves"
    )

    print(f"DEBUG: Discord webhook result: {result}")
    return result


def test_discord_webhook():
    """
    Test the Discord webhook configuration

    Returns:
        bool: True if test successful, False otherwise
    """
    webhook_url = get_config("discord_webhook_url")

    if not webhook_url:
        return False

    # Get webhook name (custom name or fall back to CTF name)
    webhook_name = get_config("discord_webhook_name") or get_config("ctf_name", "CTFd")

    return send_discord_webhook(
        webhook_url=webhook_url,
        title="🔧 CTFd Discord Integration Test",
        content="Discord webhook integration is working correctly!",
        color=0x5CC9BB,
        username=f"{webhook_name} Test"
    )
