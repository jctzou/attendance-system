'use client';

import NextTopLoader from 'nextjs-toploader';

export default function ProgressBarProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <NextTopLoader
                color="#FF5F05"
                initialPosition={0.08}
                crawlSpeed={200}
                height={4}
                crawl={true}
                showSpinner={false}
                easing="ease"
                speed={200}
                shadow="0 0 10px #FF5F05,0 0 5px #FF5F05"
            />
            {children}
        </>
    );
}
