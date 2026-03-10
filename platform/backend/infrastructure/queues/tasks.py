from django.utils import timezone
from celery import shared_task

from infrastructure.queues.models import JobRecord

MAX_JOB_RETRIES = 3


def _mark_job_started(job: JobRecord):
    job.status = "processing"
    if not job.started_at:
        job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at", "updated_at"])


def _mark_job_success(job: JobRecord):
    job.status = "completed"
    job.finished_at = timezone.now()
    job.last_error = ""
    job.save(update_fields=["status", "finished_at", "last_error", "updated_at"])


def _mark_job_failure(job: JobRecord, error: Exception):
    job.retry_count += 1
    job.last_error = str(error)
    job.finished_at = timezone.now()
    job.status = "dead_letter" if job.retry_count >= MAX_JOB_RETRIES else "failed"
    job.save(update_fields=["retry_count", "last_error", "finished_at", "status", "updated_at"])


def _get_job_from_payload(payload: dict) -> JobRecord | None:
    job_id = (payload or {}).get("job_record_id")
    if not job_id:
        return None
    return JobRecord.objects.filter(id=job_id).first()


def _execute_job(payload: dict):
    if (payload or {}).get("force_fail"):
        raise RuntimeError("Forced task failure requested by payload")
    return {"status": "completed"}


@shared_task
def send_email_task(payload: dict):
    job = _get_job_from_payload(payload)
    try:
        if job:
            _mark_job_started(job)
        result = _execute_job(payload or {})
        if job:
            _mark_job_success(job)
        result["task"] = "send_email"
        return result
    except Exception as exc:
        if job:
            _mark_job_failure(job, exc)
        raise


@shared_task
def generate_report_task(payload: dict):
    job = _get_job_from_payload(payload)
    try:
        if job:
            _mark_job_started(job)
        result = _execute_job(payload or {})
        if job:
            _mark_job_success(job)
        result["task"] = "generate_report"
        return result
    except Exception as exc:
        if job:
            _mark_job_failure(job, exc)
        raise


@shared_task
def push_notification_task(payload: dict):
    job = _get_job_from_payload(payload)
    try:
        if job:
            _mark_job_started(job)
        result = _execute_job(payload or {})
        if job:
            _mark_job_success(job)
        result["task"] = "push_notification"
        return result
    except Exception as exc:
        if job:
            _mark_job_failure(job, exc)
        raise


@shared_task
def export_data_task(payload: dict):
    job = _get_job_from_payload(payload)
    try:
        if job:
            _mark_job_started(job)
        result = _execute_job(payload or {})
        if job:
            _mark_job_success(job)
        result["task"] = "export_data"
        return result
    except Exception as exc:
        if job:
            _mark_job_failure(job, exc)
        raise
