from datetime import timedelta
from decimal import Decimal

from django.db.models import F, Sum
from django.utils import timezone

from core.notifications.models import AuditLog
from finance.models import Donation, Expense
from infrastructure.cache.services import get_cached_or_compute
from infrastructure.queues.services import queue_report
from intranet.announcements.models import Announcement
from intranet.events.models import Event
from intranet.messaging.models import Message
from inventory.models import InventoryItem
from membership.models import Member
from reporting.models import ReportDefinition, ReportRun

DASHBOARD_METRICS_CACHE_KEY = "dashboard:metrics"


def queue_report_run(report: ReportDefinition, user=None) -> ReportRun:
    run = ReportRun.objects.create(report=report, status="queued", generated_by=user)
    job, task = queue_report({"report_run_id": run.id, "report_key": report.key})
    run.details = {"queue_job_id": job.id, "task_id": str(task.id)}
    run.save(update_fields=["details", "updated_at"])
    return run


def get_dashboard_metrics_payload():
    def _compute():
        now = timezone.now()
        period_30d = now - timedelta(days=30)
        period_7d = now - timedelta(days=7)

        donations_total = Donation.objects.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        expenses_total = Expense.objects.aggregate(total=Sum("amount")).get("total") or Decimal("0")
        low_stock_count = InventoryItem.objects.filter(quantity_on_hand__lte=F("reorder_level")).count()
        unread_messages = Message.objects.filter(is_read=False).count()
        upcoming_events = Event.objects.filter(starts_at__gte=now).count()
        published_announcements = Announcement.objects.filter(
            published_at__isnull=False, published_at__lte=now
        ).count()

        return {
            "members_total": Member.objects.count(),
            "new_members_last_30_days": Member.objects.filter(joined_on__gte=period_30d.date()).count(),
            "donations_total": donations_total,
            "expenses_total": expenses_total,
            "net_position": donations_total - expenses_total,
            "low_stock_count": low_stock_count,
            "unread_messages": unread_messages,
            "upcoming_events": upcoming_events,
            "announcements_live": published_announcements,
            "recent_activity_count": AuditLog.objects.filter(created_at__gte=period_7d).count(),
        }

    return get_cached_or_compute(DASHBOARD_METRICS_CACHE_KEY, _compute, timeout=180)

