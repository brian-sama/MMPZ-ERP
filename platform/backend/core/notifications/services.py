import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from core.notifications.models import AuditLog, Notification, SystemEvent

audit_logger = logging.getLogger("audit")


def _send_channel_group(group_name: str, payload: dict):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(group_name, {"type": "notify", "payload": payload})


def create_notification(*, user, title: str, message: str, type: str = "info", payload=None):
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        type=type,
        payload=payload or {},
    )
    _send_channel_group(
        f"notifications_{user.id}",
        {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "payload": notification.payload,
            "created_at": notification.created_at.isoformat(),
        },
    )
    return notification


def create_system_event(event_type: str, level: str = "info", payload=None):
    return SystemEvent.objects.create(event_type=event_type, level=level, payload=payload or {})


def create_audit_log(*, actor, action: str, entity: str, entity_id: str = "", details=None, ip_address=None, user_agent=""):
    record = AuditLog.objects.create(
        actor=actor,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent or "",
    )
    audit_logger.info("%s %s %s", action, entity, entity_id)
    if actor:
        _send_channel_group(
            f"notifications_{actor.id}",
            {
                "type": "activity",
                "action": action,
                "entity": entity,
                "entity_id": entity_id,
                "details": details or {},
                "created_at": record.created_at.isoformat(),
            },
        )
    return record

