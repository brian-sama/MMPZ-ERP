import { useState, useMemo } from 'react';

const usePagination = (data, itemsPerPage = 10) => {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);

    const currentData = useMemo(() => {
        if (!data) return [];
        const start = (currentPage - 1) * itemsPerPage;
        return data.slice(start, start + itemsPerPage);
    }, [data, currentPage, itemsPerPage]);

    const goToPage = (page) => {
        const pageNumber = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(pageNumber);
    };

    const nextPage = () => goToPage(currentPage + 1);
    const prevPage = () => goToPage(currentPage - 1);

    // Reset to page 1 if data changes significantly (optional, but good practice)
    // useEffect(() => setCurrentPage(1), [data.length]); 

    return {
        currentData,
        currentPage,
        totalPages,
        goToPage,
        nextPage,
        prevPage,
        setCurrentPage
    };
};

export default usePagination;
