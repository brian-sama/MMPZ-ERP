# Netlify Build Settings for MMPZ System

## For Netlify Dashboard

**Branch to deploy:** `main`

**Base directory:** (leave empty)

**Build command:** `cd client && npm install && npm run build`

**Publish directory:** `client/dist`

**Functions directory:** `netlify/functions`

---

## Environment Variables to Add in Netlify

Go to: Site settings → Environment variables → Add a variable

1. **SUPABASE_URL**
   - Value: `https://ubolrymqivuzgnxmunsi.supabase.co`

2. **SUPABASE_ANON_KEY**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVib2xyeW1xaXZ1emdueG11bnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzIwODUsImV4cCI6MjA4MjI0ODA4NX0.tg0mlUPu-trVjeMTTTCHrEuNSIc8TADEnlv1mlEADpU`

---

## Note

The `netlify.toml` file in the root already contains these settings, so Netlify should auto-detect them. If the form is empty, you can manually enter the values above.
