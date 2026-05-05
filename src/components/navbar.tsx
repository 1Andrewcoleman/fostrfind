'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PawPrint, Menu, LogOut, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/helpers'

interface NavbarProps {
  userRole?: 'shelter' | 'foster' | null
  userName?: string
  avatarUrl?: string
}

const shelterNavLinks = [
  { href: '/shelter/dashboard', label: 'Dashboard' },
  { href: '/shelter/dogs', label: 'Dogs' },
  { href: '/shelter/applications', label: 'Applications' },
  { href: '/shelter/messages', label: 'Messages' },
]

const fosterNavLinks = [
  { href: '/foster/browse', label: 'Browse Dogs' },
  { href: '/foster/applications', label: 'My Applications' },
  { href: '/foster/messages', label: 'Messages' },
  { href: '/foster/profile', label: 'My Profile' },
]

export function Navbar({ userRole, userName = 'User', avatarUrl }: NavbarProps) {
  const router = useRouter()
  const navLinks = userRole === 'shelter' ? shelterNavLinks : userRole === 'foster' ? fosterNavLinks : []

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <PawPrint className="h-6 w-6 text-primary" />
          <span>Fostr Find</span>
        </Link>

        {/* Desktop Nav */}
        {navLinks.length > 0 && (
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {userRole ? (
            <>
              {/* Mobile nav */}
              <Sheet>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <nav className="flex flex-col gap-4 mt-8">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>

              {/* Avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="cursor-pointer h-8 w-8">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback>{getInitials(userName)}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={userRole === 'shelter' ? '/shelter/settings' : '/foster/profile'}>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  {userRole === 'shelter' && (
                    <DropdownMenuItem asChild>
                      <Link href="/shelter/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
