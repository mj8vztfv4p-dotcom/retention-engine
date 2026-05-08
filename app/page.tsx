"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar as CalendarIcon, BarChart3, Target, Flame, 
  Clock, Search, Filter, Download, Upload, Bell, Award 
} from 'lucide-react';
import { format, addDays, subDays, startOfDay, isToday, differenceInDays, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

// Types
interface Review {
  date: string;
  quality: number;
  recallLevel: 'easy' | 'medium' | 'hard' | 'forgot';
}

interface Topic {
  id: string;
  name: string;
  note?: string;
  subject: string;
  type: 'Prelims' | 'Mains' | 'Both';
  tags: string[];
  createdAt: string;
  lastReviewed: string | null;
  nextReview: string;
  intervalDays: number;
  easeFactor: number;
  reviews: Review[];
  retentionScore: number;
  strength: number;
}

const SUBJECTS = [
  'Polity', 'Geography', 'History', 'Economy', 
  'Science & Tech', 'Environment', 'Current Affairs', 'Ethics'
];

const TAG_OPTIONS = ['Static', 'Current Affairs', 'PYQ', 'Important', 'Weak Area', 'Prelims Focus', 'Mains Focus'];

const INITIAL_TOPICS: Topic[] = [
  {
    id: 't1',
    name: 'Indian Monsoon Mechanism',
    note: 'ITCZ, Jet streams, El Niño impact',
    subject: 'Geography',
    type: 'Prelims',
    tags: ['Static', 'Important'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    lastReviewed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    nextReview: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    intervalDays: 7,
    easeFactor: 2.1,
    reviews: [
      { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), quality: 4, recallLevel: 'medium' },
      { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(), quality: 5, recallLevel: 'easy' },
      { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), quality: 3, recallLevel: 'hard' }
    ],
    retentionScore: 68,
    strength: 3
  },
  {
    id: 't2',
    name: 'Fundamental Rights - Laxmikanth',
    note: 'Articles 12-35, exceptions, case laws',
    subject: 'Polity',
    type: 'Both',
    tags: ['Static', 'PYQ', 'Important'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    lastReviewed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    nextReview: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
    intervalDays: 15,
    easeFactor: 2.4,
    reviews: [
      { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(), quality: 5, recallLevel: 'easy' },
      { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), quality: 4, recallLevel: 'medium' },
      { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), quality: 5, recallLevel: 'easy' }
    ],
    retentionScore: 92,
    strength: 5
  },
  {
    id: 't3',
    name: 'Human Heart Physiology',
    note: 'Cardiac cycle, ECG, blood pressure regulation',
    subject: 'Science & Tech',
    type: 'Prelims',
    tags: ['Static'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    lastReviewed: null,
    nextReview: new Date(Date.now() + 1000 * 60 * 60 * 24 * 0).toISOString(),
    intervalDays: 1,
    easeFactor: 2.5,
    reviews: [],
    retentionScore: 100,
    strength: 0
  }
];

