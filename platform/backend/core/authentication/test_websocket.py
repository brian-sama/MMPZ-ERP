import asyncio
from unittest.mock import patch
from urllib.parse import urlencode

from django.contrib.auth.models import AnonymousUser
from django.test import TestCase

from core.authentication.websocket import JWTQueryStringAuthMiddleware
from core.users.models import User


class WebsocketJwtAuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ws@example.com",
            username="ws-user",
            password="SecurePass123!",
        )

    def test_middleware_sets_authenticated_user_for_valid_token(self):
        captured = {}

        async def app(scope, receive, send):
            captured["user"] = scope.get("user")
            await send({"type": "websocket.close"})

        middleware = JWTQueryStringAuthMiddleware(app)

        async def resolve_user(_token):
            return self.user

        async def _run():
            scope = {
                "type": "websocket",
                "query_string": urlencode({"token": "valid-token"}).encode(),
            }

            async def _receive():
                return {"type": "websocket.connect"}

            async def _send(_message):
                return None

            with patch("core.authentication.websocket._get_user_from_token", side_effect=resolve_user):
                await middleware(scope, _receive, _send)

        asyncio.run(_run())
        self.assertEqual(captured["user"].id, self.user.id)

    def test_middleware_sets_anonymous_user_for_invalid_token(self):
        captured = {}

        async def app(scope, receive, send):
            captured["user"] = scope.get("user")
            await send({"type": "websocket.close"})

        middleware = JWTQueryStringAuthMiddleware(app)

        async def reject_user(_token):
            raise ValueError("invalid")

        async def _run():
            scope = {
                "type": "websocket",
                "query_string": urlencode({"token": "invalid-token"}).encode(),
            }

            async def _receive():
                return {"type": "websocket.connect"}

            async def _send(_message):
                return None

            with patch("core.authentication.websocket._get_user_from_token", side_effect=reject_user):
                await middleware(scope, _receive, _send)

        asyncio.run(_run())
        self.assertIsInstance(captured["user"], AnonymousUser)
        self.assertFalse(captured["user"].is_authenticated)
