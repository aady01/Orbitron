import { useEffect, useState } from "react";
import { PAGINATION } from "@/config/constants";

interface UseEntitySearchProps<T extends {
    search: string;
    page: number
}> {
    params: T;
    setParams: (params: Partial<T>) => void;
    debounceMs?: number;
}

export function useEntitySearch<T extends {
    search: string;
    page: number
}>({ params, setParams, debounceMs = 500 }: UseEntitySearchProps<T>) {
    const [localSearch, setLocalSearch] = useState(params.search)

    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== params.search) {
                setParams({
                    search: localSearch,
                    page: PAGINATION.DEFAULT_PAGE,
                })
            }
        }, debounceMs);
        return () => clearTimeout(timer)
    }, [localSearch, params.search, setParams, debounceMs])

    useEffect(() => { setLocalSearch(params.search) }, [params.search])
    return {
        searchValue: localSearch,
        onSearchChange: setLocalSearch,
    }
}