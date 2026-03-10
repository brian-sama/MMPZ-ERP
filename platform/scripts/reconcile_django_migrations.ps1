param(
    [string]$Python = "platform/backend/venv/Scripts/python.exe"
)

$appsToFake = @(
    "finance",
    "inventory",
    "membership",
    "roles",
    "permissions",
    "users",
    "notifications"
)

foreach ($app in $appsToFake) {
    & $Python "platform/backend/manage.py" migrate $app 0001 --fake
}

& $Python "platform/backend/manage.py" migrate
