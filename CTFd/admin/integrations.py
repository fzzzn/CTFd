from flask import render_template, request, redirect, url_for
from sqlalchemy.exc import IntegrityError

from CTFd.models import db
from CTFd.admin import admin
from CTFd.utils import config
from CTFd.utils.decorators import admins_only
from CTFd.utils.integrations.discord import test_discord_webhook


@admin.route("/admin/integrations/discord", methods=["GET", "POST"])
@admins_only
def discord_config():
    if request.method == "POST":
        # Get form data
        webhook_url = request.form.get("webhook_url", "").strip()
        webhook_name = request.form.get("webhook_name", "").strip()
        notifications_enabled = request.form.get("notifications_enabled") == "on"
        solves_enabled = request.form.get("solves_enabled") == "on"
        
        # Save configuration
        config.set_config("discord_webhook_url", webhook_url)
        config.set_config("discord_webhook_name", webhook_name)
        config.set_config("discord_notifications_enabled", notifications_enabled)
        config.set_config("discord_solves_enabled", solves_enabled)
        
        try:
            db.session.commit()
            return redirect(url_for("admin.discord_config"))
        except IntegrityError:
            db.session.rollback()
    
    # Get current configuration
    webhook_url = config.get_config("discord_webhook_url", default="")
    webhook_name = config.get_config("discord_webhook_name", default="")
    notifications_enabled = config.get_config("discord_notifications_enabled", default=False)
    solves_enabled = config.get_config("discord_solves_enabled", default=False)
    
    return render_template(
        "configs/discord.html",
        webhook_url=webhook_url,
        webhook_name=webhook_name,
        notifications_enabled=notifications_enabled,
        solves_enabled=solves_enabled,
    )
