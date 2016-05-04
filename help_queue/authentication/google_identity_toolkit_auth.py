from django.contrib.auth.models import User
from rest_framework.authentication import BasicAuthentication

# from help_queue import settings

# from .identitytoolkit import gitkitclient

from oauth2client import client, crypt


# gitkit_instance = gitkitclient.GitkitClient.FromConfigFile(settings.GITKIT_SETTINGS_FILE)
# CLIENT_ID =
# WEB_CLIENT_ID = "405101394-6mv8jvt0t7l172490hh8qsrq1mikn1bn.apps.googleusercontent.com"

CLIENT_ID = '405101394-6mv8jvt0t7l172490hh8qsrq1mikn1bn.apps.googleusercontent.com'
APPS_DOMAIN_NAME = 'umich.edu'


class GoogleIdentityToolkitAuth(BasicAuthentication):
    def authenticate(self, request):
        gtoken = request.COOKIES.get('gtoken')
        if not gtoken:
            print('user not logged in')
            return None
        try:
            id_info = client.verify_id_token(gtoken, CLIENT_ID)
            if id_info['aud'] != CLIENT_ID:
                raise crypt.AppIdentityError("Unrecognized client.")
            if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise crypt.AppIdentityError("Wrong issuer.")
            # Limit logins to umich.edu
            if id_info['hd'] != APPS_DOMAIN_NAME:
                raise crypt.AppIdentityError("Wrong hosted domain.")
        except crypt.AppIdentityError as e:
            print(e)
            return None
        except KeyError:
            print('gtoken not set')
            return None

        print(id_info)
        username = id_info['email']
        user = User.objects.get_or_create(username=username)[0]
        # print(user)
        return (user, None)
        # userid = id_info['sub']
        # print(userid)


        # # (Receive token by HTTPS POST)

        # try:
        #     idinfo = client.verify_id_token(request.COOKIES.get(, CLIENT_ID)
        #     # If multiple clients access the backend server:
        #     if idinfo['aud'] not in [ANDROID_CLIENT_ID, IOS_CLIENT_ID, WEB_CLIENT_ID]:
        #         raise crypt.AppIdentityError("Unrecognized client.")
        #     if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
        #         raise crypt.AppIdentityError("Wrong issuer.")
        #     if idinfo['hd'] != APPS_DOMAIN_NAME:
        #         raise crypt.AppIdentityError("Wrong hosted domain.")
        # except crypt.AppIdentityError:
        #     return None
        #     # Invalid token

        # user_id = idinfo['sub']
        # print(user_id)
        # print(idinfo, ...)
        # # user = User.objects.get_or_create(username=gitkit_user.email)[0]

        # # return (user, None)

        # # # print(request.path)
        # # # if request.path == '/callback/':
        # # #     print('login page requested. setting anonymous user')
        # # #     request.user = AnonymousUser()
        # # #     return None

        # # gtoken = request.COOKIES.get('gtoken', None)
        # # if gtoken is None:
        # #     print('gtoken not set')
        # #     return None

        # # gitkit_user = gitkit_instance.VerifyGitkitToken(gtoken)
        # # # logger.info(gitkit_user)
        # # if not gitkit_user:
        # #     print("error verifying token")
        # #     return None

        # # if gitkit_user.email.split('@')[-1] != "umich.edu":
        # #     print("not a umich email")
        # #     return None

        # # user = User.objects.get_or_create(username=gitkit_user.email)[0]

        # # return (user, None)
