/**
 * RadarChart — multi-axis strategic capability radar
 */
import React from 'react';
import {
  RadarChart as RechartsRadar,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { subject, score } = payload[0].payload;
  return (
    <div className="dap-radar__tooltip" style={{
      background: '#0F172A', color: '#fff', padding: '12px 16px',
      borderRadius: '12px', fontSize: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)'
    }}>
      <div style={{ fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>{subject}</div>
      <div style={{ opacity: 0.8, fontSize: '13px' }}>Capability Maturity: {Math.round(score)}%</div>
    </div>
  );
};

function splitSubject(text, isMobile, isSmallMobile) {
  if (!text) return [''];
  if (!isMobile) return [text];

  const lower = text.toLowerCase().trim();
  if (lower.includes('engineering knowledge continuity')) {
    return isSmallMobile ? ['Eng. Know.', 'Continuity'] : ['Eng. Knowledge', 'Continuity'];
  }
  if (lower.includes('supply chain readiness')) {
    return isSmallMobile ? ['Supply Ch.', 'Readiness'] : ['Supply Chain', 'Readiness'];
  }
  if (lower.includes('design for testability')) {
    return isSmallMobile ? ['Design for', 'Testability'] : ['Design for', 'Testability'];
  }
  if (lower.includes('requirements clarity')) {
    return isSmallMobile ? ['Require.', 'Clarity'] : ['Requirements', 'Clarity'];
  }
  if (lower.includes('compliance integration')) {
    return isSmallMobile ? ['Complianc.', 'Integration'] : ['Compliance', 'Integration'];
  }
  if (lower.includes('interface definition')) {
    return isSmallMobile ? ['Interface', 'Definition'] : ['Interface', 'Definition'];
  }
  if (lower.includes('concurrent engineering')) {
    return isSmallMobile ? ['Concurrent', 'Eng.'] : ['Concurrent', 'Engineering'];
  }
  if (lower.includes('leadership confidence')) {
    return isSmallMobile ? ['Leadership', 'Confid.'] : ['Leadership', 'Confidence'];
  }
  if (lower.includes('risk governance')) {
    return ['Risk', 'Governance'];
  }
  if (lower.includes('platform reuse')) {
    return ['Platform', 'Reuse'];
  }
  if (lower.includes('capacity planning')) {
    return ['Capacity', 'Planning'];
  }
  if (lower.includes('domain depth')) {
    return ['Domain', 'Depth'];
  }

  // Generic fallback for custom dimensions
  if (text.length <= 10) return [text];
  const words = text.split(/\s+/);
  if (words.length === 2) return [words[0], words[1]];
  if (words.length >= 3) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  return text.length > 11 ? [text.slice(0, 10) + '…'] : [text];
}

const CustomAngleTick = ({ payload, x, y, cx, cy, textAnchor, isMobile, isSmallMobile }) => {
  const value = payload?.value || '';
  const lines = splitSubject(value, isMobile, isSmallMobile);
  const fontSize = isSmallMobile ? 7.5 : (isMobile ? 9 : 11);
  const lineHeight = fontSize + 2;

  let anchor = textAnchor;
  if (Math.abs(x - cx) < 10) {
    anchor = 'middle';
  }

  const startY = lines.length > 1 ? y - ((lines.length - 1) * lineHeight) / 2 : y;

  return (
    <text
      x={x}
      y={startY}
      textAnchor={anchor}
      fill="#334155"
      fontSize={fontSize}
      fontWeight={700}
      letterSpacing="0.01em"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

export default function RadarChart({ data = [], height = 340, isPdf = false, color = '#2c8c7f' }) {
  const [winWidth, setWinWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  React.useEffect(() => {
    const checkWidth = () => setWinWidth(window.innerWidth);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  if (!data?.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px' }}>
      Calibrating strategic data...
    </div>
  );

  const isSmallMobile = winWidth <= 420;
  const isMobile = winWidth < 640;

  const chartHeight = isPdf ? height : (isSmallMobile ? 380 : (isMobile ? 380 : height));
  const outerRadius = isPdf ? '70%' : (isSmallMobile ? '28%' : (isMobile ? '38%' : '65%'));

  const chartContent = (
    <RechartsRadar
      cx="50%"
      cy="50%"
      outerRadius={outerRadius}
      width={isPdf ? 1040 : undefined}
      height={chartHeight}
      data={data}
    >
      <PolarGrid
        gridType="polygon"
        stroke="#E2E8F0"
        strokeDasharray="4 4"
      />
      <PolarAngleAxis
        dataKey="subject"
        tick={<CustomAngleTick isMobile={isMobile} isSmallMobile={isSmallMobile} />}
      />
      <PolarRadiusAxis
        domain={[0, 100]}
        tickCount={6}
        tick={false}
        axisLine={false}
      />
      <Radar
        name="Maturity"
        dataKey="score"
        stroke={color}
        fill={color}
        fillOpacity={0.25}
        strokeWidth={3}
        dot={{ r: isMobile ? 3.5 : 5, fill: color, strokeWidth: 2, stroke: '#f8a644' }}
        isAnimationActive={!isPdf}
        animationBegin={400}
        animationDuration={1500}
      />
      {!isPdf && <Tooltip content={<CustomTooltip />} />}
    </RechartsRadar>
  );

  return (
    <div className="dap-radar-wrap" style={{ width: '100%', height: chartHeight, minHeight: chartHeight, position: 'relative', overflow: 'visible' }}>
      {isPdf ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {chartContent}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {chartContent}
        </ResponsiveContainer>
      )}
    </div>
  );
}


/**
 * ScoreRing — animated Executive circular progress
 */
export function ScoreRing({ score = 0, color = '#4F46E5', size = 200, animated = false }) {
  const safeScore = isNaN(score) ? 0 : score;
  const radius = (size / 2) - 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const gradId = `scoreGradient_${String(color).replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="dap-ring" style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#0f334a" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#F1F5F9" strokeWidth={15} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={15}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
          style={animated ? { transition: 'stroke-dashoffset 1.8s cubic-bezier(0.4, 0, 0.2, 1) 0.5s' } : {}}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '64px', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{Math.round(safeScore)}</span>
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>Maturity</span>
      </div>
    </div>
  );
}
