from django.urls import path

from core.search.views import CommandSearchView

urlpatterns = [
    path("search/command", CommandSearchView.as_view(), name="search-command"),
]
