import React from 'react'

export const Button = ({ children }: { children: React.ReactNode }) => {
  return (
    <button style={{ padding: '8px 16px', borderRadius: 6, background: '#007bff', color: '#fff' }}>
      {children}
    </button>
  )
}
