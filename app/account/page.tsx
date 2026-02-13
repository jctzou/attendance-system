import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AccountSettingsPage from './client-page'

export default async function Page() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch full profile
    const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .eq('id', user.id)
        .single()

    console.log('[AccountPage] User:', user.id)
    console.log('[AccountPage] Profile:', userProfile)

    return <AccountSettingsPage userProfile={userProfile} />
}
