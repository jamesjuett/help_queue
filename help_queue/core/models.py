from django.db import models
from django.contrib.auth.models import User


class HelpSession(models.Model):
    is_open = models.BooleanField(default=False)

    admins = models.ManyToManyField(User)


class HelpRequest(models.Model):
    user = models.OneToOneField(User)
    timestamp = models.DateTimeField(auto_now_add=True)
    location = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    help_session = models.ForeignKey(HelpSession)
