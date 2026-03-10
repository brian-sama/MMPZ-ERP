from unittest.mock import Mock, patch

from django.test import TestCase

from infrastructure.queues.models import JobRecord
from infrastructure.queues.services import retry_job
from infrastructure.queues.tasks import send_email_task


class QueuePolicyTests(TestCase):
    def test_job_moves_to_dead_letter_after_max_failures(self):
        job = JobRecord.objects.create(task_name="send_email", status="queued", payload={"force_fail": True})

        for _ in range(3):
            with self.assertRaises(RuntimeError):
                send_email_task({"job_record_id": job.id, "force_fail": True})
            job.refresh_from_db()

        self.assertEqual(job.status, "dead_letter")
        self.assertEqual(job.retry_count, 3)

    def test_retry_job_requeues_failed_job(self):
        job = JobRecord.objects.create(task_name="send_email", status="failed", payload={"subject": "Test"})

        with patch("infrastructure.queues.services.send_email_task.delay", return_value=Mock(id="task-1")):
            task = retry_job(job)

        job.refresh_from_db()
        self.assertIsNotNone(task)
        self.assertEqual(job.status, "queued")
