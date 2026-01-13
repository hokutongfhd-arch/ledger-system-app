export const getWeekRange = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay(); // 0 (Sun) to 6 (Sat)

    // Set to Sunday of this week
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

export const generateWeekRanges = (fromDate: Date, toDate: Date = new Date()) => {
    const ranges: { start: Date; end: Date; label: string }[] = [];

    // Normalize to start of week
    const { start: firstWeekStart } = getWeekRange(fromDate);
    const { start: lastWeekStart } = getWeekRange(toDate);

    let currentStart = new Date(firstWeekStart);

    while (currentStart <= lastWeekStart) {
        const currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + 6);
        currentEnd.setHours(23, 59, 59, 999);

        const label = `${formatDate(currentStart)}～${formatDate(currentEnd)}`;

        // Prepend to array to have latest weeks first
        ranges.unshift({
            start: new Date(currentStart),
            end: new Date(currentEnd),
            label
        });

        // Move to next week
        currentStart.setDate(currentStart.getDate() + 7);
    }

    return ranges;
};

const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
};
export const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 0;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return Math.max(0, age);
};

export const calculateServicePeriod = (joinDate: string): { years: number; months: number } => {
    if (!joinDate) return { years: 0, months: 0 };
    const join = new Date(joinDate);
    if (isNaN(join.getTime())) return { years: 0, months: 0 };

    const today = new Date();

    let years = today.getFullYear() - join.getFullYear();
    let months = today.getMonth() - join.getMonth();

    if (today.getDate() < join.getDate()) {
        months--;
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    return {
        years: Math.max(0, years),
        months: Math.max(0, months)
    };
};
