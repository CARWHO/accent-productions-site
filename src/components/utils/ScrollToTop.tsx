'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollToTop() {
    const pathname = usePathname();

    useEffect(() => {
        // Force the scroll to the top immediately without smooth behavior
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant' as ScrollBehavior, // Use 'instant' to bypass global smooth scroll
        });
    }, [pathname]);

    return null;
}
