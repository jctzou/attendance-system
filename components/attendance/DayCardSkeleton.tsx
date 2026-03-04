import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export function DayCardSkeleton() {
    return (
        <Card padding="p-3" className="border border-slate-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <div className="space-y-2 mt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        </Card>
    )
}
