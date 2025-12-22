'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Plus,
  X,
  Calendar,
  TrendingUp,
  Users,
  Award,
  Settings,
  Megaphone,
  Shield,
  Edit3,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Pause,
  XCircle,
  BarChart3,
  Search,
  Filter,
  LayoutGrid,
  List,
  Table2,
  Sparkles,
  Flag,
  Hash,
  ArrowUpRight,
  Zap,
  Sun,
  Coffee,
} from 'lucide-react';
import {
  StrategicGoal,
  GoalCategory,
  GoalMilestone,
  GoalStatus,
  GoalPriority,
  GOAL_STATUS_CONFIG,
  GOAL_PRIORITY_CONFIG,
} from '@/types/todo';

interface StrategicDashboardProps {
  userName: string;
  darkMode?: boolean;
  onClose: () => void;
}

type ViewMode = 'list' | 'board' | 'table';

const categoryIcons: Record<string, React.ReactNode> = {
  'trending-up': <TrendingUp className="w-4 h-4" />,
  'users': <Users className="w-4 h-4" />,
  'award': <Award className="w-4 h-4" />,
  'settings': <Settings className="w-4 h-4" />,
  'megaphone': <Megaphone className="w-4 h-4" />,
  'shield': <Shield className="w-4 h-4" />,
  'target': <Target className="w-4 h-4" />,
};

const statusIcons: Record<GoalStatus, React.ReactNode> = {
  not_started: <Circle className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4" />,
  on_hold: <Pause className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: <Coffee className="w-5 h-5" /> };
  if (hour < 17) return { text: 'Good afternoon', icon: <Sun className="w-5 h-5" /> };
  return { text: 'Good evening', icon: <Sparkles className="w-5 h-5" /> };
}

