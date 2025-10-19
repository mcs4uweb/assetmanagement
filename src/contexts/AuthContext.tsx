// src/contexts/AuthContext.tsx
'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth'
import { auth, db } from '../lib/firebase'
import { ref, set, get, update } from 'firebase/database'
import { User } from '../models/User'

interface AuthContextType {
  currentUser: User | null
  login: (email: string, password: string) => Promise<any>
  signup: (email: string, password: string) => Promise<any>
  logout: () => Promise<void>
  googleSignIn: () => Promise<any>
  updateProfileDetails: (updates: Partial<User>) => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const signup = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    const user: User = {
      UserId: result.user.uid,
      Email: result.user.email!,
      DisplayName: result.user.displayName || '',
      PhotoURL: result.user.photoURL || ''
    }
    
    await set(ref(db, 'users/' + result.user.uid), user)
    return result
  }

  const login = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

  const googleSignIn = async () => {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    
    const user: User = {
      UserId: result.user.uid,
      Email: result.user.email!,
      DisplayName: result.user.displayName || '',
      PhotoURL: result.user.photoURL || ''
    }
    
    const userRef = ref(db, 'users/' + result.user.uid)
    const snapshot = await get(userRef)
    if (!snapshot.exists()) {
      await set(userRef, user)
    }
    
    return result
  }

  const logout = () => {
    return signOut(auth)
  }

  const updateProfileDetails = async (updates: Partial<User>) => {
    if (!auth.currentUser) {
      throw new Error('No authenticated user found')
    }

    const allowedKeys: (keyof User)[] = [
      'DisplayName',
      'PhotoURL',
      'Phone',
      'Address',
      'City',
      'State',
      'Zip',
    ]

    const payload: Partial<User> = {}
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        const value = updates[key]
        if (value !== undefined) {
          payload[key] = value
        }
      }
    }

    if (Object.keys(payload).length === 0) {
      return
    }

    const userRef = ref(db, `users/${auth.currentUser.uid}`)
    await update(userRef, payload)

    const profileUpdates: { displayName?: string | null; photoURL?: string | null } = {}
    if (payload.DisplayName !== undefined) {
      profileUpdates.displayName = payload.DisplayName || null
    }
    if (payload.PhotoURL !== undefined) {
      profileUpdates.photoURL = payload.PhotoURL || null
    }
    if (Object.keys(profileUpdates).length > 0) {
      await updateProfile(auth.currentUser, profileUpdates)
    }

    setCurrentUser((prev) => (prev ? { ...prev, ...payload } : prev))
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = ref(db, 'users/' + user.uid)
        const snapshot = await get(userRef)
        if (snapshot.exists()) {
          setCurrentUser(snapshot.val())
        }
      } else {
        setCurrentUser(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    currentUser,
    login,
    signup,
    logout,
    googleSignIn,
    updateProfileDetails,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
