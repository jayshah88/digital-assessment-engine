import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, BarChart3, Users, ClipboardList, TrendingUp, TrendingDown, Check, Info } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../store/assessmentStore';

const adm = window.dapAdmin || {};

/**
 * Dashboard Page - Overview of assessment metrics and analytics.
 *
 * @returns {JSX.Element} Dashboard component.
 */
export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics'),
  });

  const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

  // Animation variants.
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <div className="adap-loading" />
      </div>
    );
  }

  // Extract data from API response wrapper { success: true, data: { ... } }
  const stats_data = stats?.data || stats || {};
  // Use flat structure from API.
  const total_submissions = stats_data.total_submissions || 0;
  const completed = stats_data.completed || 0;
  const total_leads = stats_data.total_leads || 0;
  const avg_score = stats_data.avg_score || 0;
  const completion_rate = stats_data.completion_rate || 0;
  const recent = stats_data.recent_submissions || [];
  const daily = stats_data.submissions_by_day || [];
  const breakdown = stats_data.score_distribution || [];

  // Get max daily submissions from API for scaling, fallback to local max
  const globalMax = stats_data.max_daily_submissions || 0;
  const localMax = Math.max(...daily.map(d => d.count || 0), 0);
  const maxVal = Math.max(globalMax, localMax);
  
  // Dynamic tickCount: if low volume (0-5), force integer labels. Else let Recharts auto-scale.
  const yTickCount = maxVal <= 5 ? maxVal + 1 : undefined;

  return (
    <motion.div className="adap-fade-in" variants={container} initial="hidden" animate="show">
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 950,
          color: 'var(--adap-slate-900)',
          letterSpacing: '-0.04em',
          fontFamily: "'Lexend', sans-serif"
        }}>
          Admin Dashboard
        </h2>
        <p style={{
          fontSize: '0.95rem',
          color: 'var(--adap-slate-500)',
          marginTop: '6px',
          fontWeight: 500
        }}>
          View assessment submissions, completion rates, and performance metrics.
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        {[
          {
            label: 'Total Submissions',
            sublabel: 'Completed sessions',
            value: total_submissions,
            delta: stats_data.submissions_delta || '0%',
            icon: <ClipboardList size={22} />,
            color: 'var(--adap-primary)',
            up: stats_data.submissions_up !== false
          },
          {
            label: 'Completed',
            sublabel: 'Finished audits',
            value: completed,
            delta: stats_data.completed_delta || '0%',
            icon: <Check size={22} />,
            color: '#10B981',
            up: stats_data.completed_up !== false
          },
          {
            label: 'Completion Rate',
            sublabel: 'Conversion efficiency',
            value: `${completion_rate}%`,
            delta: stats_data.completion_rate_delta || '0%',
            icon: <TrendingUp size={22} />,
            color: '#8B5CF6',
            up: stats_data.completion_rate_up !== false
          },
          {
            label: 'Avg Score',
            sublabel: `${stats_data.avg_score_percentage || (stats_data.total_max_score ? Math.round((avg_score / stats_data.total_max_score) * 100) : 0)}% maturity index`,
            value: `${avg_score} / ${stats_data.total_max_score || 57} pts`,
            delta: stats_data.avg_score_delta || '0%',
            icon: <BarChart3 size={22} />,
            color: '#F59E0B',
            up: stats_data.avg_score_up !== false
          },
          {
            label: 'Total Leads',
            sublabel: 'Unique client contacts',
            tooltip: 'Unique contact profiles captured. Multiple test submissions by the same user are linked to a single lead.',
            value: total_leads,
            delta: stats_data.leads_delta || '0%',
            icon: <Users size={22} />,
            color: '#EC4899',
            up: stats_data.leads_up !== false
          }
        ].map((stat, i) => (
          <motion.div
            key={i}
            variants={item}
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '20px 24px',
              boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
              border: '1px solid var(--adap-border)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '18px'
            }}>
              <div style={{
                padding: '12px',
                background: `${stat.color}15`,
                borderRadius: '12px',
                color: stat.color
              }}>
                {stat.icon}
              </div>
              {stat.delta && (
                <div className="dap-glass" style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  color: stat.up ? '#10B981' : '#EF4444',
                  padding: '4px 10px',
                  borderRadius: '100px'
                }}>
                  {stat.up ? '↑' : '↓'} {stat.delta}
                </div>
              )}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'var(--adap-slate-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '6px'
            }}>
              <span>{stat.label}</span>
              {stat.tooltip && (
                <span title={stat.tooltip} style={{ cursor: 'help', display: 'inline-flex', color: 'var(--adap-slate-400)' }}>
                  <Info size={13} />
                </span>
              )}
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 950,
              color: 'var(--adap-slate-900)',
              lineHeight: 1.2
            }}>
              {stat.value}
            </div>
            {stat.sublabel && (
              <div style={{ fontSize: '0.75rem', color: 'var(--adap-slate-500)', marginTop: '4px', fontWeight: 500 }}>
                {stat.sublabel}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="adap-dashboard-charts-grid" style={{ marginBottom: '40px' }}>
        {/* Activity Chart */}
        <motion.div
          variants={item}
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)'
          }}
        >
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--adap-slate-900)',
            marginBottom: '20px'
          }}>
            Daily Submissions
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={daily} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--adap-primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--adap-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 500, fill: '#64748B' }}
                dy={10}
                tickFormatter={(d) => {
                  if (!d) return '';
                  const date = new Date(d);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
                padding={{ left: 10, right: 10 }}
                minTickGap={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 500, fill: '#64748B' }}
                dx={-5}
                allowDecimals={false}
                domain={[0, 'auto']}
                tickCount={yTickCount}
              />
              <Tooltip
                contentStyle={{
                  background: '#0F172A',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#FFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)'
                }}
                itemStyle={{ color: '#818CF8' }}
                cursor={{ stroke: 'var(--adap-primary)', strokeWidth: 2 }}
                formatter={(value) => [value, 'Submissions']}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--adap-primary)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorSubmissions)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Level Distribution (Pie Chart) */}
        <motion.div
          variants={item}
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)'
          }}
        >
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--adap-slate-900)',
            marginBottom: '16px'
          }}>
            Level Distribution
          </h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats_data.level_breakdown?.length ? stats_data.level_breakdown : [{ score_level: 'No Data', count: 1 }]}
                  dataKey="count"
                  nameKey="score_level"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={6}
                  stroke="none"
                >
                  {(stats_data.level_breakdown?.length ? stats_data.level_breakdown : [{ score_level: 'No Data', count: 1 }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.score_level === 'No Data' ? '#E2E8F0' : (entry.color || COLORS[index % COLORS.length])} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div style={{ background: '#0F172A', padding: '10px 16px', borderRadius: '12px', color: '#FFF', fontSize: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: data.color || '#6366F1' }} />
                          <span style={{ fontWeight: 800 }}>{data.label || data.score_level}</span>
                        </div>
                        <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                          {data.count} Submissions ({data.percentage || 0}%)
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
            {(stats_data.level_breakdown || []).map((lvl) => (
              <div key={lvl.score_level} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--adap-slate-600)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: lvl.color || '#6366F1' }} />
                <span>{lvl.label || lvl.score_level}: <strong>{lvl.count}</strong> ({lvl.percentage || 0}%)</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Score Distribution (Bar Chart) */}
      <motion.div
        variants={item}
        style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)',
          marginBottom: '40px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 800,
              color: 'var(--adap-slate-900)',
              margin: 0
            }}>
              Score Distribution (Raw Points out of 57)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--adap-slate-500)', margin: '4px 0 0 0' }}>
              Submissions bucketed by regulatory point ranges and colored by Performance Band
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={breakdown}>
            <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="range_label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748B' }} dx={-10} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 8 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                return (
                  <div style={{ background: '#0F172A', padding: '10px 16px', borderRadius: '12px', color: '#FFF', fontSize: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: data.color || '#6366F1' }} />
                      <span style={{ fontWeight: 800 }}>Point Range: {data.range_label || `${data.bucket} pts`}</span>
                    </div>
                    {data.band_label && (
                      <div style={{ color: data.color || '#F59E0B', fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>
                        Band: {data.band_label}
                      </div>
                    )}
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                      Submissions: <strong style={{ color: '#FFF' }}>{data.count}</strong>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[8, 8, 2, 2]}>
              {(breakdown || []).map((entry, idx) => (
                <Cell key={`bar-${idx}`} fill={entry.color || '#6366F1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </motion.div>
  );
}