export default function StrategicDashboard({
  userName,
  darkMode = true,
  onClose,
}: StrategicDashboardProps) {
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [goals, setGoals] = useState<StrategicGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('all');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<StrategicGoal | null>(null);
  const [hoveredGoal, setHoveredGoal] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    priority: 'medium' as GoalPriority,
    target_date: '',
    target_value: '',
    category_id: '',
  });

  const greeting = getGreeting();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesRes, goalsRes] = await Promise.all([
        fetch(`/api/goals/categories?userName=${encodeURIComponent(userName)}`),
        fetch(`/api/goals?userName=${encodeURIComponent(userName)}`),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      if (goalsRes.ok) {
        const goalsData = await goalsRes.json();
        setGoals(goalsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [userName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      const matchesSearch = !searchQuery ||
        goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        goal.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || goal.category_id === selectedCategory;
      const matchesStatus = statusFilter === 'all' || goal.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [goals, searchQuery, selectedCategory, statusFilter]);

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter(g => g.status === 'completed').length;
    const inProgress = goals.filter(g => g.status === 'in_progress').length;
    const overdue = goals.filter(g => {
      if (!g.target_date || g.status === 'completed') return false;
      return new Date(g.target_date) < new Date();
    }).length;
    return { total, completed, inProgress, overdue };
  }, [goals]);

  const goalsByStatus = useMemo(() => {
    const grouped: Record<GoalStatus, StrategicGoal[]> = {
      not_started: [],
      in_progress: [],
      on_hold: [],
      completed: [],
      cancelled: [],
    };
    filteredGoals.forEach(goal => {
      grouped[goal.status].push(goal);
    });
    return grouped;
  }, [filteredGoals]);

  const handleCreateGoal = async () => {
    if (!newGoal.title.trim()) return;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newGoal,
          category_id: newGoal.category_id || selectedCategory || null,
          created_by: userName,
        }),
      });

      if (res.ok) {
        const goal = await res.json();
        setGoals(prev => [...prev, goal]);
        setNewGoal({
          title: '',
          description: '',
          priority: 'medium',
          target_date: '',
          target_value: '',
          category_id: '',
        });
        setShowAddGoal(false);
      }
    } catch (error) {
      console.error('Error creating goal:', error);
    }
  };

  const handleUpdateGoal = async (goalId: string, updates: Partial<StrategicGoal>) => {
    try {
      const res = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: goalId,
          ...updates,
          updated_by: userName,
        }),
      });

      if (res.ok) {
        const updatedGoal = await res.json();
        setGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));
        setEditingGoal(null);
      }
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const res = await fetch(`/api/goals?id=${goalId}&userName=${encodeURIComponent(userName)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setGoals(prev => prev.filter(g => g.id !== goalId));
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleToggleMilestone = async (milestone: GoalMilestone) => {
    try {
      const res = await fetch('/api/goals/milestones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: milestone.id,
          completed: !milestone.completed,
          userName,
        }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling milestone:', error);
    }
  };

  const handleAddMilestone = async (goalId: string, title: string) => {
    try {
      const res = await fetch('/api/goals/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_id: goalId,
          title,
          userName,
        }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error adding milestone:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-8 rounded-2xl ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-[#0033A0]/20 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-[#0033A0] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Loading your goals...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={`w-full h-full max-w-6xl max-h-[95vh] my-4 mx-4 rounded-2xl shadow-2xl overflow-hidden flex ${
          darkMode ? 'bg-slate-900' : 'bg-white'
        }`}
      >
        {/* Sidebar */}
        <div className={`w-64 flex-shrink-0 border-r flex flex-col ${
          darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`p-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#0033A0] to-[#0033A0]/70 shadow-lg shadow-[#0033A0]/20">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Goals
                </h2>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Strategic Planning
                </p>
              </div>
            </div>
          </div>

          <div className={`p-3 mx-3 mt-3 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-white border border-slate-200'}`}>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2">
                <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  {stats.total}
                </p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Total</p>
              </div>
              <div className="text-center p-2">
                <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Done</p>
              </div>
              <div className="text-center p-2">
                <p className="text-2xl font-bold text-[#0033A0]">{stats.inProgress}</p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Active</p>
              </div>
              <div className="text-center p-2">
                <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-500' : darkMode ? 'text-slate-600' : 'text-slate-300'}`}>
                  {stats.overdue}
                </p>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Overdue</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-2">
              <p className={`text-xs font-medium uppercase tracking-wider px-2 mb-2 ${
                darkMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Views
              </p>
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  !selectedCategory
                    ? darkMode
                      ? 'bg-slate-800 text-white'
                      : 'bg-[#0033A0]/10 text-[#0033A0]'
                    : darkMode
                      ? 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>All Goals</span>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                  darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                }`}>
                  {goals.length}
                </span>
              </button>
            </div>

            <div className="mb-2">
              <p className={`text-xs font-medium uppercase tracking-wider px-2 mb-2 ${
                darkMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Categories
              </p>
              <div className="space-y-1">
                {categories.map(category => {
                  const count = goals.filter(g => g.category_id === category.id).length;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        selectedCategory === category.id
                          ? darkMode
                            ? 'bg-slate-800 text-white'
                            : 'bg-[#0033A0]/10 text-[#0033A0]'
                          : darkMode
                            ? 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span style={{ color: category.color }}>
                        {categoryIcons[category.icon] || <Hash className="w-4 h-4" />}
                      </span>
                      <span className="truncate">{category.name}</span>
                      <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                        darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className={`text-xs font-medium uppercase tracking-wider px-2 mb-2 ${
                darkMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Status
              </p>
              <div className="space-y-1">
                {(['all', ...Object.keys(GOAL_STATUS_CONFIG)] as (GoalStatus | 'all')[]).map(status => {
                  const config = status === 'all' ? null : GOAL_STATUS_CONFIG[status];
                  const count = status === 'all'
                    ? goals.length
                    : goals.filter(g => g.status === status).length;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        statusFilter === status
                          ? darkMode
                            ? 'bg-slate-800 text-white'
                            : 'bg-[#0033A0]/10 text-[#0033A0]'
                          : darkMode
                            ? 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {status === 'all' ? (
                        <Filter className="w-4 h-4" />
                      ) : (
                        <span style={{ color: config?.color }}>{statusIcons[status]}</span>
                      )}
                      <span className="truncate">
                        {status === 'all' ? 'All Statuses' : config?.label}
                      </span>
                      {count > 0 && (
                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                          darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`p-3 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              onClick={() => setShowAddGoal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0033A0] text-white text-sm font-medium rounded-xl hover:bg-[#002878] transition-all shadow-lg shadow-[#0033A0]/20"
            >
              <Plus className="w-4 h-4" />
              New Goal
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`px-6 py-4 border-b flex-shrink-0 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`${darkMode ? 'text-[#D4A853]' : 'text-[#0033A0]'}`}>
                  {greeting.icon}
                </span>
                <div>
                  <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                    {greeting.text}, {userName}
                  </h1>
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {selectedCategory
                      ? categories.find(c => c.id === selectedCategory)?.name
                      : 'All your strategic goals'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  darkMode ? 'text-slate-500' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search goals..."
                  className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-slate-100 border-slate-200 text-slate-800 placeholder-slate-400'
                  } border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                />
              </div>

              <div className={`flex items-center rounded-lg p-1 ${
                darkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                {[
                  { mode: 'list' as ViewMode, icon: List, label: 'List' },
                  { mode: 'board' as ViewMode, icon: LayoutGrid, label: 'Board' },
                  { mode: 'table' as ViewMode, icon: Table2, label: 'Table' },
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                      viewMode === mode
                        ? darkMode
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-slate-800 shadow-sm'
                        : darkMode
                          ? 'text-slate-400 hover:text-white'
                          : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {filteredGoals.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className={`p-4 rounded-2xl mb-4 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Target className={`w-12 h-12 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                </div>
                <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  {searchQuery ? 'No goals found' : 'No goals yet'}
                </h3>
                <p className={`text-sm mb-4 max-w-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'Start planning your strategic objectives by creating your first goal'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowAddGoal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0033A0] text-white text-sm font-medium rounded-lg hover:bg-[#002878] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first goal
                  </button>
                )}
              </div>
            ) : viewMode === 'list' ? (
              <ListView
                goals={filteredGoals}
                categories={categories}
                darkMode={darkMode}
                hoveredGoal={hoveredGoal}
                setHoveredGoal={setHoveredGoal}
                onEdit={setEditingGoal}
                onDelete={handleDeleteGoal}
                onStatusChange={(id, status) => handleUpdateGoal(id, { status })}
              />
            ) : viewMode === 'board' ? (
              <BoardView
                goalsByStatus={goalsByStatus}
                categories={categories}
                darkMode={darkMode}
                onEdit={setEditingGoal}
                onStatusChange={(id, status) => handleUpdateGoal(id, { status })}
              />
            ) : (
              <TableView
                goals={filteredGoals}
                categories={categories}
                darkMode={darkMode}
                onEdit={setEditingGoal}
                onStatusChange={(id, status) => handleUpdateGoal(id, { status })}
              />
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAddGoal && (
          <AddGoalModal
            categories={categories}
            darkMode={darkMode}
            newGoal={newGoal}
            setNewGoal={setNewGoal}
            onClose={() => {
              setShowAddGoal(false);
              setNewGoal({
                title: '',
                description: '',
                priority: 'medium',
                target_date: '',
                target_value: '',
                category_id: '',
              });
            }}
            onCreate={handleCreateGoal}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingGoal && (
          <EditGoalModal
            goal={editingGoal}
            categories={categories}
            darkMode={darkMode}
            onClose={() => setEditingGoal(null)}
            onSave={(updates) => handleUpdateGoal(editingGoal.id, updates)}
            onToggleMilestone={handleToggleMilestone}
            onAddMilestone={handleAddMilestone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// List View
interface ListViewProps {
  goals: StrategicGoal[];
  categories: GoalCategory[];
  darkMode: boolean;
  hoveredGoal: string | null;
  setHoveredGoal: (id: string | null) => void;
  onEdit: (goal: StrategicGoal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
}

function ListView({
  goals,
  categories,
  darkMode,
  hoveredGoal,
  setHoveredGoal,
  onEdit,
  onDelete,
  onStatusChange,
}: ListViewProps) {
  return (
    <div className="space-y-2">
      {goals.map(goal => {
        const category = categories.find(c => c.id === goal.category_id);
        const statusConfig = GOAL_STATUS_CONFIG[goal.status];
        const priorityConfig = GOAL_PRIORITY_CONFIG[goal.priority];
        const isHovered = hoveredGoal === goal.id;

        return (
          <motion.div
            key={goal.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onMouseEnter={() => setHoveredGoal(goal.id)}
            onMouseLeave={() => setHoveredGoal(null)}
            className={`group relative rounded-xl border transition-all ${
              darkMode
                ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
          >
            <div className="p-4">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => {
                    const statuses: GoalStatus[] = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];
                    const currentIndex = statuses.indexOf(goal.status);
                    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                    onStatusChange(goal.id, nextStatus);
                  }}
                  className="p-2 rounded-lg transition-all hover:scale-110"
                  style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                  title={`Status: ${statusConfig.label}`}
                >
                  {statusIcons[goal.status]}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className={`font-medium ${
                        goal.status === 'completed'
                          ? 'line-through opacity-60'
                          : darkMode ? 'text-white' : 'text-slate-800'
                      }`}>
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className={`text-sm mt-1 line-clamp-2 ${
                          darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {goal.description}
                        </p>
                      )}
                    </div>

                    <div className={`flex items-center gap-1 transition-opacity ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <button
                        onClick={() => onEdit(goal)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          darkMode
                            ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                            : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(goal.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          darkMode
                            ? 'hover:bg-red-900/30 text-slate-400 hover:text-red-400'
                            : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {category && (
                      <span
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                        style={{ backgroundColor: category.color + '15', color: category.color }}
                      >
                        {categoryIcons[category.icon] || <Hash className="w-3 h-3" />}
                        {category.name}
                      </span>
                    )}

                    <span
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                      style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
                    >
                      <Flag className="w-3 h-3" />
                      {priorityConfig.label}
                    </span>

                    {goal.target_date && (
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        new Date(goal.target_date) < new Date() && goal.status !== 'completed'
                          ? 'bg-red-500/10 text-red-500'
                          : darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}

                    {goal.target_value && (
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        darkMode ? 'bg-[#D4A853]/10 text-[#D4A853]' : 'bg-[#0033A0]/10 text-[#0033A0]'
                      }`}>
                        <ArrowUpRight className="w-3 h-3" />
                        {goal.target_value}
                      </span>
                    )}

                    {goal.progress_percent > 0 && (
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <BarChart3 className="w-3 h-3" />
                        {goal.progress_percent}%
                      </span>
                    )}

                    {goal.milestones && goal.milestones.length > 0 && (
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {goal.milestones.filter(m => m.completed).length}/{goal.milestones.length}
                      </span>
                    )}
                  </div>

                  {goal.progress_percent > 0 && (
                    <div className="mt-3">
                      <div className={`h-1.5 rounded-full overflow-hidden ${
                        darkMode ? 'bg-slate-700' : 'bg-slate-200'
                      }`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${goal.progress_percent}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-[#0033A0] to-[#D4A853]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Board View
interface BoardViewProps {
  goalsByStatus: Record<GoalStatus, StrategicGoal[]>;
  categories: GoalCategory[];
  darkMode: boolean;
  onEdit: (goal: StrategicGoal) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
}

function BoardView({ goalsByStatus, categories, darkMode, onEdit }: BoardViewProps) {
  const visibleStatuses: GoalStatus[] = ['not_started', 'in_progress', 'completed'];

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {visibleStatuses.map(status => {
        const config = GOAL_STATUS_CONFIG[status];
        const goals = goalsByStatus[status];

        return (
          <div
            key={status}
            className={`flex-shrink-0 w-80 flex flex-col rounded-xl ${
              darkMode ? 'bg-slate-800/30' : 'bg-slate-50'
            }`}
          >
            <div className={`p-3 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <span style={{ color: config.color }}>{statusIcons[status]}</span>
                <h3 className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  {config.label}
                </h3>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                }`}>
                  {goals.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {goals.map(goal => {
                const category = categories.find(c => c.id === goal.category_id);
                const priorityConfig = GOAL_PRIORITY_CONFIG[goal.priority];

                return (
                  <motion.div
                    key={goal.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`group p-3 rounded-lg border cursor-pointer transition-all ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                    onClick={() => onEdit(goal)}
                  >
                    <h4 className={`font-medium text-sm mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                      {goal.title}
                    </h4>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {category && (
                        <span
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: category.color + '15', color: category.color }}
                        >
                          {category.name}
                        </span>
                      )}
                      <span
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
                      >
                        {priorityConfig.label}
                      </span>
                      {goal.target_date && (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {goal.progress_percent > 0 && (
                      <div className="mt-2">
                        <div className={`h-1 rounded-full overflow-hidden ${
                          darkMode ? 'bg-slate-700' : 'bg-slate-200'
                        }`}>
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#0033A0] to-[#D4A853]"
                            style={{ width: `${goal.progress_percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Table View
interface TableViewProps {
  goals: StrategicGoal[];
  categories: GoalCategory[];
  darkMode: boolean;
  onEdit: (goal: StrategicGoal) => void;
  onStatusChange: (id: string, status: GoalStatus) => void;
}

function TableView({ goals, categories, darkMode, onEdit, onStatusChange }: TableViewProps) {
  return (
    <div className={`rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      <table className="w-full">
        <thead>
          <tr className={darkMode ? 'bg-slate-800' : 'bg-slate-50'}>
            <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>Goal</th>
            <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>Status</th>
            <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>Category</th>
            <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>Priority</th>
            <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>Due Date</th>
            <th className={`text-left px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>Progress</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
          {goals.map(goal => {
            const category = categories.find(c => c.id === goal.category_id);
            const statusConfig = GOAL_STATUS_CONFIG[goal.status];
            const priorityConfig = GOAL_PRIORITY_CONFIG[goal.priority];

            return (
              <tr
                key={goal.id}
                className={`cursor-pointer transition-colors ${
                  darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                }`}
                onClick={() => onEdit(goal)}
              >
                <td className="px-4 py-3">
                  <span className={`font-medium ${
                    goal.status === 'completed' ? 'line-through opacity-60' : darkMode ? 'text-white' : 'text-slate-800'
                  }`}>{goal.title}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const statuses: GoalStatus[] = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];
                      const currentIndex = statuses.indexOf(goal.status);
                      const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                      onStatusChange(goal.id, nextStatus);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105"
                    style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                  >
                    {statusIcons[goal.status]}
                    {statusConfig.label}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {category ? (
                    <span className="px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: category.color + '15', color: category.color }}>
                      {category.name}
                    </span>
                  ) : <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}>
                    {priorityConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {goal.target_date ? (
                    <span className={`text-sm ${
                      new Date(goal.target_date) < new Date() && goal.status !== 'completed'
                        ? 'text-red-500' : darkMode ? 'text-slate-300' : 'text-slate-600'
                    }`}>
                      {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  ) : <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-16 h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-[#0033A0] to-[#D4A853]" style={{ width: `${goal.progress_percent}%` }} />
                    </div>
                    <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{goal.progress_percent}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Add Goal Modal
interface AddGoalModalProps {
  categories: GoalCategory[];
  darkMode: boolean;
  newGoal: { title: string; description: string; priority: GoalPriority; target_date: string; target_value: string; category_id: string };
  setNewGoal: React.Dispatch<React.SetStateAction<{ title: string; description: string; priority: GoalPriority; target_date: string; target_value: string; category_id: string }>>;
  onClose: () => void;
  onCreate: () => void;
}

function AddGoalModal({ categories, darkMode, newGoal, setNewGoal, onClose, onCreate }: AddGoalModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
      >
        <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#0033A0] to-[#0033A0]/70">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>New Goal</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <input
            type="text"
            value={newGoal.title}
            onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
            placeholder="What's your goal?"
            className={`w-full px-4 py-3 rounded-xl text-lg font-medium ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
            } border-2 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30 focus:border-[#0033A0]`}
            autoFocus
          />

          <textarea
            value={newGoal.description}
            onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add a description..."
            rows={3}
            className={`w-full px-4 py-3 rounded-xl text-sm resize-none ${
              darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
            } border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
              <select
                value={newGoal.category_id}
                onChange={(e) => setNewGoal(prev => ({ ...prev, category_id: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                <option value="">No Category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Priority</label>
              <select
                value={newGoal.priority}
                onChange={(e) => setNewGoal(prev => ({ ...prev, priority: e.target.value as GoalPriority }))}
                className={`w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                {(Object.keys(GOAL_PRIORITY_CONFIG) as GoalPriority[]).map(priority => (
                  <option key={priority} value={priority}>{GOAL_PRIORITY_CONFIG[priority].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Date</label>
              <input
                type="date"
                value={newGoal.target_date}
                onChange={(e) => setNewGoal(prev => ({ ...prev, target_date: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Value</label>
              <input
                type="text"
                value={newGoal.target_value}
                onChange={(e) => setNewGoal(prev => ({ ...prev, target_value: e.target.value }))}
                placeholder="e.g., $1M revenue"
                className={`w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              />
            </div>
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}>
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={!newGoal.title.trim()}
            className="px-4 py-2 bg-[#0033A0] text-white text-sm font-medium rounded-lg hover:bg-[#002878] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#0033A0]/20"
          >
            Create Goal
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Edit Goal Modal
interface EditGoalModalProps {
  goal: StrategicGoal;
  categories: GoalCategory[];
  darkMode: boolean;
  onClose: () => void;
  onSave: (updates: Partial<StrategicGoal>) => void;
  onToggleMilestone: (milestone: GoalMilestone) => void;
  onAddMilestone: (goalId: string, title: string) => void;
}

function EditGoalModal({ goal, categories, darkMode, onClose, onSave, onToggleMilestone, onAddMilestone }: EditGoalModalProps) {
  const [formData, setFormData] = useState({
    title: goal.title,
    description: goal.description || '',
    category_id: goal.category_id || '',
    status: goal.status,
    priority: goal.priority,
    target_date: goal.target_date?.split('T')[0] || '',
    target_value: goal.target_value || '',
    current_value: goal.current_value || '',
    notes: goal.notes || '',
  });
  const [newMilestone, setNewMilestone] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'milestones'>('details');

  const milestones = goal.milestones || [];
  const completedMilestones = milestones.filter(m => m.completed).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
      >
        <div className={`px-6 py-4 border-b flex-shrink-0 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="p-2 rounded-lg transition-all hover:scale-110"
                style={{ backgroundColor: GOAL_STATUS_CONFIG[formData.status].bgColor, color: GOAL_STATUS_CONFIG[formData.status].color }}
              >
                {statusIcons[formData.status]}
              </button>
              <div>
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Edit Goal</h2>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Last updated {new Date(goal.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 mt-4">
            {[
              { id: 'details' as const, label: 'Details' },
              { id: 'milestones' as const, label: `Milestones (${completedMilestones}/${milestones.length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? darkMode ? 'bg-slate-800 text-white' : 'bg-[#0033A0]/10 text-[#0033A0]'
                    : darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' ? (
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl text-lg font-medium ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl text-sm resize-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  >
                    <option value="">No Category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as GoalStatus }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  >
                    {(Object.keys(GOAL_STATUS_CONFIG) as GoalStatus[]).map(status => (
                      <option key={status} value={status}>{GOAL_STATUS_CONFIG[status].label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as GoalPriority }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  >
                    {(Object.keys(GOAL_PRIORITY_CONFIG) as GoalPriority[]).map(priority => (
                      <option key={priority} value={priority}>{GOAL_PRIORITY_CONFIG[priority].label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Date</label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                    className={`w-full px-3 py-2.5 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Target Value</label>
                  <input
                    type="text"
                    value={formData.target_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
                    placeholder="e.g., $1M revenue"
                    className={`w-full px-3 py-2.5 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Current Value</label>
                  <input
                    type="text"
                    value={formData.current_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, current_value: e.target.value }))}
                    placeholder="e.g., $500K"
                    className={`w-full px-3 py-2.5 rounded-lg text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Additional notes..."
                  className={`w-full px-4 py-3 rounded-xl text-sm resize-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                />
              </div>
            </div>
          ) : (
            <div className="p-6">
              {milestones.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-800'}`}>Progress</span>
                    <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {completedMilestones} of {milestones.length} complete
                    </span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-[#0033A0] to-[#D4A853]"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {milestones.map(milestone => (
                  <motion.div
                    key={milestone.id}
                    layout
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${darkMode ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <button
                      onClick={() => onToggleMilestone(milestone)}
                      className={`flex-shrink-0 transition-all ${
                        milestone.completed ? 'text-green-500 hover:text-green-400' : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {milestone.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <span className={`flex-1 text-sm ${milestone.completed ? 'line-through opacity-60' : darkMode ? 'text-white' : 'text-slate-800'}`}>
                      {milestone.title}
                    </span>
                  </motion.div>
                ))}

                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="text"
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newMilestone.trim()) {
                        onAddMilestone(goal.id, newMilestone.trim());
                        setNewMilestone('');
                      }
                    }}
                    placeholder="Add a milestone..."
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  />
                  <button
                    onClick={() => {
                      if (newMilestone.trim()) {
                        onAddMilestone(goal.id, newMilestone.trim());
                        setNewMilestone('');
                      }
                    }}
                    disabled={!newMilestone.trim()}
                    className="p-2.5 bg-[#0033A0] text-white rounded-xl hover:bg-[#002878] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 flex-shrink-0 ${darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}>
            Cancel
          </button>
          <button
            onClick={() => {
              onSave({
                title: formData.title,
                description: formData.description || null,
                category_id: formData.category_id || null,
                status: formData.status,
                priority: formData.priority,
                target_date: formData.target_date || null,
                target_value: formData.target_value || null,
                current_value: formData.current_value || null,
                notes: formData.notes || null,
              } as Partial<StrategicGoal>);
            }}
            className="px-4 py-2 bg-[#0033A0] text-white text-sm font-medium rounded-lg hover:bg-[#002878] transition-all shadow-lg shadow-[#0033A0]/20"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}
