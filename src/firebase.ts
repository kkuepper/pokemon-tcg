import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const app = initializeApp({
  apiKey:            'AIzaSyC2gn1GIiPIFDnRK0xWs1ofNiiKcvmoFPM',
  authDomain:        'pokemon-tcg-pocket-97573.firebaseapp.com',
  projectId:         'pokemon-tcg-pocket-97573',
  storageBucket:     'pokemon-tcg-pocket-97573.firebasestorage.app',
  messagingSenderId: '213028761359',
  appId:             '1:213028761359:web:12cf1733c700756313587a',
})

export const auth           = getAuth(app)
export const db             = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
