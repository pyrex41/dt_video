# Getting Your Groq API Key for ClipForge Transcription

ClipForge uses Groq's AI models to transcribe your videos. Here's how to get your free API key:

## Step 1: Create a Groq Account

1. Visit [https://console.groq.com](https://console.groq.com)
2. Click "Sign Up" or "Get Started"
3. Create an account using your email or Google/GitHub

## Step 2: Generate an API Key

1. After logging in, go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Click "Create API Key"
3. Give it a name (e.g., "ClipForge Transcription")
4. Click "Submit"
5. **IMPORTANT**: Copy your API key immediately (it starts with `gsk_`)
6. Store it safely - you won't be able to see it again!

## Step 3: Use in ClipForge

1. Open ClipForge
2. Select a video clip from your timeline
3. In the Media Library sidebar, scroll to "AI Transcription"
4. Click "Add API Key"
5. Paste your Groq API key
6. Click "Transcribe Selected Clip"

## Pricing

Groq offers generous free tier with very low costs:

- **Free Tier**: 14,400 requests per day
- **Whisper V3 Turbo**: $0.04 per hour of audio
- **Llama 3.3 70B**: $0.59 per 1M input tokens / $0.79 per 1M output tokens

**Example Costs**:
- 5-minute video: ~$0.01
- 30-minute video: ~$0.03
- 1-hour video: ~$0.06

Most users will stay well within the free tier for personal use!

## Security Notes

- Your API key is stored only in the app's memory
- It is **NOT** saved to disk or sent anywhere except Groq
- You'll need to re-enter it each time you restart the app
- Never share your API key publicly

## Troubleshooting

### "Invalid API Key" Error
- Make sure you copied the entire key (starts with `gsk_`)
- Check for extra spaces before or after the key
- Generate a new key if the old one was deleted

### "Rate Limit Exceeded"
- You've hit the free tier daily limit
- Wait 24 hours or upgrade your Groq plan
- Check your usage at [https://console.groq.com/usage](https://console.groq.com/usage)

### "Network Error"
- Check your internet connection
- Verify Groq's service status
- Try again in a few minutes

## Support

For Groq API issues:
- Visit [https://console.groq.com/docs](https://console.groq.com/docs)
- Join Groq's Discord community
- Check their GitHub discussions

For ClipForge issues:
- Check the ClipForge documentation
- Report bugs on the ClipForge GitHub repository
