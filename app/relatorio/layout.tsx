import type { ReactNode } from 'react'
import type { Viewport } from 'next'

export const viewport: Viewport = {
  colorScheme: 'light',
}

export default function RelatorioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        :root,
        :root[data-theme],
        [data-theme="dark"],
        [data-theme="light"] {
          --background: #ffffff !important;
          --foreground: #1a2a3a !important;
          color-scheme: light !important;
        }
        html { background: #ffffff !important; }
        body {
          background: #ffffff !important;
          color: #1a2a3a !important;
          color-scheme: light !important;
        }
      `}</style>
      {children}
    </>
  )
}
