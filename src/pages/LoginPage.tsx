import { SignIn } from '@clerk/clerk-react'
import { NlaceLogo } from '@nlace/ui-kit'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-nl-bg flex flex-col items-center justify-center px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <NlaceLogo variant="dark" height={36} />
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold text-nl-text">
            Dashboard Financiero
          </h1>
          <p className="mt-1 text-sm font-body text-nl-400">
            Accede con tu cuenta NLACE
          </p>
        </div>
      </div>

      <SignIn
        routing="path"
        path="/login"
        afterSignInUrl="/"
      />
    </div>
  )
}
