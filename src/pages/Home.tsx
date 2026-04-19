import { useProfile } from '../context/ProfileContext'

export default function Home() {
  const { profile } = useProfile()

  return (
    <div className="p-8">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: 'var(--gray-900)' }}
      >
        Bienvenido, {profile?.name?.split(' ')[0]}
      </h1>
      <p className="text-sm" style={{ color: 'var(--gray-500)' }}>
        Panel de inicio — Segudatos Flow
      </p>
    </div>
  )
}