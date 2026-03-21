import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paris Baguette FR-1554 — Dashboard',
  description: 'Business analytics dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
