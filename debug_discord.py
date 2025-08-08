#!/usr/bin/env python3
"""
Debug script for Discord webhook integration
Run this in the CTFd environment to check configuration
"""

def check_discord_config():
    """Check Discord configuration from the CTFd database"""
    try:
        from CTFd.utils import get_config
        
        print("🔧 Discord Configuration Check")
        print("=" * 40)
        
        webhook_url = get_config("discord_webhook_url")
        solves_enabled = get_config("discord_solves_enabled")
        notifications_enabled = get_config("discord_notifications_enabled")
        
        print(f"Webhook URL configured: {bool(webhook_url)}")
        if webhook_url:
            print(f"Webhook URL preview: {webhook_url[:50]}...")
        
        print(f"Solves enabled: {solves_enabled}")
        print(f"Notifications enabled: {notifications_enabled}")
        
        if webhook_url and solves_enabled:
            print("\n✅ Configuration looks good for solve notifications")
        else:
            print("\n❌ Configuration issues found:")
            if not webhook_url:
                print("  - No webhook URL configured")
            if not solves_enabled:
                print("  - Solve notifications not enabled")
        
        return webhook_url, solves_enabled, notifications_enabled
        
    except Exception as e:
        print(f"❌ Error checking configuration: {e}")
        return None, None, None

def test_discord_function():
    """Test Discord function directly"""
    try:
        from CTFd.utils.integrations.discord import send_solve_to_discord
        
        print("\n🧪 Testing Discord Function")
        print("=" * 40)
        
        result = send_solve_to_discord(
            team_name="Test Team",
            user_name="Test User", 
            challenge_name="Test Challenge",
            challenge_value=100,
            challenge_category="Test"
        )
        
        print(f"Function result: {result}")
        
        if result:
            print("✅ Discord function executed successfully")
        else:
            print("❌ Discord function returned False")
            
        return result
        
    except Exception as e:
        print(f"❌ Error testing Discord function: {e}")
        return False

if __name__ == "__main__":
    import sys
    import os
    
    # Try to set up CTFd context
    try:
        # Add CTFd to path if running from CTFd directory
        sys.path.insert(0, os.getcwd())
        
        # Try to create app context
        from CTFd import create_app
        app = create_app()
        
        with app.app_context():
            check_discord_config()
            test_discord_function()
            
    except Exception as e:
        print(f"❌ Could not set up CTFd context: {e}")
        print("Run this script from within a running CTFd instance or python shell with CTFd imported")
