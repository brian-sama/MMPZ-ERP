from core.notifications.services import create_system_event


def log_announcement_published(title: str):
    create_system_event(
        event_type="announcement.published",
        payload={"title": title},
    )

