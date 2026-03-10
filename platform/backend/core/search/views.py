from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.search.permissions import UseCommandSearchPermission
from core.search.serializers import CommandSearchResponseSerializer
from core.search.services import run_command_search


class CommandSearchView(APIView):
    permission_classes = [IsAuthenticated, UseCommandSearchPermission]

    def get(self, request):
        query = request.query_params.get("q", "")
        payload = run_command_search(query)
        serializer = CommandSearchResponseSerializer(payload)
        return Response(serializer.data)
