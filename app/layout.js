import './globals.css';

export const metadata = {
  title: 'Standup Wall — AI Daily Standup Board',
  description: 'AI-powered daily standup clarity board. Turn raw updates into summaries, blockers, risk levels and next actions. Powered by Groq.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
