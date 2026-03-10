from datetime import timedelta

from django.db.models import Count, Sum
from django.db import transaction
from django.utils import timezone

from infrastructure.cache.services import get_cached_or_compute, invalidate_cache_keys
from membership.models import Contribution, Member

MEMBER_STATS_CACHE_KEY = "members:stats"


@transaction.atomic
def update_member_balance_from_contribution(contribution: Contribution) -> Member:
    member = contribution.member
    member.balance = (member.balance or 0) + contribution.amount
    member.save(update_fields=["balance", "updated_at"])
    invalidate_cache_keys(MEMBER_STATS_CACHE_KEY, "dashboard:metrics")
    return member


def get_member_statistics_payload():
    def _compute():
        today = timezone.now().date()
        new_member_cutoff = today - timedelta(days=30)
        totals = Member.objects.aggregate(total_members=Count("id"), total_balances=Sum("balance"))
        contribution_total = Contribution.objects.aggregate(total=Sum("amount")).get("total") or 0
        return {
            "total_members": totals.get("total_members") or 0,
            "new_members_last_30_days": Member.objects.filter(joined_on__gte=new_member_cutoff).count(),
            "aggregate_member_balance": totals.get("total_balances") or 0,
            "contribution_total": contribution_total,
        }

    return get_cached_or_compute(MEMBER_STATS_CACHE_KEY, _compute, timeout=300)

