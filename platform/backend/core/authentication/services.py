from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

User = get_user_model()


def send_password_reset_email(email: str, frontend_base_url: str = "http://localhost:5173") -> None:
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_link = f"{frontend_base_url}/reset-password?uid={uid}&token={token}"
    send_mail(
        "Password Reset Request",
        f"Use this link to reset your password: {reset_link}",
        None,
        [user.email],
        fail_silently=True,
    )


def reset_password(uid: str, token: str, new_password: str) -> bool:
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return False

    if not default_token_generator.check_token(user, token):
        return False

    user.set_password(new_password)
    user.must_reset_password = False
    user.save(update_fields=["password", "must_reset_password", "updated_at"] if hasattr(user, "updated_at") else ["password", "must_reset_password"])
    return True

