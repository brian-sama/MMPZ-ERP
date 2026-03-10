from intranet.documents.models import Document, DocumentVersion


def create_document_version(document: Document, *, file_path: str, uploaded_by=None, change_log: str = "") -> DocumentVersion:
    next_version = (document.current_version or 0) + 1
    version = DocumentVersion.objects.create(
        document=document,
        version_number=next_version,
        file_path=file_path,
        uploaded_by=uploaded_by,
        change_log=change_log,
    )
    document.current_version = next_version
    document.file_path = file_path
    document.save(update_fields=["current_version", "file_path", "updated_at"])
    return version

