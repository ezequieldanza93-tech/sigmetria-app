'use client'
import { useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { BarChart2, Activity, Shield, Scale, Target } from 'lucide-react'

const SectionAccidentes = dynamic(() => import('@/components/analytics/section-accidentes').then(m => ({ default: m.SectionAccidentes })), { ssr: false })
const SectionFormacion = dynamic(() => import('@/components/analytics/section-formacion').then(m => ({ default: m.SectionFormacion })), { ssr: false })
const SectionSiteControl = dynamic(() => import('@/components/analytics/section-site-control').then(m => ({ default: m.SectionSiteControl })), { ssr: false })
const SectionEstrategia = dynamic(() => import('@/components/analytics/section-estrategia').then(m => ({ default: m.SectionEstrategia })), { ssr: false })
const SectionScorecard = dynamic(() => import('@/components/analytics/section-scorecard').then(m => ({ default: m.SectionScorecard })), { ssr: false })

type TabId = 'accidentes' | 'formacion' | 'sitecontrol' | 'estrategia' | 'scorecard'

const TABS: { id: TabId; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'accidentes',  label: 'Accidentes',       icon: <Shield size={14} />,    color: '#EF4444' },
  { id: 'formacion',   label: 'Formación y CM',   icon: <Activity size={14} />,  color: '#3B82F6' },
  { id: 'sitecontrol', label: 'Site Control',      icon: <BarChart2 size={14} />, color: '#F59E0B' },
  { id: 'estrategia',  label: 'Estrategia Legal',  icon: <Scale size={14} />,     color: '#8B5CF6' },
  { id: 'scorecard',   label: 'Scorecard',         icon: <Target size={14} />,    color: '#4CAF50' },
]

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('accidentes')
  const active = TABS.find(t => t.id === activeTab)!

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Hero header */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a0f0a 0%, #0d1f0d 50%, #0a0f0a 100%)' }}
      >
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #4CAF50 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-0 left-1/4 w-96 h-32 opacity-20 blur-3xl rounded-full" style={{ background: '#4CAF50' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4CAF50] font-heading">Sigmetría HSE</span>
              <span className="w-8 h-px bg-[#4CAF50] opacity-60" />
            </div>
            <h1 className="text-3xl font-bold font-heading text-white tracking-tight">Analytics</h1>
            <p className="text-sm text-white/50 mt-1 font-body">Prototipos de dashboard · Datos simulados</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-semibold font-heading">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Sin conexión a backend
          </div>
        </div>

        {/* Tab bar inside hero */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-semibold font-heading whitespace-nowrap transition-all duration-150 relative border-b-2',
                  activeTab === tab.id
                    ? 'text-white border-[color:var(--active-color)]'
                    : 'text-white/40 border-transparent hover:text-white/70',
                )}
                style={{ '--active-color': tab.color } as React.CSSProperties}
              >
                <span style={{ color: activeTab === tab.id ? tab.color : 'inherit' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {activeTab === 'accidentes'  && <Suspense fallback={<div className="text-center text-text-tertiary py-12 text-sm">Cargando sección...</div>}><SectionAccidentes /></Suspense>}
        {activeTab === 'formacion'   && <Suspense fallback={<div className="text-center text-text-tertiary py-12 text-sm">Cargando sección...</div>}><SectionFormacion /></Suspense>}
        {activeTab === 'sitecontrol' && <Suspense fallback={<div className="text-center text-text-tertiary py-12 text-sm">Cargando sección...</div>}><SectionSiteControl /></Suspense>}
        {activeTab === 'estrategia'  && <Suspense fallback={<div className="text-center text-text-tertiary py-12 text-sm">Cargando sección...</div>}><SectionEstrategia /></Suspense>}
        {activeTab === 'scorecard'   && <Suspense fallback={<div className="text-center text-text-tertiary py-12 text-sm">Cargando sección...</div>}><SectionScorecard /></Suspense>}
      </div>
    </div>
  )
}
