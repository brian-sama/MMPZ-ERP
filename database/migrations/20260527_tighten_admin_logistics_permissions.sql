-- Migration: tighten residual inherited permissions after splitting admin and logistics roles

DELETE FROM role_permissions
WHERE role_code = 'ADMIN_FINANCE_ASSISTANT'
  AND permission_code IN (
      'operations.inventory.request',
      'operations.challenge_course.read',
      'operations.challenge_course.manage'
  );
