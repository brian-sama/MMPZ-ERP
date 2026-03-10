from rest_framework import serializers


class CommandSearchResponseSerializer(serializers.Serializer):
    navigation = serializers.ListField(child=serializers.DictField(), default=list)
    members = serializers.ListField(child=serializers.DictField(), default=list)
    documents = serializers.ListField(child=serializers.DictField(), default=list)
    events = serializers.ListField(child=serializers.DictField(), default=list)
    knowledge = serializers.ListField(child=serializers.DictField(), default=list)
