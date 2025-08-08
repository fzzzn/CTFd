from CTFd.utils.integrations.discord import send_notification_to_discord, send_solve_to_discord
from CTFd.models import Challenges, Users, Teams, Submissions


def discord_notification_hook(data):
    """
    Hook function to send notifications to Discord
    
    Args:
        data (dict): Event data from CTFd events system
    """
    try:
        if data.get("type") == "notification":
            # Handle general notifications
            notification_data = data.get("data", {})
            send_notification_to_discord(notification_data)
        elif data.get("type") == "solve":
            # Handle solve notifications - this would need more context
            # For now, this is handled in discord_hooks.py with submission objects
            solve_data = data.get("data", {})
            # This simplified approach doesn't have access to submission objects
            # so we can't detect first blood here. Use discord_hooks.py instead.
            pass
    except Exception as e:
        # Log error but don't break the event system
        from flask import current_app
        current_app.logger.error(f"Discord webhook hook error: {str(e)}")


# Register the hook with CTFd's events system
def register_discord_hooks(app):
    """
    Register Discord webhook hooks with the CTFd events system
    
    Args:
        app: Flask application instance
    """
    if hasattr(app, 'events_manager'):
        # Hook into notifications
        app.events_manager.subscribe(discord_notification_hook)
