import { useAuth } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@nlace/ui-kit'

interface Props {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-nl-bg flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
