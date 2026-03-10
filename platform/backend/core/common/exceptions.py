from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def standardized_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return Response(
            {
                "success": False,
                "error": {
                    "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "message": "Internal server error",
                    "details": {},
                },
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    if isinstance(detail, dict):
        message = detail.get("detail") or "Request failed"
    elif isinstance(detail, list):
        message = "Validation error"
    else:
        message = str(detail)

    response.data = {
        "success": False,
        "error": {
            "status": response.status_code,
            "message": message,
            "details": detail,
        },
    }
    return response
