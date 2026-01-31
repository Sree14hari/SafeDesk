# AI Security Advisor - Setup Guide

## Overview

SecureEngine includes an **optional** AI-powered security advisor that dynamically adjusts session timeouts based on behavioral patterns. The AI can only **tighten** security, never weaken it.

## Current Status

✅ **System is fully functional without AI** - Running in secure baseline mode (5-minute timeout)

The AI integration is currently **disabled** because no valid API key is configured.

## How It Works

### Without AI (Current Mode)

- **Timeout**: Fixed 5 minutes of inactivity
- **Risk Level**: Always "Low"
- **Reasoning**: "Baseline Protection"
- **Cost**: Free
- **Privacy**: 100% local

### With AI (Optional)

- **Timeout**: 1-5 minutes (AI can reduce based on risk)
- **Risk Level**: Low/Medium/High (dynamic)
- **Reasoning**: Plain English explanation (e.g., "Multiple files uploaded late at night")
- **Cost**: Free tier available
- **Privacy**: Only anonymized metadata sent (no file names/content)

## Enabling AI (Optional)

### Step 1: Get an OpenRouter API Key

1. Visit: https://openrouter.ai/
2. Sign up for a free account
3. Go to: https://openrouter.ai/keys
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

### Step 2: Configure the API Key

Edit the `.env` file in the project root:

```bash
# Replace the empty value with your API key
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
```

### Step 3: Restart the Application

```bash
npm run dev
```

### Step 4: Verify It's Working

Start a session and check the console. You should see:

- No error messages about "401 Unauthorized"
- AI status updates in the floating button
- Dynamic timeout values in the dashboard

## AI Behavior Examples

### Scenario 1: Normal Usage (Morning, 1 file, active user)

```
Risk: LOW
Timeout: 5 minutes (no change)
Reason: "Normal activity during business hours"
```

### Scenario 2: Suspicious Pattern (Late night, 5 files, idle user)

```
Risk: MEDIUM
Timeout: 3 minutes (tightened!)
Reason: "Multiple files uploaded late at night with user idle"
```

### Scenario 3: High Risk (Long session, very idle)

```
Risk: HIGH
Timeout: 1 minute (maximum security!)
Reason: "Extended session with prolonged inactivity - potential abandonment"
```

## What Data is Sent to AI?

### ✅ Sent (Anonymized Metadata Only)

```json
{
  "session_age_minutes": 10.5,
  "user_idle_minutes": 3.2,
  "files_uploaded": 5,
  "time_of_day": "late_night",
  "environment_type": "internet_cafe_public"
}
```

### ❌ NEVER Sent

- File names
- File contents
- User identity
- IP addresses
- File paths
- Any personal data

## Security Guarantees

Even with AI enabled:

1. **AI can NEVER weaken security**
   - Baseline timeout: 5 minutes
   - AI can only reduce it (1-5 minutes)
   - Enforced by: `Math.min(baseline, ai_recommendation)`

2. **AI failures are safe**
   - If API fails → Falls back to baseline (5 min)
   - If API returns invalid data → Uses baseline
   - If network is down → Uses baseline

3. **Privacy is maintained**
   - No file content ever leaves your machine
   - Only behavioral metadata is analyzed
   - All file operations remain 100% local

## Troubleshooting

### "401 Unauthorized" Error

- Your API key is invalid or expired
- Get a new key from https://openrouter.ai/keys
- Make sure there are no extra spaces in the `.env` file

### AI Not Changing Timeout

- AI checks every 5 minutes (not immediately)
- First check happens 5 minutes after session starts
- AI may decide baseline is appropriate (no change needed)

### Want to Disable AI Again?

Simply clear the API key in `.env`:

```bash
OPENROUTER_API_KEY=
```

## Cost

OpenRouter offers:

- **Free tier**: `upstage/solar-pro-3:free` (currently used)
- **Rate limits**: Sufficient for normal use
- **No credit card required** for free tier

## Support

If you encounter issues:

1. Check the console for error messages
2. Verify your API key is valid
3. Ensure you have internet connectivity
4. Remember: The system works perfectly without AI!

---

**Bottom Line**: The AI is a nice-to-have feature that can make security more adaptive, but SecureEngine is designed to be fully secure and functional without it.
