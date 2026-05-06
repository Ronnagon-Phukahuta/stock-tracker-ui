'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (res.ok) {
      window.location.href = '/'
    } else {
      setError('Invalid password')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
    }}>
      <div style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 12,
        padding: '40px 36px',
        width: 340,
        boxShadow: '0 0 0 1px #30363d, 0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: '#8b949e',
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '3px 10px',
            marginBottom: 16,
          }}>
            ST
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: '#e6edf3',
            letterSpacing: '-0.01em',
          }}>
            Stock Tracker
          </h1>
          <p style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: '#8b949e',
          }}>
            Enter your password to continue
          </p>
        </div>

        {/* Input */}
        <label style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()}
          placeholder="••••••••"
          autoFocus
          style={{
            padding: '9px 14px',
            borderRadius: 6,
            border: '1px solid #30363d',
            background: '#0d1117',
            color: '#e6edf3',
            fontSize: 14,
            outline: 'none',
            marginBottom: 8,
            transition: 'border-color 0.15s',
            fontFamily: 'inherit',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#58a6ff' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#30363d' }}
        />

        {/* Error */}
        <div style={{ minHeight: 20, marginBottom: 16 }}>
          {error && (
            <p style={{
              margin: 0,
              fontSize: 12,
              color: '#f85149',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>⚠</span> {error}
            </p>
          )}
        </div>

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={loading || !password}
          style={{
            padding: '9px 0',
            borderRadius: 6,
            background: loading || !password ? '#238636aa' : '#238636',
            color: 'white',
            border: '1px solid #2ea043',
            cursor: loading || !password ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
            transition: 'background 0.15s, opacity 0.15s',
          }}
          onMouseEnter={e => { if (!loading && password) e.currentTarget.style.background = '#2ea043' }}
          onMouseLeave={e => { if (!loading && password) e.currentTarget.style.background = '#238636' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
