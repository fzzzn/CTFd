from flask import Blueprint, render_template

from CTFd.models import Solves, db
from CTFd.utils import config
from CTFd.utils.config.visibility import scores_visible
from CTFd.utils.decorators.visibility import (
    check_account_visibility,
    check_score_visibility,
)
from CTFd.utils.helpers import get_infos
from CTFd.utils.modes import get_model
from CTFd.utils.scores import get_standings
from CTFd.utils.user import is_admin

scoreboard = Blueprint("scoreboard", __name__)


def get_standings_with_solve_count():
    """Get standings with solve count for each account"""
    standings = get_standings()
    
    if not standings:
        return standings
    
    # Get solve counts for each account
    solve_counts = (
        db.session.query(
            Solves.account_id,
            db.func.count(Solves.id).label("count")
        )
        .group_by(Solves.account_id)
        .all()
    )
    
    # Create a mapping of account_id to solve count
    solve_count_map = {account_id: count for account_id, count in solve_counts}
    
    # Add solve count to each standing
    standings_with_count = []
    for standing in standings:
        # Create a simple object to hold the data with solve count
        class StandingWithCount:
            def __init__(self, original_standing, solve_count):
                # Copy all attributes from original standing
                if hasattr(original_standing, '_asdict'):
                    # Handle NamedTuple
                    for key, value in original_standing._asdict().items():
                        setattr(self, key, value)
                else:
                    # Handle regular objects - copy common attributes
                    common_attrs = ['account_id', 'oauth_id', 'name', 'bracket_id', 'bracket_name', 'score', 'hidden', 'banned']
                    for attr in common_attrs:
                        if hasattr(original_standing, attr):
                            setattr(self, attr, getattr(original_standing, attr))
                
                # Add solve count
                self.count = solve_count
        
        solve_count = solve_count_map.get(standing.account_id, 0)
        standings_with_count.append(StandingWithCount(standing, solve_count))
    
    return standings_with_count


@scoreboard.route("/scoreboard")
@check_account_visibility
@check_score_visibility
def listing():
    infos = get_infos()

    if config.is_scoreboard_frozen():
        infos.append("Scoreboard has been frozen")

    if is_admin() is True and scores_visible() is False:
        infos.append("Scores are not currently visible to users")

    standings = get_standings_with_solve_count()
    return render_template("scoreboard.html", standings=standings, infos=infos)
