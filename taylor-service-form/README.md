# Taylor Upstate — Service Request Form
Captures service request → generates styled PDF → emails to dispatch

## Project Structure
```
/
├── index.html                      ← The form
├── netlify.toml                    ← Netlify config
├── package.json                    ← Dependencies
├── .env.example                    ← Copy to .env for local dev
└── netlify/
    └── functions/
        └── submit-service.js       ← Serverless function: PDF + email
```

## Setup (15 minutes total)

### Step 1 — Get a free Resend API key
1. Go to resend.com → Sign Up (free)
2. Click "Add API Key" → name it "Taylor Upstate Service Form"
3. Copy the key (starts with `re_`)
4. For testing: use `onboarding@resend.dev` as the FROM address
5. For production: verify `taylorupstate.com` in Resend (5 min, adds DNS records)

### Step 2 — Deploy to Netlify
1. Push this folder to a GitHub repo (github.com → New repo → drag folder in)
2. Go to app.netlify.com → "Add new site" → "Import from Git"
3. Connect your GitHub account → select the repo
4. Build settings are auto-detected from netlify.toml
5. Click "Deploy site"

### Step 3 — Add environment variables in Netlify
Site Settings → Environment Variables → Add:

| Key | Value |
|-----|-------|
| `RESEND_API_KEY` | `re_your_key_here` |
| `TO_EMAIL` | `estewart@taylorupstate.com` |
| `FROM_EMAIL` | `onboarding@resend.dev` (testing) or `service@taylorupstate.com` (production) |
| `FROM_NAME` | `Taylor Upstate Service Form` |

### Step 4 — Redeploy
After adding env vars: Deploys tab → "Trigger deploy" → "Deploy site"

### Step 5 — Test
Visit your Netlify URL → fill the form → check estewart@taylorupstate.com for the PDF

---

## Changing the recipient email
Just update the `TO_EMAIL` environment variable in Netlify — no code changes needed.

## Local Development
```bash
npm install -g netlify-cli
npm install
cp .env.example .env   # fill in your values
netlify dev            # runs at http://localhost:8888
```

---

## Adding a Database (Optional — see below)

### Option A: Airtable (Recommended — easiest, no coding)
**Difficulty: Easy | Cost: Free | Time: ~1 hour**

Airtable looks like a spreadsheet but is a real database. Perfect for non-technical staff to view submissions.

1. Create free account at airtable.com
2. Create a base called "Taylor Upstate Service Requests"
3. Add columns matching the form fields
4. Get your API key from airtable.com/account
5. Get your Base ID from airtable.com/api
6. Add to Netlify env vars: `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID`
7. Add this to the submit-service.js function after email sends:

```javascript
// Save to Airtable
await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Service%20Requests`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fields: {
      'Name': `${data.first_name} ${data.last_name}`,
      'Company': data.company,
      'Phone': data.phone,
      'Email': data.email,
      'County': data.county,
      'Equipment Brand': data.equipment_brand,
      'Model': data.model_number,
      'Priority': data.priority,
      'Issue Type': data.issue_type,
      'Description': data.problem_description,
      'Submitted': new Date().toISOString()
    }
  })
});
```

### Option B: Netlify Forms (Built-in — zero setup)
**Difficulty: Very Easy | Cost: Free (100/mo) | Time: 10 minutes**

Add `netlify` attribute to the form tag and a hidden input:
```html
<form id="service-form" name="service-request" netlify netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="service-request">
```
Submissions appear in Netlify dashboard → Forms. Free up to 100/month.
$19/month for unlimited. No database code needed — Netlify stores everything.

### Option C: Supabase (Full Database — most powerful)
**Difficulty: Medium | Cost: Free | Time: ~2 hours**

PostgreSQL database with a nice admin UI. Best if you want to filter, search, and report on submissions.

1. Create free account at supabase.com
2. New project → create a `service_requests` table
3. Add env var: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
4. Add `@supabase/supabase-js` to package.json
5. Insert record in the function after email sends

---

## Recommendation for Taylor Upstate

For a service business receiving maybe 50-200 requests/month:

**Start with Netlify Forms** (free, built-in, zero setup) to store submissions as a backup alongside the email PDF. If you want a proper searchable database later, add Airtable — it takes about an hour and anyone can view/filter submissions without logging into Netlify.
