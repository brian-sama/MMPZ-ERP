from core.permissions.permissions import permission_required


ViewMembersPermission = permission_required("members.view")
EditMembersPermission = permission_required("members.edit")

