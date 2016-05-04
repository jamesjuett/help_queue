from rest_framework import serializers, viewsets, permissions

from . import models


class HelpRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.HelpRequest
        fields = (
            'user',
            'timestamp',
            'location',
            'description',
            'name',
            'help_session',
        )


class HelpRequestListCreate(viewsets.ModelViewSet):
    queryset = models.HelpRequest.objects.all()
    serializer_class = HelpRequestSerializer

    permission_classes = (permissions.IsAuthenticated,)
