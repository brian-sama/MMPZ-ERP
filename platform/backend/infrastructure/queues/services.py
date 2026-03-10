from django.utils import timezone

from infrastructure.queues.models import JobRecord
from infrastructure.queues.tasks import (
    MAX_JOB_RETRIES,
    export_data_task,
    generate_report_task,
    push_notification_task,
    send_email_task,
)


TASK_DISPATCHERS = {
    "send_email": send_email_task,
    "generate_report": generate_report_task,
    "push_notification": push_notification_task,
    "export_data": export_data_task,
}


def _enqueue_task(task_name: str, payload: dict | None):
    payload = payload or {}
    job = JobRecord.objects.create(
        task_name=task_name,
        status="queued",
        payload=payload,
        scheduled_for=timezone.now(),
    )
    dispatcher = TASK_DISPATCHERS[task_name]
    task_payload = {**payload, "job_record_id": job.id}
    task_result = dispatcher.delay(task_payload)
    return job, task_result


def queue_email(payload: dict):
    return _enqueue_task("send_email", payload)


def queue_report(payload: dict):
    return _enqueue_task("generate_report", payload)


def queue_notification(payload: dict):
    return _enqueue_task("push_notification", payload)


def queue_export(payload: dict):
    return _enqueue_task("export_data", payload)


def retry_job(job: JobRecord):
    if job.status != "failed":
        return None
    if job.retry_count >= MAX_JOB_RETRIES:
        job.status = "dead_letter"
        job.save(update_fields=["status", "updated_at"])
        return None
    job.status = "queued"
    job.scheduled_for = timezone.now()
    job.save(update_fields=["status", "scheduled_for", "updated_at"])
    dispatcher = TASK_DISPATCHERS.get(job.task_name)
    if not dispatcher:
        job.status = "failed"
        job.last_error = f"No task dispatcher configured for {job.task_name}"
        job.save(update_fields=["status", "last_error", "updated_at"])
        return None
    task_payload = {**(job.payload or {}), "job_record_id": job.id}
    return dispatcher.delay(task_payload)

