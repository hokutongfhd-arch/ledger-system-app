export const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, index, name } = props;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;

    // Calculate start and end points for the line
    const sin = Math.sin(-midAngle * RADIAN);
    const cos = Math.cos(-midAngle * RADIAN);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    // Stagger line length based on index to separate adjacent labels
    const stagger = (index % 2) * 14;

    const ey = my;

    // Default collision handling
    let ex = mx + (cos >= 0 ? 1 : -1) * (20 + stagger);
    let textAnchor: 'start' | 'end' | 'middle' = cos >= 0 ? 'start' : 'end';
    let labelXOffset = (cos >= 0 ? 1 : -1) * 12;

    // Manual override for 'UPDATE' to prevent overlap with 'CREATE'
    // Force 'UPDATE' to the right side if it's overlapping at the top
    if (name === 'UPDATE') {
        ex = mx + Math.abs(20 + stagger); // Force positive direction (Right)
        textAnchor = 'start';
        labelXOffset = 12;
    }



    return (
        <g>
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={props.fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={props.fill} stroke="none" />
            <text x={ex + labelXOffset} y={ey} textAnchor={textAnchor} fill="#333" dominantBaseline="central" fontSize={12} fontWeight={500}>
                {name}
            </text>
        </g>
    );
};
