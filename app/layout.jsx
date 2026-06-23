import './globals.css'

export const metadata = {
  title: 'Student Daily Planner',
  description: 'A student planner app with authentication and CRUD tasks'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
