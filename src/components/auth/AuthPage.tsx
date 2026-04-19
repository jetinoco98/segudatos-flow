import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenciales incorrectas. Verifique su correo y contraseña.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--gray-50)' }}>

      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-12"
        style={{ backgroundColor: 'var(--blue-accent)' }}
      >
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div
              className="w-8 h-8 rounded"
              style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
            />
            <span
              className="text-white font-semibold tracking-wide text-sm uppercase"
              style={{ letterSpacing: '0.12em' }}
            >
              Segudatos
            </span>
          </div>
          <h1 className="text-white text-4xl font-light leading-tight mb-4">
            Segudatos<br />
            <span className="font-semibold">Flow</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', lineHeight: '1.7' }}>
            Plataforma interna de gestión operativa para contratos, tickets, planificación y registros de trabajo.
          </p>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '2rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
            © {new Date().getFullYear()} Segudatos. Uso interno únicamente.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <h1
              className="text-2xl font-semibold"
              style={{ color: 'var(--blue-accent)' }}
            >
              Segudatos Flow
            </h1>
          </div>

          <h2
            className="text-2xl font-semibold mb-1"
            style={{ color: 'var(--gray-900)' }}
          >
            Iniciar sesión
          </h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--gray-600)' }}>
            Acceso restringido a personal autorizado.
          </p>

          {/* Error */}
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C'
              }}
            >
              {error}
            </div>
          )}

          {/* Email mode */}
          <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--gray-600)', letterSpacing: '0.08em' }}
              >
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@correo.com"
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--gray-300)',
                  color: 'var(--gray-900)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--gray-300)'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--gray-600)', letterSpacing: '0.08em' }}
              >
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--gray-300)',
                  color: 'var(--gray-900)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--gray-300)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all mt-1"
              style={{
                backgroundColor: loading ? 'var(--gray-400)' : 'var(--blue-accent)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none'
              }}
            >
              {loading ? 'Verificando...' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Separator */}
          <div className="flex items-center gap-4 my-6">
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--gray-200)' }}></div>
            <span
              className="text-xs font-medium uppercase"
              style={{ color: 'var(--gray-500)', letterSpacing: '0.08em' }}
            >
              o continuar con
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--gray-200)' }}></div>
          </div>

          {/* Google mode */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            type="button"
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: 'white',
              border: '1px solid var(--gray-300)',
              color: 'var(--gray-800)',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31z"/>
            </svg>
            {loading ? 'Redirigiendo...' : 'Google'}
          </button>

          <p className="mt-8 text-xs text-center" style={{ color: 'var(--gray-400)' }}>
            ¿Problemas para acceder? Contacte al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  )
}