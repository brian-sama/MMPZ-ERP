from django.db.models import Q

from intranet.directory.models import KnowledgeArticle
from intranet.documents.models import Document
from intranet.events.models import Event
from membership.models import Member


NAVIGATION_ITEMS = [
    {"label": "Dashboard", "to": "/dashboard", "type": "navigation"},
    {"label": "Members", "to": "/erp/members", "type": "navigation"},
    {"label": "Finance", "to": "/erp/finance", "type": "navigation"},
    {"label": "Assets", "to": "/erp/assets", "type": "navigation"},
    {"label": "Inventory", "to": "/erp/inventory", "type": "navigation"},
    {"label": "Reports", "to": "/erp/reports", "type": "navigation"},
    {"label": "Announcements", "to": "/intranet/announcements", "type": "navigation"},
    {"label": "Documents", "to": "/intranet/documents", "type": "navigation"},
    {"label": "Messaging", "to": "/intranet/messaging", "type": "navigation"},
    {"label": "Events", "to": "/intranet/events", "type": "navigation"},
    {"label": "Directory", "to": "/intranet/directory", "type": "navigation"},
    {"label": "Knowledge Base", "to": "/intranet/knowledge-base", "type": "navigation"},
]


def run_command_search(query: str, limit: int = 6):
    normalized = (query or "").strip().lower()
    if not normalized:
        return {"navigation": NAVIGATION_ITEMS[:limit], "members": [], "documents": [], "events": [], "knowledge": []}

    navigation = [
        item
        for item in NAVIGATION_ITEMS
        if normalized in item["label"].lower() or normalized in item["to"].lower()
    ][:limit]

    members = [
        {
            "id": member.id,
            "member_id": member.member_id,
            "name": f"{member.first_name} {member.last_name}".strip(),
        }
        for member in Member.objects.filter(
            Q(member_id__icontains=normalized)
            | Q(first_name__icontains=normalized)
            | Q(last_name__icontains=normalized)
            | Q(email__icontains=normalized)
        )[:limit]
    ]

    documents = [
        {"id": doc.id, "title": doc.title, "category": doc.category}
        for doc in Document.objects.filter(title__icontains=normalized)[:limit]
    ]

    events = [
        {"id": event.id, "title": event.title, "starts_at": event.starts_at}
        for event in Event.objects.filter(title__icontains=normalized)[:limit]
    ]

    knowledge = [
        {"id": article.id, "title": article.title, "slug": article.slug}
        for article in KnowledgeArticle.objects.filter(title__icontains=normalized)[:limit]
    ]

    return {
        "navigation": navigation,
        "members": members,
        "documents": documents,
        "events": events,
        "knowledge": knowledge,
    }
