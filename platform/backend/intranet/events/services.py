from infrastructure.queues.tasks import push_notification_task


def queue_event_reminder(event_id: int):
    push_notification_task.delay({"event_id": event_id, "type": "event.reminder"})