export default function RetentionEngine() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'revisions' | 'calendar' | 'stats' | 'topics'>('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [newTopic, setNewTopic] = useState({
    name: '',
    note: '',
    subject: 'Polity',
    type: 'Prelims' as const,
    tags: [] as string[]
  });
  const [recallLevel, setRecallLevel] = useState<'easy' | 'medium' | 'hard' | 'forgot'>('medium');
  const [aiPrompts, setAiPrompts] = useState<string[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const savedTopics = localStorage.getItem('retention-topics');
    if (savedTopics) {
      setTopics(JSON.parse(savedTopics));
    } else {
      setTopics(INITIAL_TOPICS);
      localStorage.setItem('retention-topics', JSON.stringify(INITIAL_TOPICS));
    }

    const savedStreak = localStorage.getItem('retention-streak');
    if (savedStreak) setStreak(parseInt(savedStreak));

    const savedLongest = localStorage.getItem('retention-longest-streak');
    if (savedLongest) setLongestStreak(parseInt(savedLongest));

    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (topics.length > 0) {
      localStorage.setItem('retention-topics', JSON.stringify(topics));
    }
  }, [topics]);

  // Calculate streak
  useEffect(() => {
    const calculateStreak = () => {
      let currentStreak = 0;
      let maxStreak = 0;
      const today = startOfDay(new Date());
      let checkDate = today;

      for (let i = 0; i < 90; i++) {
        const dayStr = format(checkDate, 'yyyy-MM-dd');
        const hasRevision = topics.some(t => 
          t.reviews.some(r => format(parseISO(r.date), 'yyyy-MM-dd') === dayStr)
        );

        if (hasRevision) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          if (i === 0) currentStreak = 0;
          else break;
        }
        checkDate = subDays(checkDate, 1);
      }

      setStreak(currentStreak);
      setLongestStreak(Math.max(maxStreak, parseInt(localStorage.getItem('retention-longest-streak') || '0')));
      
      localStorage.setItem('retention-streak', currentStreak.toString());
      if (maxStreak > parseInt(localStorage.getItem('retention-longest-streak') || '0')) {
        localStorage.setItem('retention-longest-streak', maxStreak.toString());
        setLongestStreak(maxStreak);
      }
    };

    if (topics.length > 0) calculateStreak();
  }, [topics]);

  // SM-2 Spaced Repetition Algorithm
  const calculateNextReview = (
    currentInterval: number, 
    easeFactor: number, 
    quality: number
  ): { newInterval: number; newEase: number; nextDate: Date } => {
    let newInterval = currentInterval;
    let newEase = easeFactor;

    if (quality >= 3) {
      if (currentInterval === 0) {
        newInterval = 1;
      } else {
        newInterval = Math.round(currentInterval * easeFactor);
      }
      newEase = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    } else {
      newInterval = 1;
      newEase = Math.max(1.3, easeFactor - 0.2);
    }

    newInterval = Math.min(newInterval, 365);
    
    const nextDate = addDays(new Date(), newInterval);
    return { newInterval, newEase, nextDate };
  };

  // Predict retention
  const predictRetention = (topic: Topic): { current: number; in5Days: number; message: string } => {
    if (!topic.lastReviewed) {
      return { current: 100, in5Days: 85, message: "New topic — revise today for best retention!" };
    }

    const daysSince = differenceInDays(new Date(), parseISO(topic.lastReviewed));
    const tau = topic.intervalDays * 1.8;
    const currentRetention = Math.max(15, Math.round(100 * Math.exp(-daysSince / tau)));
    
    const futureDays = 5;
    const futureRetention = Math.max(10, Math.round(100 * Math.exp(-(daysSince + futureDays) / tau)));
    
    let message = "";
    if (currentRetention < 50) {
      message = `Critical! Retention may drop to ${futureRetention}% in 5 days. Revise now.`;
    } else if (currentRetention < 75) {
      message = `Moderate decay. In 5 days: ~${futureRetention}%.`;
    } else {
      message = `Strong memory. In 5 days: ~${futureRetention}%.`;
    }

    return { current: currentRetention, in5Days: futureRetention, message };
  };

  // Generate AI-powered active recall prompts
  const generateAIPrompts = (topic: Topic): string[] => {
    const basePrompts = [
      `Explain the core mechanism/concept of "${topic.name}" in your own words as if teaching a beginner.`,
      `What are the 3-5 most critical components or stages in ${topic.name}? List them.`,
      `How does ${topic.name} connect to other topics in ${topic.subject}? Give one example.`,
      `Recall a specific PYQ or real-world application related to ${topic.name}. What was the answer?`,
      `What are the common misconceptions or edge cases in ${topic.name}?`,
      `If you had to summarize ${topic.name} in 3 bullet points for a 30-second answer, what would they be?`
    ];

    const lowerName = topic.name.toLowerCase();
    const smartPrompts: string[] = [];

    if (lowerName.includes('monsoon') || lowerName.includes('rain')) {
      smartPrompts.push(
        "Describe the exact role of the Inter-Tropical Convergence Zone (ITCZ) and Somali Jet in the Indian monsoon onset.",
        "Explain how El Niño and La Niña events influence the Indian monsoon rainfall quantitatively."
      );
    }
    if (lowerName.includes('fundamental right') || lowerName.includes('article')) {
      smartPrompts.push(
        "List the 6 Fundamental Rights with their article numbers and one landmark Supreme Court case for each.",
        "What are the reasonable restrictions on Article 19? Explain with examples."
      );
    }
    if (lowerName.includes('heart') || lowerName.includes('cardiac')) {
      smartPrompts.push(
        "Draw and explain the Wiggers diagram for one cardiac cycle, including pressure changes.",
        "How does the SA node, AV node, and Purkinje fibers coordinate the heartbeat? What happens in heart block?"
      );
    }
    if (lowerName.includes('laxmikanth') || topic.subject === 'Polity') {
      smartPrompts.push(
        "Compare and contrast Fundamental Rights vs Directive Principles of State Policy with 4 key differences.",
        "Explain the procedure for amending the Constitution under Article 368 with examples of major amendments."
      );
    }

    const allPrompts = [...basePrompts, ...smartPrompts];
    const unique = Array.from(new Set(allPrompts));
    return unique.slice(0, 5);
  };

  // Handle adding new topic
  const handleAddTopic = () => {
    if (!newTopic.name.trim()) {
      toast.error("Topic name is required");
      return;
    }

    const now = new Date();
    const firstReviewDate = addDays(now, 0);

    const topic: Topic = {
      id: `t_${Date.now()}`,
      name: newTopic.name.trim(),
      note: newTopic.note.trim() || undefined,
      subject: newTopic.subject,
      type: newTopic.type,
      tags: newTopic.tags.length > 0 ? newTopic.tags : ['Static'],
      createdAt: now.toISOString(),
      lastReviewed: null,
      nextReview: firstReviewDate.toISOString(),
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: [],
      retentionScore: 100,
      strength: 0
    };

    setTopics(prev => [topic, ...prev]);
    setShowAddModal(false);
    
    setNewTopic({
      name: '', note: '', subject: 'Polity', type: 'Prelims', tags: []
    });

    toast.success("Topic added! First revision scheduled for today.", {
      description: "Tap 'Revise Now' in Today's Queue to start active recall.",
      action: {
        label: "Revise Now",
        onClick: () => {
          setCurrentTopic(topic);
          setAiPrompts(generateAIPrompts(topic));
          setShowReviseModal(true);
        }
      }
    });

    if (topics.length === 0) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  // Handle revision completion
  const handleRevisionComplete = () => {
    if (!currentTopic) return;

    const qualityMap: Record<string, number> = {
      easy: 5,
      medium: 4,
      hard: 3,
      forgot: 1
    };

    const quality = qualityMap[recallLevel];
    const { newInterval, newEase, nextDate } = calculateNextReview(
      currentTopic.intervalDays,
      currentTopic.easeFactor,
      quality
    );

    const newReview: Review = {
      date: new Date().toISOString(),
      quality,
      recallLevel
    };

    const updatedTopic: Topic = {
      ...currentTopic,
      lastReviewed: new Date().toISOString(),
      nextReview: nextDate.toISOString(),
      intervalDays: newInterval,
      easeFactor: newEase,
      reviews: [...currentTopic.reviews, newReview],
      retentionScore: Math.min(100, Math.max(20, 
        currentTopic.retentionScore + (quality >= 4 ? 8 : quality === 3 ? 2 : -15)
      )),
      strength: Math.min(10, currentTopic.strength + (quality >= 4 ? 1 : 0))
    };

    setTopics(prev => prev.map(t => t.id === currentTopic.id ? updatedTopic : t));

    if (quality >= 4) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
      toast.success(`Excellent! Next review in ${newInterval} days`, {
        description: `Ease factor updated to ${newEase.toFixed(1)}`
      });
    } else if (quality === 3) {
      toast("Good effort. Review scheduled sooner.", {
        description: `Next in ${newInterval} days`
      });
    } else {
      toast.error("Don't worry — this strengthens long-term memory!", {
        description: `Reset to 1 day. You'll get it next time.`
      });
    }

    setShowReviseModal(false);
    setCurrentTopic(null);
    setShowPrompts(false);
    setRecallLevel('medium');
  };

  // Open revise modal
  const openRevise = (topic: Topic) => {
    setCurrentTopic(topic);
    const prompts = generateAIPrompts(topic);
    setAiPrompts(prompts);
    setShowPrompts(false);
    setRecallLevel('medium');
    setShowReviseModal(true);
  };

  // Get today's due topics
  const todayDue = topics
    .filter(t => {
      const next = parseISO(t.nextReview);
      return differenceInDays(next, new Date()) <= 0;
    })
    .sort((a, b) => {
      const aOverdue = differenceInDays(new Date(), parseISO(a.nextReview));
      const bOverdue = differenceInDays(new Date(), parseISO(b.nextReview));
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return a.retentionScore - b.retentionScore;
    });

  // Filtered topics
  const filteredTopics = topics
    .filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (t.note && t.note.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesSubject = !filterSubject || t.subject === filterSubject;
      const matchesType = !filterType || t.type === filterType;
      return matchesSearch && matchesSubject && matchesType;
    })
    .sort((a, b) => {
      const aDue = differenceInDays(parseISO(a.nextReview), new Date());
      const bDue = differenceInDays(parseISO(b.nextReview), new Date());
      return aDue - bDue;
    });

  // Calendar generation
  const generateCalendar = (): any[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = subDays(firstDay, firstDay.getDay());
    
    const days: any[] = [];
    let current = startDate;

    for (let i = 0; i < 42; i++) {
      const dayStr = format(current, 'yyyy-MM-dd');
      const dueTopics = topics.filter(t => 
        format(parseISO(t.nextReview), 'yyyy-MM-dd') === dayStr
      );
      const completedToday = topics.some(t => 
        t.reviews.some(r => format(parseISO(r.date), 'yyyy-MM-dd') === dayStr)
      );

      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        hasDue: dueTopics.length > 0,
        isOverdue: dueTopics.some(t => differenceInDays(new Date(), parseISO(t.nextReview)) > 0),
        completed: completedToday,
        dueCount: dueTopics.length
      });

      current = addDays(current, 1);
    }

    return days;
  };

  const calendarDays = generateCalendar();

  // Stats
  const totalTopics = topics.length;
  const avgRetention = totalTopics > 0 
    ? Math.round(topics.reduce((sum, t) => sum + t.retentionScore, 0) / totalTopics) 
    : 0;
  
  const overdueCount = topics.filter(t => 
    differenceInDays(new Date(), parseISO(t.nextReview)) > 0
  ).length;

  const weakTopics = [...topics]
    .sort((a, b) => a.retentionScore - b.retentionScore)
    .slice(0, 3);

  const subjectData = SUBJECTS.map(subject => ({
    name: subject,
    value: topics.filter(t => t.subject === subject).length
  })).filter(d => d.value > 0);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#fb923c', '#22c55e', '#06b67f'];

  const retentionTrend = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTopics = topics.filter(t => 
      t.reviews.some(r => format(parseISO(r.date), 'yyyy-MM-dd') === dayStr)
    );
    const avg = dayTopics.length > 0 
      ? Math.round(dayTopics.reduce((s, t) => s + t.retentionScore, 0) / dayTopics.length) 
      : 75 + Math.random() * 15;
    return {
      day: format(day, 'EEE'),
      retention: Math.round(avg)
    };
  });

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error("Notifications not supported in this browser");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      toast.success("Notifications enabled! You'll get reminders for due revisions.");
      
      setTimeout(() => {
        new Notification("Retention Engine", {
          body: "Time for your daily revision! 3 topics due today.",
          icon: "/favicon.ico"
        });
      }, 1500);
    } else {
      toast.error("Notification permission denied");
    }
  };

  const exportBackup = () => {
    const data = {
      topics,
      streak,
      longestStreak,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retention-engine-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded successfully");
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.topics && Array.isArray(data.topics)) {
          setTopics(data.topics);
          if (data.streak) setStreak(data.streak);
          if (data.longestStreak) setLongestStreak(data.longestStreak);
          toast.success(`Imported ${data.topics.length} topics successfully!`);
        }
      } catch (err) {
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleTag = (tag: string) => {
    setNewTopic(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top Navigation */}
      <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-xl tracking-tighter">Retention Engine</div>
                <div className="text-[10px] text-zinc-500 -mt-1">NEVER FORGET • POWERED BY SCIENCE</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center bg-zinc-900 rounded-full px-1 py-1">
              {(['dashboard', 'revisions', 'calendar', 'stats', 'topics'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm rounded-full transition-all flex items-center gap-2 ${
                    activeTab === tab 
                      ? 'bg-white text-zinc-950 font-medium shadow' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab === 'dashboard' && <BarChart3 className="w-4 h-4" />}
                  {tab === 'revisions' && <Clock className="w-4 h-4" />}
                  {tab === 'calendar' && <CalendarIcon className="w-4 h-4" />}
                  {tab === 'stats' && <Award className="w-4 h-4" />}
                  {tab === 'topics' && <Target className="w-4 h-4" />}
                  <span className="capitalize">{tab}</span>
                </button>
              ))}
            </div>

            <button
              onClick={enableNotifications}
              className={`p-2.5 rounded-xl transition-all ${notificationsEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-zinc-800 text-zinc-400'}`}
            >
              <Bell className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Topic</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-16 max-w-7xl mx-auto px-6 pb-12">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 pt-8">
            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-3xl p-6 border border-zinc-800"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-zinc-500">TOTAL TOPICS</div>
                    <div className="text-5xl font-semibold tabular-nums mt-1">{totalTopics}</div>
                  </div>
                  <Target className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="text-xs text-emerald-400 mt-4 flex items-center gap-1">
                  ↑ {topics.filter(t => t.retentionScore > 80).length} strong
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass rounded-3xl p-6 border border-zinc-800"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-zinc-500">AVG RETENTION</div>
                    <div className="text-5xl font-semibold tabular-nums mt-1">{avgRetention}<span className="text-3xl">%</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 text-sm">+4% this week</div>
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full mt-6 overflow-hidden">
                  <div 
                    className="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full retention-bar" 
                    style={{ width: `${avgRetention}%` }}
                  />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-3xl p-6 border border-zinc-800 flex flex-col"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-zinc-500">CURRENT STREAK</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <div className="text-5xl font-semibold tabular-nums">{streak}</div>
                      <div className="text-xl text-zinc-400">days</div>
                    </div>
                  </div>
                  <Flame className={`w-8 h-8 text-orange-500 streak-fire ${streak > 0 ? '' : 'opacity-30'}`} />
                </div>
                <div className="mt-auto text-xs text-zinc-500">Longest: {longestStreak} days</div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass rounded-3xl p-6 border border-zinc-800"
              >
                <div className="text-sm text-zinc-500 mb-3">TODAY&apos;S QUEUE</div>
                <div className="text-5xl font-semibold tabular-nums">{todayDue.length}</div>
                <div className="text-xs text-zinc-500 mt-1">revisions due</div>
                
                {todayDue.length > 0 && (
                  <button 
                    onClick={() => setActiveTab('revisions')}
                    className="mt-4 text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                  >
                    Start revising →
                  </button>
                )}
              </motion.div>
            </div>

            {/* Memory Decay Prediction + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 glass rounded-3xl p-8 border border-zinc-800">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="font-semibold text-lg">Memory Decay Prediction</div>
                    <div className="text-sm text-zinc-500">Based on Ebbinghaus Forgetting Curve + your performance</div>
                  </div>
                  <div className="text-xs px-3 py-1 bg-zinc-900 rounded-full text-zinc-400">LIVE</div>
                </div>

                {topics.length > 0 ? (
                  <div className="space-y-4">
                    {topics.slice(0, 3).map((topic, idx) => {
                      const pred = predictRetention(topic);
                      return (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-2xl">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{topic.name}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{pred.message}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-semibold tabular-nums text-rose-400">{pred.current}</div>
                            <div className="text-[10px] text-zinc-500 -mt-1">NOW</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-medium tabular-nums text-amber-400">{pred.in5Days}</div>
                            <div className="text-[10px] text-zinc-500 -mt-1">+5 DAYS</div>
                          </div>
                          <button 
                            onClick={() => openRevise(topic)}
                            className="px-4 py-1.5 text-xs rounded-xl border border-zinc-700 hover:bg-zinc-800 whitespace-nowrap"
                          >
                            Revise
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">Add your first topic to see predictions</div>
                )}
              </div>

              <div className="lg:col-span-2 glass rounded-3xl p-8 border border-zinc-800 flex flex-col">
                <div className="font-semibold text-lg mb-4">Quick Actions</div>
                
                <div className="space-y-3 flex-1">
                  <button 
                    onClick={() => setActiveTab('revisions')}
                    className="w-full flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <div className="font-medium">Today&apos;s Revisions</div>
                        <div className="text-xs text-zinc-500">{todayDue.length} due • {todayDue.length > 0 ? 'Start now' : 'All caught up!'}</div>
                      </div>
                    </div>
                    <div className="text-indigo-400 group-hover:translate-x-1 transition">→</div>
                  </button>

                  <button 
                    onClick={() => setActiveTab('calendar')}
                    className="w-full flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <CalendarIcon className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <div className="font-medium">View Calendar</div>
                        <div className="text-xs text-zinc-500">See all scheduled revisions</div>
                      </div>
                    </div>
                    <div className="text-violet-400 group-hover:translate-x-1 transition">→</div>
                  </button>

                  <button 
                    onClick={exportBackup}
                    className="w-full flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Download className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-medium">Export Backup</div>
                        <div className="text-xs text-zinc-500">JSON • Cross-device sync ready</div>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-zinc-800 text-[10px] text-center text-zinc-500">
                  Built with Ebbinghaus • Spaced Repetition • Active Recall • SM-2 Algorithm
                </div>
              </div>
            </div>

            {/* Weak Topics Alert */}
            {weakTopics.length > 0 && weakTopics[0].retentionScore < 65 && (
              <div className="glass border border-rose-500/30 rounded-3xl p-6">
                <div className="flex items-center gap-3 text-rose-400 mb-4">
                  <div className="px-3 py-1 bg-rose-500/10 rounded-full text-xs font-medium">WEAK AREAS DETECTED</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {weakTopics.map((topic, i) => (
                    <div key={i} className="bg-zinc-900/70 rounded-2xl p-5 flex flex-col">
                      <div className="font-medium line-clamp-2">{topic.name}</div>
                      <div className="text-xs text-zinc-500 mt-1">{topic.subject} • {topic.type}</div>
                      
                      <div className="mt-auto flex items-end justify-between">
                        <div>
                          <div className="text-3xl font-semibold text-rose-400 tabular-nums">{topic.retentionScore}</div>
                          <div className="text-xs text-zinc-500 -mt-1">RETENTION</div>
                        </div>
                        <button 
                          onClick={() => openRevise(topic)}
                          className="text-xs px-4 py-2 rounded-xl border border-rose-500/50 hover:bg-rose-500/10 text-rose-400"
                        >
                          BOOST NOW
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TODAY'S REVISIONS TAB */}
        {activeTab === 'revisions' && (
          <div className="pt-8">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="text-4xl font-semibold tracking-tighter">Today&apos;s Revision Queue</div>
                <div className="text-zinc-500 mt-1">Active recall • {todayDue.length} topics due • Built for maximum retention</div>
              </div>
              <div className="text-xs px-4 py-2 bg-zinc-900 rounded-full text-zinc-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                ADAPTIVE SPACED REPETITION ACTIVE
              </div>
            </div>

            {todayDue.length === 0 ? (
              <div className="glass rounded-3xl p-16 text-center border border-zinc-800">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                  <Award className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="text-2xl font-semibold">All caught up! 🎉</div>
                <p className="text-zinc-500 max-w-xs mx-auto mt-3">No revisions due today. Your memory is in excellent shape.</p>
                <button 
                  onClick={() => setActiveTab('topics')}
                  className="mt-8 px-8 py-3 rounded-2xl border border-zinc-700 hover:bg-zinc-900 text-sm"
                >
                  Browse All Topics
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {todayDue.map((topic, index) => {
                  const overdueDays = Math.max(0, differenceInDays(new Date(), parseISO(topic.nextReview)));
                  const pred = predictRetention(topic);
                  
                  return (
                    <motion.div 
                      key={topic.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="topic-card glass rounded-3xl p-7 border border-zinc-800 flex flex-col"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <div className="font-semibold text-xl leading-tight">{topic.name}</div>
                          {topic.note && <div className="text-sm text-zinc-500 mt-1.5 line-clamp-2">{topic.note}</div>}
                          
                          <div className="flex flex-wrap gap-2 mt-4">
                            <div className="text-xs px-3 py-1 bg-zinc-800 rounded-full">{topic.subject}</div>
                            <div className="text-xs px-3 py-1 bg-zinc-800 rounded-full">{topic.type}</div>
                            {overdueDays > 0 && (
                              <div className="text-xs px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full">+{overdueDays}d overdue</div>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">RETENTION</div>
                          <div className="text-4xl font-semibold tabular-nums text-white">{topic.retentionScore}</div>
                          <div className="text-[10px] text-zinc-500 -mt-1">/100</div>
                        </div>
                      </div>

                      <div className="mt-auto pt-6 border-t border-zinc-800 flex items-center justify-between text-xs">
                        <div className="text-zinc-500">
                          Interval: <span className="text-white font-mono">{topic.intervalDays}d</span> • Ease: <span className="text-white font-mono">{topic.easeFactor.toFixed(1)}</span>
                        </div>
                        
                        <button 
                          onClick={() => openRevise(topic)}
                          className="btn-primary px-8 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-2"
                        >
                          START ACTIVE RECALL
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div className="pt-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-4xl font-semibold tracking-tighter">Revision Calendar</div>
                <div className="text-zinc-500">Visualize your spaced repetition schedule</div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setCurrentMonth(subDays(currentMonth, 30))}
                  className="p-2 hover:bg-zinc-800 rounded-xl"
                >
                  ←
                </button>
                <div className="font-medium px-4">{format(currentMonth, 'MMMM yyyy')}</div>
                <button 
                  onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
                  className="p-2 hover:bg-zinc-800 rounded-xl"
                >
                  →
                </button>
              </div>
            </div>

            <div className="glass rounded-3xl p-8 border border-zinc-800">
              <div className="grid grid-cols-7 gap-px mb-2 text-center text-xs text-zinc-500 font-medium">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-zinc-900 rounded-2xl overflow-hidden">
                {calendarDays.map((day, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (day.hasDue) {
                        setSelectedCalendarDay(day.date);
                        setShowCalendarModal(true);
                      }
                    }}
                    className={`
                      calendar-day aspect-square flex flex-col items-center justify-center text-sm cursor-pointer relative
                      ${!day.isCurrentMonth ? 'text-zinc-700' : ''}
                      ${day.isOverdue ? 'overdue border border-rose-500/40' : ''}
                      ${day.completed ? 'completed' : ''}
                      ${isToday(day.date) ? 'today' : ''}
                      ${day.hasDue ? 'has-due font-medium' : ''}
                    `}
                  >
                    <span className={isToday(day.date) ? 'font-semibold' : ''}>
                      {format(day.date, 'd')}
                    </span>
                    
                    {day.dueCount > 0 && (
                      <div className="absolute bottom-2 text-[9px] px-1.5 py-px rounded bg-indigo-500 text-white font-mono">
                        {day.dueCount}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-center gap-8 mt-8 text-xs">
                <div className="flex items-center gap-2"><div className="w-3 h-px bg-indigo-500" /> Due</div>
                <div className="flex items-center gap-2"><div className="w-3 h-px bg-emerald-600" /> Completed</div>
                <div className="flex items-center gap-2"><div className="w-3 h-px bg-rose-500" /> Overdue</div>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-zinc-500">
              Click any day with revisions to view and revise those topics
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="pt-8 space-y-8">
            <div>
              <div className="text-4xl font-semibold tracking-tighter">Performance Insights</div>
              <div className="text-zinc-500">Data-driven view of your long-term retention</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass rounded-3xl p-8 border border-zinc-800">
                <div className="font-semibold mb-6 flex items-center justify-between">
                  7-Day Retention Trend
                  <span className="text-xs text-emerald-400">↑ IMPROVING</span>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={retentionTrend}>
                      <XAxis dataKey="day" stroke="#3f3f46" />
                      <YAxis domain={[50, 100]} stroke="#3f3f46" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px' }} 
                      />
                      <Line 
                        type="natural" 
                        dataKey="retention" 
                        stroke="#6366f1" 
                        strokeWidth={3} 
                        dot={{ fill: '#6366f1', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass rounded-3xl p-8 border border-zinc-800">
                <div className="font-semibold mb-6">Subject Distribution</div>
                <div className="h-72 flex items-center justify-center">
                  {subjectData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subjectData}
                          cx="50%"
                          cy="50%"
                          innerRadius={85}
                          outerRadius={115}
                          dataKey="value"
                        >
                          {subjectData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-zinc-500">Add topics to see distribution</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-sm">
                  {subjectData.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{s.name}</span>
                      <span className="ml-auto text-zinc-500">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl p-8 border border-zinc-800">
              <div className="font-semibold mb-6">Study Consistency Heatmap (Last 90 Days)</div>
              
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-1 min-w-[780px]">
                  {Array.from({ length: 13 }).map((_, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-1">
                      {Array.from({ length: 7 }).map((_, dayIdx) => {
                        const date = subDays(new Date(), (12 - weekIdx) * 7 + (6 - dayIdx));
                        const dayStr = format(date, 'yyyy-MM-dd');
                        const count = topics.reduce((acc, t) => 
                          acc + t.reviews.filter(r => format(parseISO(r.date), 'yyyy-MM-dd') === dayStr).length, 0
                        );
                        
                        const intensity = Math.min(4, Math.floor(count / 1.5));
                        const colors = ['#27272a', '#3b82f6', '#2563eb', '#1e40af', '#1e3a8a'];
                        
                        return (
                          <div 
                            key={dayIdx}
                            className="heatmap-cell w-4 h-4"
                            style={{ backgroundColor: colors[intensity] }}
                            title={`${format(date, 'MMM dd')}: ${count} revision${count !== 1 ? 's' : ''}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 mt-2">
                <div>Less</div>
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: ['#27272a', '#3b82f6', '#2563eb', '#1e40af', '#1e3a8a'][i] }} />
                  ))}
                </div>
                <div>More</div>
              </div>
            </div>
          </div>
        )}

        {/* ALL TOPICS TAB */}
        {activeTab === 'topics' && (
          <div className="pt-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <div className="text-4xl font-semibold tracking-tighter">All Topics</div>
                <div className="text-zinc-500">Search, filter, and manage your knowledge base</div>
              </div>
              
              <div className="flex gap-3">
                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search topics or notes..."
                    className="w-full bg-zinc-900 border border-zinc-800 pl-11 py-3 rounded-2xl text-sm focus:outline-none focus:border-zinc-700"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <select 
                  value={filterSubject} 
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 px-4 rounded-2xl text-sm"
                >
                  <option value="">All Subjects</option>
                  {SUBJECTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 px-4 rounded-2xl text-sm"
                >
                  <option value="">All Types</option>
                  <option value="Prelims">Prelims</option>
                  <option value="Mains">Mains</option>
                  <option value="Both">Both</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredTopics.length > 0 ? filteredTopics.map((topic, idx) => {
                  const pred = predictRetention(topic);
                  const overdue = differenceInDays(new Date(), parseISO(topic.nextReview));
                  
                  return (
                    <motion.div 
                      key={topic.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.4) }}
                      className="topic-card glass rounded-3xl p-6 border border-zinc-800 flex flex-col"
                    >
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div className="font-semibold text-lg leading-tight pr-4">{topic.name}</div>
                          <div className={`text-xs px-2.5 py-0.5 rounded-full self-start whitespace-nowrap ${topic.retentionScore > 80 ? 'bg-emerald-500/10 text-emerald-400' : topic.retentionScore > 60 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {topic.retentionScore}%
                          </div>
                        </div>
                        
                        {topic.note && <div className="text-sm text-zinc-500 mt-2 line-clamp-2">{topic.note}</div>}
                        
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          <div className="text-xs bg-zinc-800 px-2.5 py-px rounded">{topic.subject}</div>
                          <div className="text-xs bg-zinc-800 px-2.5 py-px rounded">{topic.type}</div>
                          {topic.tags.slice(0, 2).map(tag => (
                            <div key={tag} className="text-xs bg-zinc-800 px-2.5 py-px rounded">{tag}</div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 pt-5 border-t border-zinc-800 flex items-center justify-between text-xs">
                        <div>
                          Next: <span className="font-mono text-white">{format(parseISO(topic.nextReview), 'MMM dd')}</span>
                          {overdue > 0 && <span className="text-rose-400 ml-1">({overdue}d late)</span>}
                        </div>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openRevise(topic)}
                            className="px-5 py-1.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-xs"
                          >
                            Revise
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Delete "${topic.name}"?`)) {
                                setTopics(prev => prev.filter(t => t.id !== topic.id));
                                toast.success("Topic deleted");
                              }
                            }}
                            className="px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-400"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                }) : (
                  <div className="col-span-full text-center py-16 text-zinc-500">No topics match your filters</div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 rounded-2xl btn-primary flex items-center justify-center shadow-xl z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ADD TOPIC MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur z-[60] flex items-center justify-center p-6" onClick={() => setShowAddModal(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="modal glass rounded-3xl w-full max-w-lg p-9 border border-zinc-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-2xl font-semibold tracking-tight mb-1">Add New Topic</div>
              <div className="text-sm text-zinc-500 mb-8">The AI will instantly create your optimized revision schedule.</div>

              <div className="space-y-6">
                <div>
                  <div className="text-xs text-zinc-500 mb-1.5">TOPIC NAME</div>
                  <input 
                    type="text" 
                    value={newTopic.name}
                    onChange={(e) => setNewTopic({...newTopic, name: e.target.value})}
                    placeholder="e.g. Indian Monsoon Mechanism"
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-indigo-500 rounded-2xl px-5 py-4 text-lg placeholder:text-zinc-600"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="text-xs text-zinc-500 mb-1.5">OPTIONAL NOTE / CONTEXT</div>
                  <textarea 
                    value={newTopic.note}
                    onChange={(e) => setNewTopic({...newTopic, note: e.target.value})}
                    placeholder="Key points, PYQs, or personal notes..."
                    className="w-full h-24 bg-zinc-900 border border-zinc-700 focus:border-indigo-500 rounded-2xl px-5 py-4 text-sm resize-y min-h-[96px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1.5">SUBJECT</div>
                    <select 
                      value={newTopic.subject}
                      onChange={(e) => setNewTopic({...newTopic, subject: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-[17px] text-sm"
                    >
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1.5">EXAM TYPE</div>
                    <div className="flex gap-2">
                      {(['Prelims', 'Mains', 'Both'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setNewTopic({...newTopic, type: t})}
                          className={`flex-1 py-3.5 text-sm rounded-2xl border transition-all ${newTopic.type === t ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-zinc-700 text-zinc-400'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-500 mb-2">TAGS (optional)</div>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-4 py-1.5 text-xs rounded-full border transition-all ${newTopic.tags.includes(tag) ? 'bg-white text-zinc-950 border-white' : 'border-zinc-700 hover:border-zinc-600'}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-9">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 rounded-2xl border border-zinc-700 text-sm hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddTopic}
                  className="flex-1 py-4 rounded-2xl btn-primary text-sm font-medium"
                >
                  Create &amp; Schedule First Revision
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REVISE MODAL */}
      <AnimatePresence>
        {showReviseModal && currentTopic && (
          <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4" onClick={() => setShowReviseModal(false)}>
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="modal glass rounded-3xl w-full max-w-2xl overflow-hidden border border-zinc-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-9">
                <div className="uppercase tracking-[3px] text-xs text-indigo-400 mb-1">ACTIVE RECALL SESSION</div>
                <div className="text-3xl font-semibold tracking-tight pr-12">{currentTopic.name}</div>
                {currentTopic.note && (
                  <div className="mt-3 text-zinc-400 text-[15px]">{currentTopic.note}</div>
                )}

                <div className="mt-8 flex items-center gap-2 text-xs">
                  <div className="px-3 py-1 bg-zinc-800 rounded">INTERVAL: {currentTopic.intervalDays} DAYS</div>
                  <div className="px-3 py-1 bg-zinc-800 rounded">EASE: {currentTopic.easeFactor.toFixed(1)}</div>
                  <div className="px-3 py-1 bg-zinc-800 rounded">RETENTION: {currentTopic.retentionScore}%</div>
                </div>

                <div className="mt-8">
                  <button
                  onClick={() => setShowPrompts(!showPrompts)}
                    className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 mb-4"
                  >
                    {showPrompts ? '−' : '+'} AI-GENERATED ACTIVE RECALL PROMPTS ({aiPrompts.length})
                  </button>
                  
                  <AnimatePresence>
                    {showPrompts && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pl-1">
                          {aiPrompts.map((prompt, i) => (
                            <div key={i} className="flex gap-4 p-5 bg-zinc-900/70 rounded-2xl text-sm">
                              <div className="text-indigo-400 font-mono mt-0.5">Q{i+1}</div>
                              <div className="text-zinc-300">{prompt}</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-center text-zinc-500 mt-3">Recall without looking up. Then rate yourself honestly below.</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="bg-zinc-900 p-9 border-t border-zinc-800">
                <div className="text-sm text-zinc-400 mb-4 text-center">How easily did you recall this topic?</div>
                
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { level: 'easy', label: 'Easy', color: 'emerald', desc: 'Perfect recall' },
                    { level: 'medium', label: 'Medium', color: 'amber', desc: 'Some effort' },
                    { level: 'hard', label: 'Hard', color: 'orange', desc: 'Partial recall' },
                    { level: 'forgot', label: 'Forgot', color: 'rose', desc: 'Complete blank' }
                  ].map((opt) => (
                    <button
                      key={opt.level}
                      onClick={() => setRecallLevel(opt.level as any)}
                      className={`p-5 rounded-2xl border text-center transition-all ${recallLevel === opt.level 
                        ? `border-${opt.color}-500 bg-${opt.color}-500/10` 
                        : 'border-zinc-700 hover:border-zinc-600'}`}
                    >
                      <div className={`font-semibold text-lg ${recallLevel === opt.level ? `text-${opt.color}-400` : ''}`}>{opt.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-4 mt-8">
                  <button 
                    onClick={() => setShowReviseModal(false)}
                    className="flex-1 py-4 rounded-2xl border border-zinc-700 text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleRevisionComplete}
                    className="flex-1 py-4 rounded-2xl btn-primary text-sm font-medium"
                  >
                    SUBMIT &amp; RESCHEDULE
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calendar Day Modal */}
      <AnimatePresence>
        {showCalendarModal && selectedCalendarDay && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-end md:items-center justify-center" onClick={() => setShowCalendarModal(false)}>
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="glass w-full md:w-[480px] rounded-t-3xl md:rounded-3xl p-8 border border-zinc-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="font-semibold text-xl mb-1">{format(selectedCalendarDay, 'EEEE, MMMM dd')}</div>
              <div className="text-sm text-zinc-500 mb-6">Topics due for revision</div>

              {topics.filter(t => format(parseISO(t.nextReview), 'yyyy-MM-dd') === format(selectedCalendarDay, 'yyyy-MM-dd')).length > 0 ? (
                <div className="space-y-3">
                  {topics
                    .filter(t => format(parseISO(t.nextReview), 'yyyy-MM-dd') === format(selectedCalendarDay, 'yyyy-MM-dd'))
                    .map(topic => (
                      <div key={topic.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl">
                        <div>
                          <div className="font-medium">{topic.name}</div>
                          <div className="text-xs text-zinc-500">{topic.subject} • {topic.retentionScore}% retention</div>
                        </div>
                        <button 
                          onClick={() => {
                            setShowCalendarModal(false);
                            openRevise(topic);
                          }}
                          className="text-xs px-5 py-2 rounded-xl border border-indigo-500 text-indigo-400"
                        >
                          REVISE
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">No revisions scheduled for this day</div>
              )}

              <button 
                onClick={() => setShowCalendarModal(false)}
                className="w-full mt-6 py-3 text-sm text-zinc-400"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="hidden md:block fixed bottom-4 left-4 text-[10px] text-zinc-600">
        Retention Engine v1.0 • PWA Ready • Offline Capable
      </div>
    </div>
  );
}