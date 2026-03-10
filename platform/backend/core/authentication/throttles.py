from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "auth_login"


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = "auth_password_reset"


class TokenRefreshRateThrottle(AnonRateThrottle):
    scope = "auth_refresh"
