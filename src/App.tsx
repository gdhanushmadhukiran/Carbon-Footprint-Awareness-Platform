import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie,
} from 'recharts';
import { useStore } from './store/useStore';
import {
  calculateTransportEmission, calculateFoodEmission, calculateEnergyEmission,
  calculateShoppingEmission, calculateWasteEmission, calculateBaselineFootprint,
  calculateCarbonRiskScore, getSustainabilityRating, getCategoryBreakdown,
  projectAnnualEmissions, calculateEcoBaseline, getSustainabilityProfile,
  REGIONAL_AVERAGES,
} from './lib/carbon-calc';
import { getBestEquivalent, estimateMoneySaved, estimateFuelSaved } from './lib/equivalents';
import { generateOnboardingInsights, generateCoachAdvice, generateWeeklyReport, generateChallenge, isAIAvailable } from './lib/ai-client';
import type {
  Region, DietType, TransportMode, EnergySource, LogCategory,
  ActivityLog, TransportLog, FoodLog, EnergyLog, ShoppingLog, WasteLog,
  PageName, Goal, WeeklyReport,
} from './types';

// ============================================================================
// Animation Variants
// ============================================================================
const pageV: any = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};
const staggerContainer: any = { initial: {}, animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };
const staggerItem: any = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const modalOverlay: any = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const modalContent: any = { initial: { opacity: 0, scale: 0.92, y: 30 }, animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }, exit: { opacity: 0, scale: 0.95, y: 20 } };
const onboardingStep: any = { initial: { opacity: 0, x: 80 }, animate: { opacity: 1, x: 0, transition: { duration: 0.45 } }, exit: { opacity: 0, x: -80, transition: { duration: 0.25 } } };

// ============================================================================
// Helpers
// ============================================================================
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const CATEGORY_ICONS: Record<LogCategory, string> = { transport: '🚗', food: '🍽️', energy: '⚡', shopping: '🛍️', waste: '♻️' };
const CATEGORY_COLORS: Record<LogCategory, string> = { transport: '#3b82f6', food: '#22c55e', energy: '#f59e0b', shopping: '#a855f7', waste: '#78716c' };

const NAV_ITEMS: { page: PageName; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Home', icon: '📊' },
  { page: 'log', label: 'Log', icon: '➕' },
  { page: 'coach', label: 'Coach', icon: '🤖' },
  { page: 'twin', label: 'Twin', icon: '👥' },
  { page: 'simulator', label: 'What If', icon: '🔮' },
  { page: 'goals', label: 'Goals', icon: '🎯' },
];

const REGION_LABELS: Record<Region, string> = { north_america: 'North America', europe: 'Europe', asia: 'Asia', oceania: 'Oceania', south_america: 'South America', africa: 'Africa', middle_east: 'Middle East' };
const DIET_LABELS: Record<DietType, string> = { omnivore: 'Omnivore', pescatarian: 'Pescatarian', vegetarian: 'Vegetarian', vegan: 'Vegan' };
const TRANSPORT_LABELS: Record<TransportMode, string> = { car_gasoline: 'Car (Gasoline)', car_diesel: 'Car (Diesel)', car_electric: 'Electric Car', bus: 'Bus', train: 'Train', bicycle: 'Bicycle', walking: 'Walking', motorcycle: 'Motorcycle', flight_domestic: 'Domestic Flight', flight_international: 'Int\'l Flight' };
const ENERGY_LABELS: Record<EnergySource, string> = { grid_default: 'Grid Default', renewable: 'Renewable', natural_gas: 'Natural Gas', mixed: 'Mixed' };

function CountUp({ end, duration = 1000, prefix = '', suffix = '' }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(end * eased * 10) / 10);
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [end, duration]);
  return <span>{prefix}{typeof end === 'number' && end % 1 === 0 ? Math.round(val).toLocaleString() : val.toLocaleString()}{suffix}</span>;
}

