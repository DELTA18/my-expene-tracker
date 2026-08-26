# Pocket Ledger

A simple expense tracker. Next.js + shadcn/ui on the frontend, a free
Firebase (Firestore) project as the database, deployed on Vercel — all
free tiers, no card required.

## 1. Create a free Firebase project

1. Go to https://console.firebase.google.com and sign in with any
   Google account.
2. Click **Add project**. Give it any name (e.g. `pocket-ledger`).
   You can turn off Google Analytics for this project — it's not
   needed.
3. Once the project is created, click the **Web** icon (`</>`) on the
   project overview page to register a new web app. Give it a
   nickname (e.g. `pocket-ledger-web`) and click **Register app**.
   You don't need Firebase Hosting.
4. Firebase will show you a `firebaseConfig` object with values like
   `apiKey`, `authDomain`, `projectId`, etc. Keep this page open —
   you'll copy these into `.env.local` in step 3.

## 2. Turn on Firestore (the database)

1. In the left sidebar of the Firebase console, go to
   **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location close to you (any is fine) and start in
   **production mode**.
4. Once it's created, go to the **Rules** tab and replace the
   contents with what's in [`firestore.rules`](./firestore.rules) in
   this project:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /expenses/{expenseId} {
         allow read, write: if true;
       }
     }
   }
   ```

   Click **Publish**.

   **Note on privacy:** these rules let anyone who has your site's URL
   read and write your expenses — there's no login. That's the
   tradeoff for keeping this a zero-login, zero-friction personal
   tool. Don't share the link publicly. If you'd like real
   password-protected access later, that's a small follow-up (Firebase
   Auth) — just ask.

## 3. Add your config to the app

1. In this project folder, copy `.env.local.example` to `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in the values from the `firebaseConfig`
   object you saw in step 1:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

   `.env.local` is already git-ignored, so these values never get
   committed.

## 4. Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should be able to add an expense and
see it in the list immediately.

## 5. Deploy for free on Vercel

1. Push this project to a GitHub repo (create one on github.com, then
   `git init`, `git add .`, `git commit`, and follow GitHub's push
   instructions — or ask me to do this with you).
2. Go to https://vercel.com, sign up with your GitHub account (free,
   no card).
3. Click **Add New → Project**, pick this repo.
4. Before deploying, expand **Environment Variables** and add the same
   six `NEXT_PUBLIC_FIREBASE_...` values from your `.env.local`.
5. Click **Deploy**. You'll get a free `*.vercel.app` URL — open it on
   your phone and add it to your home screen.

Every time you push to the repo's main branch, Vercel redeploys
automatically.
