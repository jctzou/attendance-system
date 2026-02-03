import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    console.log('MIDDLEWARE CHECK:', {
        path: request.nextUrl.pathname,
        hasUser: !!user,
        userId: user?.id
    })

    // 如果沒有登入且不在 login 頁面，導向 login
    if (!user && !request.nextUrl.pathname.startsWith('/login')) {
        console.log('MIDDLEWARE: Redirecting to login')
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // 如果已登入且在 login 頁面，導向首頁
    if (user && request.nextUrl.pathname.startsWith('/login')) {
        console.log('MIDDLEWARE: Redirecting to home')
        return NextResponse.redirect(new URL('/', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - auth/signout (allow signout route)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|auth/signout|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
