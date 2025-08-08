import json
from flask import current_app

from CTFd.models import Submissions, Challenges, Users, Teams
from CTFd.utils import config
from CTFd.utils.integrations.discord import send_notification_to_discord, send_solve_to_discord


def init_discord_webhook_integration(app):
    """Initialize Discord webhook integration by hooking into CTFd's events system"""
    
    # Hook into the existing events manager for notifications
    original_publish = app.events_manager.publish
    
    def discord_enhanced_publish(data, type=None, id=None, channel="ctf"):
        # Call the original publish method first
        result = original_publish(data, type, id, channel)
        
        print(f"DEBUG: EventManager publish called - type: {type}, channel: {channel}")
        print(f"DEBUG: Data: {data}")
        
        # If this is a notification event, forward it to Discord if configured
        if type == "notification":
            try:
                discord_notifications_enabled = config.get_config("discord_notifications_enabled")
                webhook_url = config.get_config("discord_webhook_url")
                
                print(f"DEBUG: Discord notification config - enabled: {discord_notifications_enabled}, webhook: {bool(webhook_url)}")
                
                if discord_notifications_enabled and webhook_url:
                    # The data might come in different formats, handle both cases
                    notification_data = {}
                    
                    # Handle direct dictionary format
                    if isinstance(data, dict):
                        notification_data = {
                            "title": data.get("title", "Notification"),
                            "content": data.get("content", ""),
                            "type": data.get("type", "alert"),
                            "sound": data.get("sound", True)
                        }
                    # Handle object format (when data is a notification model object)
                    else:
                        notification_data = {
                            "title": getattr(data, "title", "Notification"),
                            "content": getattr(data, "content", ""),
                            "type": getattr(data, "type", "alert"),
                            "sound": getattr(data, "sound", True)
                        }
                    
                    print(f"DEBUG: Sending notification to Discord: {notification_data}")
                    send_notification_to_discord(notification_data)
                    print("DEBUG: Notification sent to Discord")
            except Exception as e:
                current_app.logger.error(f"Failed to send Discord notification: {e}")
                print(f"DEBUG: Failed to send Discord notification: {e}")
                import traceback
                traceback.print_exc()
        
        return result
    
    # Replace the publish method with our enhanced version
    app.events_manager.publish = discord_enhanced_publish
    print("DEBUG: Discord webhook integration initialized")
    
    return app


def send_solve_notification_to_discord(submission):
    """Send a solve notification to Discord if configured"""
    try:
        discord_solves_enabled = config.get_config("discord_solves_enabled")
        webhook_url = config.get_config("discord_webhook_url")
        
        if discord_solves_enabled and webhook_url and submission.type == "correct":
            # Get related data
            challenge = Challenges.query.filter_by(id=submission.challenge_id).first()
            user = Users.query.filter_by(id=submission.user_id).first() if submission.user_id else None
            team = Teams.query.filter_by(id=submission.team_id).first() if submission.team_id else None
            
            # Check if this is the first solve (first blood)
            is_first_blood = False
            if challenge:
                # Count previous correct submissions for this challenge
                previous_solves = Submissions.query.filter_by(
                    challenge_id=challenge.id,
                    type="correct"
                ).filter(Submissions.id < submission.id).count()
                
                is_first_blood = (previous_solves == 0)
            
            print(f"DEBUG: First blood check - challenge: {challenge.name if challenge else 'None'}, previous_solves: {previous_solves if challenge else 'N/A'}, is_first_blood: {is_first_blood}")
            
            send_solve_to_discord(webhook_url, challenge, user, team, is_first_blood)
    except Exception as e:
        current_app.logger.error(f"Failed to send Discord solve notification: {e}")
        print(f"DEBUG: Error in send_solve_notification_to_discord: {e}")
        import traceback
        traceback.print_exc()


# This can be called from various submission endpoints to trigger Discord notifications
def notify_discord_on_solve(submission):
    """Public function to notify Discord when a solve occurs"""
    send_solve_notification_to_discord(submission)
