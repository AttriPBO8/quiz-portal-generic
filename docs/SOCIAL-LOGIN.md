# "Continue with Google" and "Continue with Facebook"

Quiz-takers can sign in with Google or Facebook instead of a password, **if the email address on their Google or Facebook account is the one their admin registered**. Nobody can create an account this way. People added with only a phone number keep using their password.

Both are free from Google and Facebook. Turn each one on separately for each customer. A button only appears when both of its settings are filled in.

## How it behaves

- The person clicks **Continue with Google**, picks their account, and is signed in. Google or Facebook confirms the email address. The app never sees their Google or Facebook password.
- If they were still on the shared starting password, that password is switched off for their account the first time they sign in this way, so nobody else can use it. If they want a password later, an admin uses **Reset to starting password**, and they set their own at their next sign-in.
- An unknown email, a deactivated account, or a locked account is refused with a plain message. Every attempt, successful or not, goes into the security log.
- Admin sign-in is not affected. It still uses a username and password.

## Settings (Amplify > Environment variables, then redeploy)

| Setting | Value |
| --- | --- |
| `APP_URL` | The address people use, with no slash at the end, e.g. `https://quiz.acme.com` or `https://main.d1abc.amplifyapp.com` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From step A |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | From step B (the App ID and App Secret) |

If you change the address (for example when you add your own domain), update `APP_URL` and the return address in both consoles.

## A. Google (about 15 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with your company Google account.
2. At the top, click the project picker, then **New project**. Name it after the customer, e.g. `Acme Quiz`, and click **Create**.
3. Menu > **APIs & Services** > **OAuth consent screen** (it may be called **Google Auth Platform** > **Branding**). Click **Get started**:
   - App name: the portal name. User support email: your email.
   - Audience: **External**.
   - Contact email: your email. Agree, then **Create**.
4. On **Branding**, add the app home page (`APP_URL`), privacy policy and terms links, and the authorized domain (e.g. `acme.com` or `amplifyapp.com`). Save.
5. Open **Audience** and click **Publish app**, so that anyone (not just test users) can sign in. The app only asks for name and email, which normally needs no review from Google.
6. Open **Clients** (or **Credentials** > **Create credentials** > **OAuth client ID**):
   - Application type: **Web application**. Name: `Quiz portal`.
   - **Authorized redirect URIs** > **Add URI**: `APP_URL` followed by `/auth/google/callback`, e.g. `https://quiz.acme.com/auth/google/callback`.
   - Click **Create**. Copy the **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## B. Facebook (about 20 minutes)

1. Go to [developers.facebook.com](https://developers.facebook.com), sign in, and register as a developer if asked.
2. **My Apps** > **Create app**. Name it after the portal. Use case: **Authenticate and request data from users with Facebook Login**. Choose or create a business portfolio if asked, then **Create app**.
3. In the app, open **Use cases** > **Authentication and account creation** > **Customize**:
   - Under **Permissions**, make sure **email** shows "Ready for testing" or "Added". Click **Add** if it doesn't.
   - Open **Settings** (Facebook Login settings). In **Valid OAuth Redirect URIs**, enter `APP_URL` followed by `/auth/facebook/callback`, e.g. `https://quiz.acme.com/auth/facebook/callback`. Keep **Use Strict Mode for redirect URIs** on, then save.
4. **App settings** > **Basic**: fill in the **Privacy Policy URL**, **User data deletion** (an instructions URL is fine), the category and an app icon. Save. Copy the **App ID** into `FACEBOOK_CLIENT_ID`, and click **Show** next to **App secret** to copy it into `FACEBOOK_CLIENT_SECRET`.
5. Switch the app from **Development** to **Live** (the toggle at the top, or **Publish**). In Development mode only you and other app admins can sign in. Basic sign-in with email normally needs no app review, though Facebook may ask you to verify your business.

Some Facebook accounts are opened with a phone number and have no email address. Those people see a message asking them to use their password instead.

## Keep the secrets safe

The two client secrets are like passwords. Put them only in Amplify's environment variables, never in GitHub, an email or a chat. If one leaks, create a new secret in the console, update Amplify, redeploy, then delete the old secret.
