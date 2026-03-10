param(
    [string]$Python = "platform/backend/venv/Scripts/python.exe"
)

& $Python "platform/backend/manage.py" check
& $Python "platform/backend/manage.py" makemigrations
& $Python "platform/backend/manage.py" migrate
& $Python "platform/backend/manage.py" seed_access_control
