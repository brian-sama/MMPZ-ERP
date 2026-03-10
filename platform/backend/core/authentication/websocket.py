from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication


@database_sync_to_async
def _get_user_from_token(token: str):
    authenticator = JWTAuthentication()
    validated_token = authenticator.get_validated_token(token)
    return authenticator.get_user(validated_token)


class JWTQueryStringAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token = (params.get("token") or [None])[0]
        if token:
            try:
                scope["user"] = await _get_user_from_token(token)
            except Exception:
                scope["user"] = AnonymousUser()
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    # Keep session auth support and allow JWT token override via query string.
    return AuthMiddlewareStack(JWTQueryStringAuthMiddleware(inner))
