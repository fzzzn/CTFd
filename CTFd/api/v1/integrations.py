from flask import request
from flask_restx import Namespace, Resource

from CTFd.api.v1.schemas import APISimpleSuccessResponse
from CTFd.utils.decorators import admins_only
from CTFd.utils.integrations.discord import test_discord_webhook, send_discord_webhook


integrations_namespace = Namespace(
    "integrations", description="Endpoint for external integrations"
)


@integrations_namespace.route("/discord/test")
class DiscordTest(Resource):
    @admins_only
    @integrations_namespace.doc(
        description="Test Discord webhook configuration",
        responses={
            200: ("Success", "APISimpleSuccessResponse"),
            400: ("Bad Request", "APISimpleErrorResponse"),
        },
    )
    def post(self):
        """Test Discord webhook functionality"""
        req = request.get_json()
        webhook_url = req.get("webhook_url")
        
        if not webhook_url:
            return {"success": False, "error": "Webhook URL is required"}, 400
        
        # Test the webhook with the provided URL
        success = send_discord_webhook(
            webhook_url=webhook_url,
            title="🔧 CTFd Discord Integration Test",
            content="Discord webhook integration is working correctly!",
            color=0x5CC9BB,
            username="CTFd Test"
        )
        
        if success:
            return {"success": True, "message": "Test message sent successfully"}
        else:
            return {"success": False, "error": "Failed to send test message"}, 400
