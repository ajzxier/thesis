"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to scheduler.html immediately when the component mounts
    window.location.href = '/scheduler.html'
  }, [])
  
  // This content will briefly flash before the redirect
  return null
}
