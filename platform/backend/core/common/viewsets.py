from rest_framework import viewsets


class SoftDeleteModelViewSet(viewsets.ModelViewSet):
    """
    Use model-level soft delete when available to avoid destructive API deletes.
    """

    def perform_destroy(self, instance):
        if hasattr(instance, "soft_delete"):
            instance.soft_delete()
            return
        super().perform_destroy(instance)
