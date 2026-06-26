@echo off
echo Starting Standup Wall - AI Daily Standup Clarity Board...
echo.
if not exist .env.local (
  echo Creating .env.local from .env.example
  copy .env.example .env.local
  echo.
  echo Please open .env.local and add your JWT_SECRET, GROQ_API_KEY, and optional MONGODB_URI.
  echo.
)
npm install
npm run dev
pause
