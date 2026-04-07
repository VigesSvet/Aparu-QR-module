import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  auth as authApi,
  setToken,
  getToken,
  type UserOut,
  type AuthResponse,
} from '@/lib/services/api'

interface AuthContextValue {
  user: UserOut | null
  token: string | null
  isLoading: boolean
  login: (phone: string, code: string) => Promise<AuthResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [token, setTokenState] = useState<string | null>(getToken())
  const [isLoading, setIsLoading] = useState(!!getToken())

  // On mount, try to load user from existing token
  useEffect(() => {
    const existing = getToken()
    if (!existing) return

    authApi
      .me()
      .then((u) => {
        setUser(u)
        setTokenState(existing)
      })
      .catch(() => {
        // Bad/expired token
        setToken(null)
        setTokenState(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (phone: string, code: string) => {
    const res = await authApi.verifyCode(phone, code)
    setToken(res.token)
    setTokenState(res.token)
    setUser(res.user)
    return res
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
