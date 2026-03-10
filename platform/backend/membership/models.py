from django.db import models

from core.common.models import SoftDeleteModel, TimestampedModel


class MembershipCategory(SoftDeleteModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    monthly_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "membership_categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Member(SoftDeleteModel):
    member_id = models.CharField(max_length=32, unique=True, db_index=True)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    category = models.ForeignKey(
        MembershipCategory,
        on_delete=models.SET_NULL,
        null=True,
        related_name="members",
    )
    joined_on = models.DateField()
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "members"
        indexes = [models.Index(fields=["member_id"])]
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.member_id} - {self.first_name} {self.last_name}"


class Attendance(TimestampedModel):
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="attendance_records")
    attended_on = models.DateField()
    event_name = models.CharField(max_length=120)
    status = models.CharField(max_length=20, default="present")
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "attendance"
        ordering = ["-attended_on"]
        indexes = [models.Index(fields=["member"])]


class Contribution(TimestampedModel):
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="contributions")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    contribution_date = models.DateField()
    method = models.CharField(max_length=50, default="cash")
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "contributions"
        ordering = ["-contribution_date"]
        indexes = [models.Index(fields=["member"])]

