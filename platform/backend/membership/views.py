import csv
from datetime import datetime

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.common.viewsets import SoftDeleteModelViewSet
from core.notifications.services import create_audit_log
from infrastructure.cache.services import invalidate_cache_keys
from membership.models import Attendance, Contribution, Member, MembershipCategory
from membership.permissions import EditMembersPermission, ViewMembersPermission
from membership.serializers import (
    AttendanceSerializer,
    ContributionSerializer,
    MemberSerializer,
    MembershipCategorySerializer,
)
from membership.services import get_member_statistics_payload, update_member_balance_from_contribution


class MembershipCategoryViewSet(SoftDeleteModelViewSet):
    queryset = MembershipCategory.objects.all()
    serializer_class = MembershipCategorySerializer
    permission_classes = [IsAuthenticated, ViewMembersPermission]


class MemberViewSet(SoftDeleteModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer
    permission_classes = [IsAuthenticated, ViewMembersPermission]

    def get_queryset(self):
        include_deleted = self.request.query_params.get("include_deleted") in {"1", "true", "True"}
        queryset = Member.all_objects.all() if include_deleted else Member.objects.all()
        q = self.request.query_params.get("q")
        category_id = self.request.query_params.get("category_id")
        if q:
            queryset = queryset.filter(
                Q(member_id__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(email__icontains=q)
            )
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset

    def get_permissions(self):
        permissions = [IsAuthenticated()]
        if self.action in {
            "create",
            "update",
            "partial_update",
            "destroy",
            "bulk_update_category",
            "bulk_soft_delete",
            "bulk_restore",
        }:
            permissions.append(EditMembersPermission())
        else:
            permissions.append(ViewMembersPermission())
        return permissions

    def perform_create(self, serializer):
        member = serializer.save()
        invalidate_cache_keys("members:stats", "dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="members.created",
            entity="membership.member",
            entity_id=str(member.id),
            details={"member_id": member.member_id},
        )

    def perform_update(self, serializer):
        member = serializer.save()
        invalidate_cache_keys("members:stats", "dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="members.updated",
            entity="membership.member",
            entity_id=str(member.id),
            details={"member_id": member.member_id},
        )

    def perform_destroy(self, instance):
        instance.soft_delete()
        invalidate_cache_keys("members:stats", "dashboard:metrics")
        create_audit_log(
            actor=self.request.user,
            action="members.soft_deleted",
            entity="membership.member",
            entity_id=str(instance.id),
            details={"member_id": instance.member_id},
        )

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        return Response(get_member_statistics_payload())

    @action(detail=False, methods=["post"], url_path="bulk-update-category")
    def bulk_update_category(self, request):
        member_ids = request.data.get("member_ids") or []
        category_id = request.data.get("category_id")
        if not member_ids or not category_id:
            return Response(
                {"detail": "member_ids and category_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = Member.all_objects.filter(id__in=member_ids).update(category_id=category_id)
        invalidate_cache_keys("members:stats", "dashboard:metrics")
        create_audit_log(
            actor=request.user,
            action="members.bulk_category_update",
            entity="membership.member",
            details={"member_count": updated, "category_id": category_id},
        )
        return Response({"updated": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-soft-delete")
    def bulk_soft_delete(self, request):
        member_ids = request.data.get("member_ids") or []
        if not member_ids:
            return Response({"detail": "member_ids are required"}, status=status.HTTP_400_BAD_REQUEST)
        updated = Member.objects.filter(id__in=member_ids).update(deleted_at=timezone.now())
        invalidate_cache_keys("members:stats", "dashboard:metrics")
        create_audit_log(
            actor=request.user,
            action="members.bulk_soft_delete",
            entity="membership.member",
            details={"member_count": updated},
        )
        return Response({"updated": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-restore")
    def bulk_restore(self, request):
        member_ids = request.data.get("member_ids") or []
        if not member_ids:
            return Response({"detail": "member_ids are required"}, status=status.HTTP_400_BAD_REQUEST)
        updated = Member.all_objects.filter(id__in=member_ids).update(deleted_at=None)
        invalidate_cache_keys("members:stats", "dashboard:metrics")
        create_audit_log(
            actor=request.user,
            action="members.bulk_restore",
            entity="membership.member",
            details={"member_count": updated},
        )
        return Response({"updated": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="members-{timestamp}.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "member_id",
                "first_name",
                "last_name",
                "email",
                "phone",
                "category_id",
                "joined_on",
                "balance",
                "deleted_at",
            ]
        )
        for member in self.get_queryset():
            writer.writerow(
                [
                    member.id,
                    member.member_id,
                    member.first_name,
                    member.last_name,
                    member.email,
                    member.phone,
                    member.category_id or "",
                    member.joined_on,
                    member.balance,
                    member.deleted_at or "",
                ]
            )
        return response


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related("member").all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, ViewMembersPermission]


class ContributionViewSet(viewsets.ModelViewSet):
    queryset = Contribution.objects.select_related("member").all()
    serializer_class = ContributionSerializer
    permission_classes = [IsAuthenticated, EditMembersPermission]

    def perform_create(self, serializer):
        contribution = serializer.save()
        update_member_balance_from_contribution(contribution)
        create_audit_log(
            actor=self.request.user,
            action="members.contribution_recorded",
            entity="membership.contribution",
            entity_id=str(contribution.id),
            details={"member_id": contribution.member_id, "amount": str(contribution.amount)},
        )