// ============================================================================
// ONBOARDING
// ============================================================================
function Onboarding() {
  const { setUserProfile, setIsOnboarding } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [region, setRegion] = useState<Region>('north_america');
  const [diet, setDiet] = useState<DietType>('omnivore');
  const [transport, setTransport] = useState<TransportMode>('car_gasoline');
  const [household, setHousehold] = useState(2);
  const [energy, setEnergy] = useState<EnergySource>('grid_default');
  const [insights, setInsights] = useState<{ summary: string; recommendations: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const totalSteps = 7;

  const handleComplete = async () => {
    setLoading(true);
    const baseline = calculateBaselineFootprint({ region, diet, primaryTransport: transport, householdSize: household, energySource: energy });
    const riskScore = calculateCarbonRiskScore(baseline);
    const profile = getSustainabilityProfile(baseline, region);

    const userProfile = {
      id: uid(), name: name || 'Friend', region, diet, primaryTransport: transport,
      householdSize: household, energySource: energy, baselineFootprint: baseline,
      carbonRiskScore: riskScore, sustainabilityProfile: profile,
      createdAt: new Date().toISOString(), onboardingComplete: true,
    };

    try {
      const result = await generateOnboardingInsights(userProfile);
      setInsights(result);
    } catch { setInsights({ summary: `Your estimated annual footprint is ${baseline.toLocaleString()} kg CO₂e.`, recommendations: ['Start logging your daily activities to get personalized insights.'] }); }

    setUserProfile(userProfile);
    setLoading(false);
    setStep(totalSteps - 1);
  };

  const next = () => { if (step === totalSteps - 2) { handleComplete(); } else { setStep(s => s + 1); } };
  const prev = () => setStep(s => Math.max(0, s - 1));

  const steps = [
    // Welcome
    <div key="welcome" className="text-center space-y-6">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }} className="text-7xl mb-4">🌍</motion.div>
      <h1 className="text-4xl font-bold gradient-text-primary">Welcome to EcoTrack AI</h1>
      <p className="text-stone-300 text-lg max-w-md mx-auto">Your personal AI-powered climate coach. Let's understand your carbon footprint in just a few steps.</p>
      <div className="flex gap-3 justify-center mt-4">
        <span className="text-xs px-3 py-1 rounded-full glass text-ocean-400">AI-Powered</span>
        <span className="text-xs px-3 py-1 rounded-full glass text-earth-400">Science-Based</span>
        <span className="text-xs px-3 py-1 rounded-full glass text-eco-green">Personalized</span>
      </div>
    </div>,
    // Name
    <div key="name" className="space-y-6">
      <div className="text-5xl text-center mb-2">👋</div>
      <h2 className="text-2xl font-bold text-center">What should we call you?</h2>
      <p className="text-stone-400 text-center">We'll use this to personalize your experience.</p>
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" className="w-full text-lg text-center" autoFocus />
    </div>,
    // Region
    <div key="region" className="space-y-4">
      <div className="text-5xl text-center mb-2">🗺️</div>
      <h2 className="text-2xl font-bold text-center">Where do you live?</h2>
      <p className="text-stone-400 text-center text-sm">This affects your energy grid emissions and regional averages.</p>
      <div className="grid grid-cols-2 gap-3">{(Object.keys(REGION_LABELS) as Region[]).map(r => (
        <motion.button key={r} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setRegion(r)}
          className={`p-3 rounded-xl text-sm font-medium transition-all ${region === r ? 'gradient-primary text-white shadow-lg shadow-ocean-500/20' : 'glass hover:border-ocean-500/40'}`}>{REGION_LABELS[r]}</motion.button>
      ))}</div>
    </div>,
    // Diet
    <div key="diet" className="space-y-4">
      <div className="text-5xl text-center mb-2">🥗</div>
      <h2 className="text-2xl font-bold text-center">What's your diet like?</h2>
      <p className="text-stone-400 text-center text-sm">Food accounts for ~25% of personal emissions on average.</p>
      <div className="grid grid-cols-2 gap-3">{(Object.keys(DIET_LABELS) as DietType[]).map(d => (
        <motion.button key={d} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setDiet(d)}
          className={`p-4 rounded-xl text-sm font-medium transition-all ${diet === d ? 'gradient-primary text-white shadow-lg shadow-ocean-500/20' : 'glass hover:border-ocean-500/40'}`}>
          <div className="text-2xl mb-1">{d === 'omnivore' ? '🥩' : d === 'pescatarian' ? '🐟' : d === 'vegetarian' ? '🥬' : '🌱'}</div>{DIET_LABELS[d]}
        </motion.button>
      ))}</div>
    </div>,
    // Transport
    <div key="transport" className="space-y-4">
      <div className="text-5xl text-center mb-2">🚗</div>
      <h2 className="text-2xl font-bold text-center">Primary transportation?</h2>
      <p className="text-stone-400 text-center text-sm">How do you usually get around day-to-day?</p>
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">{(['car_gasoline', 'car_electric', 'bus', 'train', 'bicycle', 'walking'] as TransportMode[]).map(t => (
        <motion.button key={t} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setTransport(t)}
          className={`p-3 rounded-xl text-sm font-medium transition-all ${transport === t ? 'gradient-primary text-white shadow-lg shadow-ocean-500/20' : 'glass hover:border-ocean-500/40'}`}>
          <div className="text-xl mb-1">{t.includes('car') ? '🚗' : t === 'bus' ? '🚌' : t === 'train' ? '🚆' : t === 'bicycle' ? '🚴' : '🚶'}</div>{TRANSPORT_LABELS[t]}
        </motion.button>
      ))}</div>
    </div>,
    // Household + Energy
    <div key="household" className="space-y-6">
      <div className="text-5xl text-center mb-2">🏠</div>
      <h2 className="text-2xl font-bold text-center">Your household</h2>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-stone-400 block mb-2">Household size</label>
          <div className="flex items-center gap-4 justify-center">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setHousehold(h => Math.max(1, h - 1))} className="w-10 h-10 rounded-full glass flex items-center justify-center text-lg font-bold">−</motion.button>
            <span className="text-3xl font-bold text-ocean-400 w-10 text-center">{household}</span>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setHousehold(h => h + 1)} className="w-10 h-10 rounded-full glass flex items-center justify-center text-lg font-bold">+</motion.button>
          </div>
        </div>
        <div>
          <label className="text-sm text-stone-400 block mb-2">Energy source</label>
          <div className="grid grid-cols-2 gap-2">{(Object.keys(ENERGY_LABELS) as EnergySource[]).map(e => (
            <motion.button key={e} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setEnergy(e)}
              className={`p-3 rounded-xl text-sm font-medium transition-all ${energy === e ? 'gradient-primary text-white shadow-lg shadow-ocean-500/20' : 'glass hover:border-ocean-500/40'}`}>
              {e === 'renewable' ? '☀️' : e === 'natural_gas' ? '🔥' : '🔌'} {ENERGY_LABELS[e]}
            </motion.button>
          ))}</div>
        </div>
      </div>
    </div>,
    // Results
    <div key="results" className="space-y-6">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="text-6xl text-center">🌟</motion.div>
      <h2 className="text-2xl font-bold text-center gradient-text-primary">Your Climate Profile</h2>
      {loading ? (
        <div className="space-y-4"><div className="h-4 shimmer-loading rounded w-3/4 mx-auto" /><div className="h-4 shimmer-loading rounded w-1/2 mx-auto" /><div className="h-4 shimmer-loading rounded w-2/3 mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {insights && <p className="text-stone-300 text-sm leading-relaxed glass-card p-4">{insights.summary}{!isAIAvailable() && <span className="block mt-2 text-xs text-stone-500 italic">ℹ️ Generated by local analysis (connect Gemini API for AI-powered insights)</span>}</p>}
          {insights?.recommendations.map((r, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="flex gap-3 items-start glass p-3 rounded-xl">
              <span className="text-ocean-400 mt-0.5">💡</span><span className="text-sm text-stone-200">{r}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 max-w-lg w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-stone-500 mb-2"><span>Step {step + 1} of {totalSteps}</span><span>{Math.round(((step + 1) / totalSteps) * 100)}%</span></div>
          <div className="h-1.5 bg-forest-800 rounded-full overflow-hidden">
            <motion.div className="h-full gradient-primary rounded-full" animate={{ width: `${((step + 1) / totalSteps) * 100}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div key={step} variants={onboardingStep} initial="initial" animate="animate" exit="exit" className="min-h-[320px] flex flex-col justify-center">
            {steps[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && step < totalSteps - 1 && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={prev} className="glass px-6 py-3 rounded-xl text-sm font-medium hover:border-ocean-500/40">Back</motion.button>
          )}
          {step < totalSteps - 1 && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={next} className="flex-1 gradient-primary px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg shadow-ocean-500/20">
              {step === 0 ? "Let's Start" : step === totalSteps - 2 ? 'Calculate My Footprint' : 'Next'}
            </motion.button>
          )}
          {step === totalSteps - 1 && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setIsOnboarding(false)}
              className="flex-1 gradient-primary px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg shadow-ocean-500/20" disabled={loading}>
              {loading ? 'Analyzing...' : 'Start Tracking 🚀'}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================
function Dashboard() {
  const { userProfile, logs, streak, setCurrentPage, setShowLogModal } = useStore();
  const breakdown = useMemo(() => getCategoryBreakdown(logs), [logs]);
  const totalEmissions = useMemo(() => logs.reduce((s, l) => s + l.carbonKg, 0), [logs]);
  const daysActive = useMemo(() => {
    if (logs.length === 0) return 1;
    const dates = new Set(logs.map(l => l.timestamp.split('T')[0]));
    return Math.max(dates.size, 1);
  }, [logs]);
  const annualProjection = useMemo(() => projectAnnualEmissions(logs, daysActive), [logs, daysActive]);

  const chartData = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.timestamp.split('T')[0] === dateStr);
      return { day: d.toLocaleDateString('en', { weekday: 'short' }), emissions: Math.round(dayLogs.reduce((s, l) => s + l.carbonKg, 0) * 10) / 10 };
    });
    return last7;
  }, [logs]);

  const pieData = useMemo(() =>
    (Object.entries(breakdown) as [LogCategory, number][])
      .filter(([, v]) => v > 0)
      .map(([cat, val]) => ({ name: cat, value: Math.round(val * 10) / 10, fill: CATEGORY_COLORS[cat] })),
  [breakdown]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* Hero Stats */}
      <motion.div variants={staggerItem} className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-stone-400 text-sm">Welcome back, <span className="text-ocean-400">{userProfile?.name}</span></p>
            <h1 className="text-2xl font-bold mt-1">Your Carbon Dashboard</h1>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowLogModal(true)}
            className="gradient-primary px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-ocean-500/20 flex items-center gap-2">
            <span>➕</span> Log Activity
          </motion.button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Logged', value: totalEmissions, suffix: ' kg', color: 'text-stone-100' },
            { label: 'Annual Projection', value: annualProjection, suffix: ' kg', color: annualProjection < (userProfile?.baselineFootprint ?? 99999) ? 'text-eco-green' : 'text-earth-400' },
            { label: 'Day Streak', value: streak.currentDays, suffix: ' 🔥', color: 'text-ocean-400' },
            { label: 'Activities', value: logs.length, suffix: '', color: 'text-stone-100' },
          ].map((stat, i) => (
            <motion.div key={i} variants={staggerItem} className="glass p-4 rounded-xl text-center">
              <p className="text-xs text-stone-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}><CountUp end={stat.value} />{stat.suffix}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div variants={staggerItem} className="glass-card p-6">
          <h3 className="text-sm font-semibold text-stone-300 mb-4">Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5a0" stopOpacity={0.3} /><stop offset="95%" stopColor="#0ea5a0" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a2c" />
              <XAxis dataKey="day" tick={{ fill: '#a8a29e', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#a8a29e', fontSize: 12 }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip contentStyle={{ background: '#122a20', border: '1px solid #245038', borderRadius: '12px', color: '#f5f5f4' }} />
              <Area type="monotone" dataKey="emissions" stroke="#0ea5a0" fill="url(#grad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={staggerItem} className="glass-card p-6">
          <h3 className="text-sm font-semibold text-stone-300 mb-4">Emission Breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#122a20', border: '1px solid #245038', borderRadius: '12px', color: '#f5f5f4' }} formatter={(value: any) => `${value} kg CO₂e`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-stone-500 text-sm">Log activities to see your breakdown</div>}
          <div className="flex flex-wrap gap-2 mt-3">{pieData.map(d => (
            <span key={d.name} className="text-xs flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />{d.name}: {d.value} kg</span>
          ))}</div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h3 className="text-sm font-semibold text-stone-300 mb-4">Recent Activity</h3>
        {logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-stone-400 text-sm">No activities logged yet. Start tracking to see your impact!</p>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowLogModal(true)}
              className="mt-4 gradient-primary px-5 py-2 rounded-lg text-sm font-medium text-white">Log Your First Activity</motion.button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">{logs.slice(-10).reverse().map(log => (
            <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between p-3 glass rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-xl">{CATEGORY_ICONS[log.category]}</span>
                <div>
                  <p className="text-sm font-medium capitalize">{log.category}</p>
                  <p className="text-xs text-stone-500">{new Date(log.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{log.carbonKg.toFixed(1)} <span className="text-xs text-stone-400">kg CO₂e</span></p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded rating-${log.sustainabilityRating}`}>{log.sustainabilityRating}</span>
              </div>
            </motion.div>
          ))}</div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={staggerItem} className="grid grid-cols-3 gap-3">
        {[
          { page: 'coach' as PageName, icon: '🤖', label: 'AI Coach', desc: 'Get advice' },
          { page: 'twin' as PageName, icon: '👥', label: 'Carbon Twin', desc: 'See projections' },
          { page: 'simulator' as PageName, icon: '🔮', label: 'What-If', desc: 'Simulate changes' },
        ].map(item => (
          <motion.button key={item.page} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={() => setCurrentPage(item.page)} className="glass-card p-4 text-center">
            <div className="text-3xl mb-2">{item.icon}</div>
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-xs text-stone-500">{item.desc}</p>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// LOG MODAL
// ============================================================================
function LogModal() {
  const { showLogModal, setShowLogModal, addLog, userProfile } = useStore();
  const [category, setCategory] = useState<LogCategory | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('car_gasoline');
  const [distance, setDistance] = useState(10);
  const [passengers, setPassengers] = useState(1);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [mealDiet, setMealDiet] = useState<DietType>(userProfile?.diet ?? 'omnivore');
  const [energyType, setEnergyType] = useState<'electricity' | 'natural_gas' | 'heating_oil'>('electricity');
  const [energyAmount, setEnergyAmount] = useState(5);
  const [shoppingType, setShoppingType] = useState<'clothing' | 'electronics' | 'furniture' | 'groceries' | 'other'>('groceries');
  const [shoppingQty, setShoppingQty] = useState(1);
  const [isSecondhand, setIsSecondhand] = useState(false);
  const [wasteType, setWasteType] = useState<'general' | 'recycling' | 'compost' | 'electronic'>('general');
  const [wasteWeight, setWasteWeight] = useState(0.5);
  const [feedback, setFeedback] = useState<{ carbon: number; equiv: string; rating: string } | null>(null);

  const reset = () => { setCategory(null); setFeedback(null); };

  const handleLog = () => {
    let carbon = 0;
    let details: TransportLog | FoodLog | EnergyLog | ShoppingLog | WasteLog;
    switch (category) {
      case 'transport':
        carbon = calculateTransportEmission(transportMode, distance, passengers);
        details = { mode: transportMode, distanceKm: distance, passengers } as TransportLog;
        break;
      case 'food':
        carbon = calculateFoodEmission(mealDiet, mealType);
        details = { mealType, dietType: mealDiet } as FoodLog;
        break;
      case 'energy':
        carbon = calculateEnergyEmission(energyType, energyAmount, userProfile?.energySource, userProfile?.region, userProfile?.householdSize);
        details = { type: energyType, amount: energyAmount, source: userProfile?.energySource ?? 'grid_default' } as EnergyLog;
        break;
      case 'shopping':
        carbon = calculateShoppingEmission(shoppingType, shoppingQty, isSecondhand);
        details = { itemType: shoppingType, quantity: shoppingQty, isSecondhand } as ShoppingLog;
        break;
      case 'waste':
        carbon = calculateWasteEmission(wasteType, wasteWeight);
        details = { type: wasteType, weightKg: wasteWeight } as WasteLog;
        break;
      default: return;
    }

    const equiv = getBestEquivalent(carbon);
    const rating = getSustainabilityRating(carbon, category!);

    const log: ActivityLog = {
      id: uid(), category: category!, timestamp: new Date().toISOString(),
      carbonKg: carbon, details, equivalentComparison: equiv, sustainabilityRating: rating,
    };

    addLog(log);
    setFeedback({ carbon, equiv, rating });
  };

  if (!showLogModal) return null;

  return (
    <AnimatePresence>
      <motion.div variants={modalOverlay} initial="initial" animate="animate" exit="exit" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" onClick={() => { setShowLogModal(false); reset(); }}>
        <motion.div variants={modalContent} initial="initial" animate="animate" exit="exit" onClick={e => e.stopPropagation()}
          className="glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{feedback ? 'Impact Summary' : category ? `Log ${category.charAt(0).toUpperCase() + category.slice(1)}` : 'Log Activity'}</h2>
            <button onClick={() => { setShowLogModal(false); reset(); }} className="text-stone-500 hover:text-stone-300 text-xl">✕</button>
          </div>

          {/* Feedback View */}
          {feedback ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="text-6xl">{feedback.carbon < 1 ? '🌿' : feedback.carbon < 5 ? '🌤️' : '☁️'}</motion.div>
              <div>
                <p className="text-3xl font-bold"><CountUp end={feedback.carbon} suffix=" kg CO₂e" /></p>
                <p className="text-stone-400 text-sm mt-1">{feedback.equiv}</p>
              </div>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-lg rating-${feedback.rating}`}>Rating: {feedback.rating}</span>
              <div className="flex gap-3 mt-6">
                <motion.button whileTap={{ scale: 0.95 }} onClick={reset} className="flex-1 glass px-4 py-3 rounded-xl text-sm font-medium">Log Another</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowLogModal(false); reset(); }} className="flex-1 gradient-primary px-4 py-3 rounded-xl text-sm font-semibold text-white">Done ✓</motion.button>
              </div>
            </motion.div>
          ) : !category ? (
            /* Category Selection */
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(CATEGORY_ICONS) as LogCategory[]).map(cat => (
                <motion.button key={cat} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setCategory(cat)}
                  className="glass-card p-5 text-center hover:border-ocean-500/40">
                  <div className="text-3xl mb-2">{CATEGORY_ICONS[cat]}</div>
                  <p className="text-sm font-medium capitalize">{cat}</p>
                </motion.button>
              ))}
            </div>
          ) : (
            /* Category-specific forms */
            <div className="space-y-5">
              {category === 'transport' && <>
                <div><label className="text-sm text-stone-400 block mb-2">Mode</label>
                  <div className="grid grid-cols-3 gap-2">{(['car_gasoline', 'car_electric', 'bus', 'train', 'bicycle', 'walking'] as TransportMode[]).map(m => (
                    <button key={m} onClick={() => setTransportMode(m)} className={`p-2 rounded-lg text-xs font-medium transition-all ${transportMode === m ? 'gradient-primary text-white' : 'glass'}`}>
                      {m.includes('car') ? '🚗' : m === 'bus' ? '🚌' : m === 'train' ? '🚆' : m === 'bicycle' ? '🚴' : '🚶'} {TRANSPORT_LABELS[m].split(' ')[0]}
                    </button>
                  ))}</div>
                </div>
                <div><label className="text-sm text-stone-400 block mb-2">Distance: {distance} km</label>
                  <input type="range" min="1" max="200" value={distance} onChange={e => setDistance(+e.target.value)} className="w-full" />
                </div>
                {transportMode.includes('car') && <div><label className="text-sm text-stone-400 block mb-2">Passengers: {passengers}</label>
                  <input type="range" min="1" max="5" value={passengers} onChange={e => setPassengers(+e.target.value)} className="w-full" />
                </div>}
                <p className="text-sm text-stone-500">Estimated: <span className="text-ocean-400 font-semibold">{calculateTransportEmission(transportMode, distance, passengers).toFixed(2)} kg CO₂e</span></p>
              </>}

              {category === 'food' && <>
                <div><label className="text-sm text-stone-400 block mb-2">Meal type</label>
                  <div className="grid grid-cols-4 gap-2">{(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => (
                    <button key={m} onClick={() => setMealType(m)} className={`p-2 rounded-lg text-xs font-medium capitalize ${mealType === m ? 'gradient-primary text-white' : 'glass'}`}>{m}</button>
                  ))}</div>
                </div>
                <div><label className="text-sm text-stone-400 block mb-2">Diet type for this meal</label>
                  <div className="grid grid-cols-2 gap-2">{(Object.keys(DIET_LABELS) as DietType[]).map(d => (
                    <button key={d} onClick={() => setMealDiet(d)} className={`p-2 rounded-lg text-xs font-medium ${mealDiet === d ? 'gradient-primary text-white' : 'glass'}`}>{d === 'omnivore' ? '🥩' : d === 'pescatarian' ? '🐟' : d === 'vegetarian' ? '🥬' : '🌱'} {DIET_LABELS[d]}</button>
                  ))}</div>
                </div>
                <p className="text-sm text-stone-500">Estimated: <span className="text-ocean-400 font-semibold">{calculateFoodEmission(mealDiet, mealType).toFixed(2)} kg CO₂e</span></p>
              </>}

              {category === 'energy' && <>
                <div><label className="text-sm text-stone-400 block mb-2">Type</label>
                  <div className="grid grid-cols-3 gap-2">{(['electricity', 'natural_gas', 'heating_oil'] as const).map(t => (
                    <button key={t} onClick={() => setEnergyType(t)} className={`p-2 rounded-lg text-xs font-medium capitalize ${energyType === t ? 'gradient-primary text-white' : 'glass'}`}>{t.replace('_', ' ')}</button>
                  ))}</div>
                </div>
                <div><label className="text-sm text-stone-400 block mb-2">Amount: {energyAmount} {energyType === 'electricity' ? 'kWh' : 'm³'}</label>
                  <input type="range" min="1" max="100" value={energyAmount} onChange={e => setEnergyAmount(+e.target.value)} className="w-full" />
                </div>
                <p className="text-sm text-stone-500">Estimated: <span className="text-ocean-400 font-semibold">{calculateEnergyEmission(energyType, energyAmount, userProfile?.energySource, userProfile?.region, userProfile?.householdSize).toFixed(2)} kg CO₂e</span></p>
              </>}

              {category === 'shopping' && <>
                <div><label className="text-sm text-stone-400 block mb-2">Item type</label>
                  <div className="grid grid-cols-3 gap-2">{(['clothing', 'electronics', 'furniture', 'groceries', 'other'] as const).map(t => (
                    <button key={t} onClick={() => setShoppingType(t)} className={`p-2 rounded-lg text-xs font-medium capitalize ${shoppingType === t ? 'gradient-primary text-white' : 'glass'}`}>{t}</button>
                  ))}</div>
                </div>
                <div><label className="text-sm text-stone-400 block mb-2">Quantity: {shoppingQty}</label>
                  <input type="range" min="1" max="10" value={shoppingQty} onChange={e => setShoppingQty(+e.target.value)} className="w-full" />
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-400">
                  <input type="checkbox" checked={isSecondhand} onChange={e => setIsSecondhand(e.target.checked)} className="rounded" /> Secondhand / pre-owned
                </label>
                <p className="text-sm text-stone-500">Estimated: <span className="text-ocean-400 font-semibold">{calculateShoppingEmission(shoppingType, shoppingQty, isSecondhand).toFixed(2)} kg CO₂e</span></p>
              </>}

              {category === 'waste' && <>
                <div><label className="text-sm text-stone-400 block mb-2">Waste type</label>
                  <div className="grid grid-cols-2 gap-2">{(['general', 'recycling', 'compost', 'electronic'] as const).map(t => (
                    <button key={t} onClick={() => setWasteType(t)} className={`p-2 rounded-lg text-xs font-medium capitalize ${wasteType === t ? 'gradient-primary text-white' : 'glass'}`}>{t}</button>
                  ))}</div>
                </div>
                <div><label className="text-sm text-stone-400 block mb-2">Weight: {wasteWeight} kg</label>
                  <input type="range" min="0.1" max="10" step="0.1" value={wasteWeight} onChange={e => setWasteWeight(+e.target.value)} className="w-full" />
                </div>
                <p className="text-sm text-stone-500">Estimated: <span className="text-ocean-400 font-semibold">{calculateWasteEmission(wasteType, wasteWeight).toFixed(2)} kg CO₂e</span>
                  {(wasteType === 'recycling' || wasteType === 'compost') && <span className="text-eco-green ml-1">(saves emissions!)</span>}
                </p>
              </>}

              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={reset} className="glass px-4 py-3 rounded-xl text-sm font-medium">Back</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLog}
                  className="flex-1 gradient-primary px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-lg shadow-ocean-500/20">Log Activity ✓</motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// AI CLIMATE COACH
// ============================================================================
function CoachPage() {
  const { userProfile, logs, coachRecommendations, setCoachRecommendations, setIsLoading, isLoading } = useStore();
  const [hasGenerated, setHasGenerated] = useState(coachRecommendations.length > 0);

  const handleGenerate = async () => {
    if (!userProfile) return;
    setIsLoading(true);
    try {
      const recs = await generateCoachAdvice(userProfile, logs);
      setCoachRecommendations(recs);
      setHasGenerated(true);
    } catch (err) { console.error(err); }
    setIsLoading(false);
  };

  const confidenceColors = { high: 'text-eco-green', medium: 'text-earth-400', low: 'text-stone-400' };
  const feasibilityIcons = { easy: '🟢', moderate: '🟡', challenging: '🔴' };

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="glass-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🤖</span>
          <div>
            <h1 className="text-2xl font-bold">AI Climate Coach</h1>
            <p className="text-sm text-stone-400">Personalized recommendations based on your behavior{isAIAvailable() ? ' • Powered by Gemini AI' : ' • Local analysis mode'}</p>
          </div>
        </div>
        {!isAIAvailable() && <p className="text-xs text-stone-500 mt-2 glass p-2 rounded-lg">ℹ️ Connect a Gemini API key for AI-powered coaching. Currently using rule-based analysis.</p>}
      </motion.div>

      {logs.length < 3 ? (
        <motion.div variants={staggerItem} className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold mb-2">Need more data</h3>
          <p className="text-stone-400 text-sm">Log at least 3 activities to get personalized coaching recommendations.</p>
          <p className="text-stone-500 text-xs mt-2">You've logged {logs.length} so far.</p>
        </motion.div>
      ) : (
        <>
          <motion.div variants={staggerItem}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGenerate} disabled={isLoading}
              className="w-full gradient-primary p-4 rounded-xl text-sm font-semibold text-white shadow-lg shadow-ocean-500/20 disabled:opacity-50">
              {isLoading ? '🔄 Analyzing your data...' : hasGenerated ? '🔄 Refresh Recommendations' : '✨ Get AI Recommendations'}
            </motion.button>
          </motion.div>

          {isLoading && (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="glass-card p-6 space-y-3"><div className="h-4 shimmer-loading rounded w-2/3" /><div className="h-3 shimmer-loading rounded w-full" /><div className="h-3 shimmer-loading rounded w-1/2" /></div>)}</div>
          )}

          {!isLoading && coachRecommendations.map((rec, i) => (
            <motion.div key={rec.id} variants={staggerItem} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.1 } }}
              className="glass-card p-6 hover:border-ocean-500/30">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_ICONS[rec.category]}</span>
                  <h3 className="font-semibold">{rec.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {rec.isAIGenerated && <span className="text-[10px] px-2 py-0.5 rounded-full gradient-primary text-white font-medium">AI</span>}
                  <span className="text-[10px] font-medium">{feasibilityIcons[rec.feasibility]} {rec.feasibility}</span>
                </div>
              </div>
              <p className="text-sm text-stone-300 mb-3">{rec.description}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="glass px-2 py-1 rounded-lg">💰 Save ~<span className="text-ocean-400 font-semibold">{rec.estimatedSavingsKg} kg</span> CO₂e</span>
                <span className={`glass px-2 py-1 rounded-lg ${confidenceColors[rec.confidence]}`}>Confidence: {rec.confidence}</span>
              </div>
              {rec.whyExplanation && <p className="text-xs text-stone-500 mt-3 italic">💡 {rec.whyExplanation}</p>}
            </motion.div>
          ))}
        </>
      )}
    </motion.div>
  );
}

// ============================================================================
// CARBON TWIN
// ============================================================================
function TwinPage() {
  const { userProfile, logs, carbonTwin, setCarbonTwin, setCurrentPage } = useStore();

  useEffect(() => {
    if (!userProfile) return;
    const daysActive = Math.max(1, new Set(logs.map(l => l.timestamp.split('T')[0])).size);
    const currentAnnual = logs.length > 0 ? projectAnnualEmissions(logs, daysActive) : userProfile.baselineFootprint;
    const futureAnnual = currentAnnual * 1.03; // 3% growth if nothing changes
    const ecoAnnual = calculateEcoBaseline(userProfile.region);
    const goalAnnual = currentAnnual * 0.7; // 30% reduction goal

    const generateMonthly = (annual: number) =>
      Array.from({ length: 12 }, () => Math.round((annual / 12) * (0.8 + Math.random() * 0.4)));

    setCarbonTwin({
      currentMe: currentAnnual, futureMe: Math.round(futureAnnual),
      ecoMe: ecoAnnual, goalMe: Math.round(goalAnnual),
      currentMeMonthly: generateMonthly(currentAnnual), futureMeMonthly: generateMonthly(futureAnnual),
      ecoMeMonthly: generateMonthly(ecoAnnual), goalMeMonthly: generateMonthly(goalAnnual),
    });
  }, [userProfile, logs]);

  if (!carbonTwin || !userProfile) return null;

  const twins = [
    { label: 'Current Me', value: carbonTwin.currentMe, color: '#f59e0b', icon: '🧑', data: carbonTwin.currentMeMonthly },
    { label: 'Future Me', value: carbonTwin.futureMe, color: '#ef4444', icon: '📈', desc: 'If nothing changes', data: carbonTwin.futureMeMonthly },
    { label: 'Goal Me', value: carbonTwin.goalMe, color: '#3b82f6', icon: '🎯', desc: '30% reduction target', data: carbonTwin.goalMeMonthly },
    { label: 'Eco Me', value: carbonTwin.ecoMe, color: '#22c55e', icon: '🌿', desc: 'Best case scenario', data: carbonTwin.ecoMeMonthly },
  ];

  const chartData = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    current: carbonTwin.currentMeMonthly[i],
    future: carbonTwin.futureMeMonthly[i],
    goal: carbonTwin.goalMeMonthly[i],
    eco: carbonTwin.ecoMeMonthly[i],
  }));

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">👥 Carbon Twin</h1>
        <p className="text-sm text-stone-400 mt-1">Four versions of you — see how different choices shape your future footprint.</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {twins.map((twin, i) => (
          <motion.div key={i} variants={staggerItem} className="glass-card p-5 text-center" style={{ borderColor: twin.color + '30' }}>
            <div className="text-3xl mb-2">{twin.icon}</div>
            <p className="text-xs text-stone-400 font-medium">{twin.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: twin.color }}><CountUp end={twin.value} /></p>
            <p className="text-xs text-stone-500">kg CO₂e / year</p>
            {twin.desc && <p className="text-[10px] text-stone-600 mt-1">{twin.desc}</p>}
          </motion.div>
        ))}
      </div>

      <motion.div variants={staggerItem} className="glass-card p-6">
        <h3 className="text-sm font-semibold text-stone-300 mb-4">Monthly Projection Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3a2c" />
            <XAxis dataKey="month" tick={{ fill: '#a8a29e', fontSize: 12 }} axisLine={false} />
            <YAxis tick={{ fill: '#a8a29e', fontSize: 12 }} axisLine={false} unit=" kg" />
            <Tooltip contentStyle={{ background: '#122a20', border: '1px solid #245038', borderRadius: '12px', color: '#f5f5f4' }} />
            <Area type="monotone" dataKey="future" stroke="#ef4444" fill="#ef444420" strokeWidth={2} name="Future Me" />
            <Area type="monotone" dataKey="current" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} name="Current Me" />
            <Area type="monotone" dataKey="goal" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="Goal Me" />
            <Area type="monotone" dataKey="eco" stroke="#22c55e" fill="#22c55e20" strokeWidth={2} name="Eco Me" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div variants={staggerItem} className="glass-card p-6 text-center">
        <p className="text-stone-400 text-sm mb-3">The gap between Current You and Eco You is <span className="text-ocean-400 font-semibold">{(carbonTwin.currentMe - carbonTwin.ecoMe).toLocaleString()} kg CO₂e</span> per year.</p>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setCurrentPage('simulator')}
          className="gradient-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white">Explore What-If Scenarios →</motion.button>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// WHAT-IF SIMULATOR
// ============================================================================
function SimulatorPage() {
  const { userProfile, logs } = useStore();
  const breakdown = useMemo(() => getCategoryBreakdown(logs), [logs]);
  const daysActive = useMemo(() => Math.max(1, new Set(logs.map(l => l.timestamp.split('T')[0])).size), [logs]);
  const currentAnnual = useMemo(() => logs.length > 0 ? projectAnnualEmissions(logs, daysActive) : (userProfile?.baselineFootprint ?? 10000), [logs, daysActive, userProfile]);

  const [carReduction, setCarReduction] = useState(0);
  const [meatReduction, setMeatReduction] = useState(0);
  const [energyReduction, setEnergyReduction] = useState(0);
  const [shoppingReduction, setShoppingReduction] = useState(0);

  const annualBaseline = useMemo(() => {
    const scale = 365 / Math.max(daysActive, 1);
    return {
      transport: breakdown.transport * scale,
      food: breakdown.food * scale,
      energy: breakdown.energy * scale,
      shopping: breakdown.shopping * scale,
    };
  }, [breakdown, daysActive]);

  const savings = useMemo(() => {
    const transportSave = annualBaseline.transport * (carReduction / 100);
    const foodSave = annualBaseline.food * (meatReduction / 100);
    const energySave = annualBaseline.energy * (energyReduction / 100);
    const shoppingSave = annualBaseline.shopping * (shoppingReduction / 100);
    const totalYearly = transportSave + foodSave + energySave + shoppingSave;
    return {
      yearly: Math.round(totalYearly),
      monthly: Math.round(totalYearly / 12),
      trees: Math.round(totalYearly / 22 * 10) / 10,
      fuel: estimateFuelSaved(totalYearly),
      money: estimateMoneySaved(totalYearly),
      newAnnual: Math.round(currentAnnual - totalYearly),
    };
  }, [carReduction, meatReduction, energyReduction, shoppingReduction, annualBaseline, currentAnnual]);

  const sliders = [
    { label: 'Replace car trips with cycling/transit', value: carReduction, onChange: setCarReduction, icon: '🚴', color: '#3b82f6' },
    { label: 'Reduce meat consumption', value: meatReduction, onChange: setMeatReduction, icon: '🥗', color: '#22c55e' },
    { label: 'Reduce energy usage', value: energyReduction, onChange: setEnergyReduction, icon: '⚡', color: '#f59e0b' },
    { label: 'Reduce new purchases', value: shoppingReduction, onChange: setShoppingReduction, icon: '🛍️', color: '#a855f7' },
  ];

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">🔮 What-If Simulator</h1>
        <p className="text-sm text-stone-400 mt-1">Drag the sliders to see how lifestyle changes affect your footprint in real time.</p>
      </motion.div>

      {/* Sliders */}
      {sliders.map((s, i) => (
        <motion.div key={i} variants={staggerItem} className="glass-card p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium flex items-center gap-2"><span className="text-xl">{s.icon}</span>{s.label}</span>
            <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}%</span>
          </div>
          <input type="range" min="0" max="100" value={s.value} onChange={e => s.onChange(+e.target.value)} className="w-full" />
        </motion.div>
      ))}

      {/* Results */}
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h3 className="text-sm font-semibold text-stone-300 mb-4">Projected Impact</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Yearly savings', value: savings.yearly, unit: 'kg CO₂e', icon: '📉', color: 'text-eco-green' },
            { label: 'Monthly savings', value: savings.monthly, unit: 'kg CO₂e', icon: '📅', color: 'text-ocean-400' },
            { label: 'Trees equivalent', value: savings.trees, unit: 'trees/yr', icon: '🌳', color: 'text-eco-green' },
            { label: 'Fuel saved', value: savings.fuel, unit: 'liters', icon: '⛽', color: 'text-earth-400' },
            { label: 'Money saved', value: savings.money, unit: 'USD', icon: '💰', color: 'text-earth-300' },
            { label: 'New annual total', value: savings.newAnnual, unit: 'kg CO₂e', icon: '🎯', color: savings.newAnnual < currentAnnual ? 'text-eco-green' : 'text-stone-100' },
          ].map((item, i) => (
            <div key={i} className="glass p-4 rounded-xl text-center">
              <div className="text-xl mb-1">{item.icon}</div>
              <p className={`text-xl font-bold ${item.color}`}><CountUp end={item.value} /></p>
              <p className="text-xs text-stone-500">{item.unit}</p>
              <p className="text-[10px] text-stone-600 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Visual comparison bar */}
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h3 className="text-sm font-semibold text-stone-300 mb-3">Annual Footprint Comparison</h3>
        <div className="space-y-3">
          {[
            { label: 'Current', value: currentAnnual, color: '#f59e0b' },
            { label: 'After changes', value: savings.newAnnual, color: '#22c55e' },
            { label: 'Regional avg', value: REGIONAL_AVERAGES[userProfile?.region ?? 'north_america'], color: '#78716c' },
          ].map((bar, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1"><span className="text-stone-400">{bar.label}</span><span className="font-medium">{bar.value.toLocaleString()} kg</span></div>
              <div className="h-3 bg-forest-800 rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: bar.color }}
                  initial={{ width: 0 }} animate={{ width: `${Math.min((bar.value / 20000) * 100, 100)}%` }} transition={{ duration: 0.8, delay: i * 0.15 }} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// GOALS & GAMIFICATION
// ============================================================================
function GoalsPage() {
  const { goals, addGoal, achievements, streak, logs, challenges, addChallenge, updateChallenge, userProfile, setIsLoading, isLoading } = useStore();
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTarget, setGoalTarget] = useState(20);
  const [goalTitle, setGoalTitle] = useState('Reduce my carbon footprint');
  const [activeTab, setActiveTab] = useState<'goals' | 'achievements' | 'challenges'>('goals');

  const handleAddGoal = () => {
    const goal: Goal = {
      id: uid(), title: goalTitle, targetReductionPercent: goalTarget, currentReductionPercent: 0,
      startDate: new Date().toISOString(), endDate: new Date(Date.now() + 90 * 86400000).toISOString(), isCompleted: false,
    };
    addGoal(goal);
    setShowGoalForm(false);
    setGoalTitle('Reduce my carbon footprint');
    setGoalTarget(20);
  };

  const handleGenerateChallenge = async () => {
    if (!userProfile) return;
    setIsLoading(true);
    try {
      const result = await generateChallenge(userProfile, logs, challenges.filter(c => c.isCompleted));
      addChallenge({ ...result, id: uid(), isActive: true, isCompleted: false, progress: 0 });
    } catch (err) { console.error(err); }
    setIsLoading(false);
  };

  const tabs = [
    { key: 'goals' as const, label: '🎯 Goals', count: goals.length },
    { key: 'achievements' as const, label: '🏆 Achievements', count: achievements.filter(a => a.isUnlocked).length },
    { key: 'challenges' as const, label: '⚡ Challenges', count: challenges.filter(c => c.isActive).length },
  ];

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* Header with Streak */}
      <motion.div variants={staggerItem} className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Goals & Progress</h1>
            <p className="text-sm text-stone-400 mt-1">Track your journey and celebrate wins</p>
          </div>
          <div className="text-center glass p-3 rounded-xl">
            <p className="text-2xl font-bold text-ocean-400">{streak.currentDays} 🔥</p>
            <p className="text-[10px] text-stone-500">Day streak</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key ? 'gradient-primary text-white' : 'glass text-stone-400 hover:text-stone-200'}`}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          {goals.map(goal => (
            <motion.div key={goal.id} variants={staggerItem} className="glass-card p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">{goal.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${goal.isCompleted ? 'bg-eco-green/20 text-eco-green' : 'bg-ocean-500/20 text-ocean-400'}`}>{goal.isCompleted ? '✓ Completed' : 'Active'}</span>
              </div>
              <div className="h-2 bg-forest-800 rounded-full overflow-hidden mb-2">
                <motion.div className="h-full rounded-full gradient-primary" initial={{ width: 0 }} animate={{ width: `${Math.min(goal.currentReductionPercent / goal.targetReductionPercent * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-stone-500">{goal.currentReductionPercent}% of {goal.targetReductionPercent}% target</p>
            </motion.div>
          ))}
          {!showGoalForm ? (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowGoalForm(true)}
              className="w-full glass-card p-4 text-center text-sm font-medium text-ocean-400 hover:border-ocean-500/40">+ Set New Goal</motion.button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
              <input type="text" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="Goal title" />
              <div><label className="text-sm text-stone-400 block mb-2">Reduction target: {goalTarget}%</label>
                <input type="range" min="5" max="80" value={goalTarget} onChange={e => setGoalTarget(+e.target.value)} className="w-full" /></div>
              <div className="flex gap-3">
                <button onClick={() => setShowGoalForm(false)} className="glass px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button onClick={handleAddGoal} className="flex-1 gradient-primary px-4 py-2 rounded-lg text-sm font-semibold text-white">Create Goal</button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {achievements.map(ach => (
            <motion.div key={ach.id} variants={staggerItem}
              className={`glass-card p-4 text-center transition-all ${ach.isUnlocked ? 'border-ocean-500/30' : 'opacity-40 grayscale'}`}>
              <div className="text-3xl mb-2">{ach.icon}</div>
              <p className="text-sm font-semibold">{ach.title}</p>
              <p className="text-[10px] text-stone-500 mt-1">{ach.description}</p>
              {ach.isUnlocked && <p className="text-[10px] text-ocean-400 mt-1">✓ Unlocked</p>}
            </motion.div>
          ))}
        </div>
      )}

      {/* Challenges Tab */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {challenges.map(ch => (
            <motion.div key={ch.id} variants={staggerItem} className="glass-card p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{ch.title}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Week {ch.weekNumber} • {ch.difficulty}{ch.isAIGenerated ? ' • AI Generated' : ''}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ch.isCompleted ? 'bg-eco-green/20 text-eco-green' : ch.isActive ? 'bg-ocean-500/20 text-ocean-400' : 'bg-stone-600/20 text-stone-400'}`}>
                  {ch.isCompleted ? '✓ Done' : ch.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-stone-400 mb-3">{ch.description}</p>
              <div className="h-2 bg-forest-800 rounded-full overflow-hidden mb-2">
                <motion.div className="h-full rounded-full gradient-success" initial={{ width: 0 }} animate={{ width: `${ch.progress}%` }} />
              </div>
              {ch.isActive && !ch.isCompleted && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => updateChallenge(ch.id, { progress: 100, isCompleted: true, isActive: false })}
                  className="mt-2 text-xs gradient-primary px-3 py-1.5 rounded-lg text-white font-medium">Mark Complete</motion.button>
              )}
            </motion.div>
          ))}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGenerateChallenge} disabled={isLoading}
            className="w-full gradient-primary p-4 rounded-xl text-sm font-semibold text-white shadow-lg shadow-ocean-500/20 disabled:opacity-50">
            {isLoading ? '🔄 Generating...' : '✨ Generate New Challenge'}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// WEEKLY REPORT
// ============================================================================
function ReportPage() {
  const { userProfile, logs, goals, weeklyReports, addWeeklyReport, setIsLoading, isLoading } = useStore();

  const handleGenerate = async () => {
    if (!userProfile) return;
    setIsLoading(true);
    try {
      const reportData = await generateWeeklyReport(userProfile, logs, goals);
      const now = new Date();
      const report: WeeklyReport = {
        id: uid(), weekStartDate: new Date(now.getTime() - 7 * 86400000).toISOString(),
        weekEndDate: now.toISOString(), generatedAt: now.toISOString(), ...reportData,
      };
      addWeeklyReport(report);
    } catch (err) { console.error(err); }
    setIsLoading(false);
  };

  const latestReport = weeklyReports[weeklyReports.length - 1];

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">📊 Weekly Report</h1>
        <p className="text-sm text-stone-400 mt-1">AI-generated summary of your week{isAIAvailable() ? ' • Powered by Gemini' : ''}</p>
      </motion.div>

      <motion.button variants={staggerItem} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGenerate} disabled={isLoading}
        className="w-full gradient-primary p-4 rounded-xl text-sm font-semibold text-white shadow-lg shadow-ocean-500/20 disabled:opacity-50">
        {isLoading ? '🔄 Generating report...' : '✨ Generate Weekly Report'}
      </motion.button>

      {latestReport && (
        <>
          <motion.div variants={staggerItem} className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Summary</h3>
              {latestReport.isAIGenerated && <span className="text-[10px] px-2 py-0.5 rounded-full gradient-primary text-white font-medium">AI Generated</span>}
            </div>
            <p className="text-sm text-stone-300 leading-relaxed">{latestReport.narrativeSummary}</p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <motion.div variants={staggerItem} className="glass-card p-5 text-center">
              <p className="text-xs text-stone-500">Total emissions</p>
              <p className="text-2xl font-bold text-ocean-400"><CountUp end={latestReport.totalEmissionsKg} /> kg</p>
            </motion.div>
            <motion.div variants={staggerItem} className="glass-card p-5 text-center">
              <p className="text-xs text-stone-500">vs. Last Week</p>
              <p className={`text-2xl font-bold ${latestReport.comparedToLastWeek < 0 ? 'text-eco-green' : 'text-eco-red'}`}>
                {latestReport.comparedToLastWeek < 0 ? '↓' : '↑'} {Math.abs(latestReport.comparedToLastWeek).toFixed(1)}%
              </p>
            </motion.div>
          </div>

          {latestReport.biggestWins.length > 0 && (
            <motion.div variants={staggerItem} className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">🎉 Biggest Wins</h3>
              {latestReport.biggestWins.map((win, i) => (
                <div key={i} className="flex items-start gap-2 mb-2"><span className="text-eco-green">✓</span><span className="text-sm text-stone-300">{win}</span></div>
              ))}
            </motion.div>
          )}

          {latestReport.recommendedActions.length > 0 && (
            <motion.div variants={staggerItem} className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">💡 Recommended Actions</h3>
              {latestReport.recommendedActions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 mb-2"><span className="text-ocean-400">→</span><span className="text-sm text-stone-300">{action}</span></div>
              ))}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ============================================================================
// SETTINGS
// ============================================================================
function SettingsPage() {
  const { userProfile, resetStore, setIsOnboarding, logs } = useStore();
  const [showConfirm, setShowConfirm] = useState(false);
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h1 className="text-2xl font-bold">⚙️ Settings</h1>
      </motion.div>
      {userProfile && (
        <motion.div variants={staggerItem} className="glass-card p-6 space-y-3">
          <h3 className="font-semibold">Your Profile</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="glass p-3 rounded-lg"><span className="text-stone-500 text-xs block">Name</span>{userProfile.name}</div>
            <div className="glass p-3 rounded-lg"><span className="text-stone-500 text-xs block">Region</span>{REGION_LABELS[userProfile.region]}</div>
            <div className="glass p-3 rounded-lg"><span className="text-stone-500 text-xs block">Diet</span>{DIET_LABELS[userProfile.diet]}</div>
            <div className="glass p-3 rounded-lg"><span className="text-stone-500 text-xs block">Transport</span>{TRANSPORT_LABELS[userProfile.primaryTransport]}</div>
            <div className="glass p-3 rounded-lg"><span className="text-stone-500 text-xs block">Baseline</span>{userProfile.baselineFootprint.toLocaleString()} kg/yr</div>
            <div className="glass p-3 rounded-lg"><span className="text-stone-500 text-xs block">Logs</span>{logs.length} activities</div>
          </div>
        </motion.div>
      )}
      <motion.div variants={staggerItem} className="glass-card p-6">
        <h3 className="font-semibold mb-3">AI Status</h3>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isAIAvailable() ? 'bg-eco-green/20 text-eco-green' : 'bg-earth-500/20 text-earth-400'}`}>
          <span className={`w-2 h-2 rounded-full ${isAIAvailable() ? 'bg-eco-green' : 'bg-earth-400'}`} />
          {isAIAvailable() ? 'Gemini AI Connected' : 'Local Analysis Mode (add VITE_GEMINI_API_KEY)'}
        </div>
      </motion.div>
      <motion.div variants={staggerItem} className="glass-card p-6">
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} className="text-sm text-eco-red hover:underline">Reset all data</button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-stone-300">Are you sure? This will delete all your data.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="glass px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => { resetStore(); setIsOnboarding(true); }} className="bg-eco-red/20 text-eco-red px-4 py-2 rounded-lg text-sm font-medium">Delete Everything</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================
export default function App() {
  const { isOnboarding, currentPage, setCurrentPage } = useStore();
  const shouldReduceMotion = useReducedMotion();

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'coach': return <CoachPage />;
      case 'twin': return <TwinPage />;
      case 'simulator': return <SimulatorPage />;
      case 'goals': return <GoalsPage />;
      case 'report': return <ReportPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  if (isOnboarding) return <Onboarding />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-64 min-h-screen glass border-r border-forest-600/30 p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center text-lg">🌍</div>
          <div><h1 className="text-lg font-bold gradient-text-primary">EcoTrack AI</h1><p className="text-[10px] text-stone-500">Climate Intelligence</p></div>
        </div>
        <div className="space-y-1 flex-1">
          {[...NAV_ITEMS, { page: 'report' as PageName, label: 'Report', icon: '📊' }, { page: 'settings' as PageName, label: 'Settings', icon: '⚙️' }].map(item => (
            <motion.button key={item.page} whileHover={{ x: 4 }} onClick={() => setCurrentPage(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${currentPage === item.page ? 'gradient-primary text-white shadow-lg shadow-ocean-500/10' : 'text-stone-400 hover:text-stone-200 hover:bg-forest-800/50'}`}>
              <span className="text-lg">{item.icon}</span>{item.label}
            </motion.button>
          ))}
        </div>
        <div className="text-xs text-stone-600 px-2 mt-4">
          {isAIAvailable() ? <span className="text-eco-green">● AI Connected</span> : <span className="text-earth-400">● Local Mode</span>}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div key={currentPage} variants={shouldReduceMotion ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } } : pageV}
            initial="initial" animate="animate" exit="exit">
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-forest-600/30 px-2 py-1.5 z-40">
        <div className="flex justify-around">
          {NAV_ITEMS.map(item => (
            <button key={item.page} onClick={() => setCurrentPage(item.page)}
              className={`flex flex-col items-center py-1.5 px-2 rounded-xl transition-all ${currentPage === item.page ? 'text-ocean-400' : 'text-stone-500'}`}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Log Modal */}
      <LogModal />
    </div>
  );
}
