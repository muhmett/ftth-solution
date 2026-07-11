// Motif décoratif : brins de fibre optique fins qui se rejoignent aux points
// d'épissure (nœuds), se croisent puis repartent — avec impulsions lumineuses.
// Purement décoratif (aria-hidden), animé en CSS (voir globals.css).

const STRANDS = [
  // Chaque brin passe par un ou deux nœuds d'épissure ci-dessous
  'M-60,180 C150,220 260,280 380,300 S650,470 860,520 S1200,600 1500,560',
  'M-60,420 C120,400 250,330 380,300 C520,270 700,200 1120,210 S1400,260 1500,250',
  'M-60,700 C300,660 600,560 860,520 C1000,500 1060,300 1120,210 C1180,120 1300,80 1500,60',
  'M-60,80 C400,60 800,140 1120,210 S1350,380 1500,420',
  'M-60,560 C200,540 300,380 380,300 C460,220 600,120 900,100 S1300,140 1500,120',
  'M-60,840 C350,820 640,640 860,520 C1020,430 1250,430 1500,340',
];

// Points d'épissure où les brins se rencontrent
const NODES = [
  [380, 300],
  [860, 520],
  [1120, 210],
];

export default function FiberBackground({ className = '', intensity = 'subtle' }) {
  return (
    <svg
      aria-hidden="true"
      className={`fiber-bg fiber-bg--${intensity} ${className}`}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {STRANDS.map((d, i) => (
        <g key={i}>
          <path d={d} className="fiber-line" pathLength="1000" />
          <path
            d={d}
            className="fiber-pulse"
            pathLength="1000"
            style={{ animationDuration: `${8 + i * 2.5}s`, animationDelay: `${i * -3.2}s` }}
          />
        </g>
      ))}
      {NODES.map(([x, y], i) => (
        <g key={`n${i}`}>
          <circle cx={x} cy={y} r="10" className="fiber-node-halo" style={{ animationDelay: `${i * 1.1}s` }} />
          <circle cx={x} cy={y} r="3.5" className="fiber-node" style={{ animationDelay: `${i * 1.1}s` }} />
        </g>
      ))}
    </svg>
  );
}
