from core.permissions.permissions import permission_required


ViewUsersPermission = permission_required("members.view")
EditUsersPermission = permission_required("members.edit")

