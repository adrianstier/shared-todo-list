'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { Todo } from '@/types/todo';

interface WeeklyProgressChartProps {
  todos: Todo[];
  darkMode?: boolean;
  show: boolean;
  onClose: () => void;
}

interface DayData {
  day: string;
  shortDay: string;
  date: Date;
  completed: number;
  created: number;
}

export default function WeeklyProgressChart({
  todos,
  darkMode = true,
  show,
  onClose,
}: WeeklyProgressChartProps) {
  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: DayData[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Count tasks completed on this day (based on updated_at if completed)
      const completed = todos.filter(t => {
        if (!t.completed) return false;
        const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
        return updatedAt >= dayStart && updatedAt <= dayEnd;
      }).length;

      // Count tasks created on this day
      const created = todos.filter(t => {
        const createdAt = new Date(t.created_at);
        return createdAt >= dayStart && createdAt <= dayEnd;
      }).length;

      days.push({
        day: dayNames[date.getDay()],
        shortDay: dayNames[date.getDay()].charAt(0),
        date,
        completed,
        created,
      });
    }

    return days;
  }, [todos]);

  const stats = useMemo(() => {
    const totalCompleted = weekData.reduce((sum, d) => sum + d.completed, 0);
    const totalCreated = weekData.reduce((sum, d) => sum + d.created, 0);
    const maxCompleted = Math.max(...weekData.map(d => d.completed), 1);

    // Calculate trend (compare last 3 days to previous 4)
    const recentCompleted = weekData.slice(-3).reduce((sum, d) => sum + d.completed, 0);
    const earlierCompleted = weekData.slice(0, 4).reduce((sum, d) => sum + d.completed, 0);
    const avgRecent = recentCompleted / 3;
    const avgEarlier = earlierCompleted / 4;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (avgRecent > avgEarlier * 1.2) trend = 'up';
    else if (avgRecent < avgEarlier * 0.8) trend = 'down';

    const completionRate = totalCreated > 0
      ? Math.round((totalCompleted / totalCreated) * 100)
      : 0;

    return {
      totalCompleted,
      totalCreated,
      maxCompleted,
      trend,
      completionRate,
      avgPerDay: (totalCompleted / 7).toFixed(1),
    };
  }, [weekData]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          darkMode ? 'bg-slate-800' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            Weekly Progress
          </h3>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#0033A0]">{stats.totalCompleted}</p>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Completed</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              {stats.avgPerDay}
            </p>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Avg/Day</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <p className={`text-2xl font-bold ${
                stats.trend === 'up' ? 'text-emerald-500' :
                stats.trend === 'down' ? 'text-red-500' :
                darkMode ? 'text-white' : 'text-slate-800'
              }`}>
                {stats.completionRate}%
              </p>
              {stats.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
              {stats.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
              {stats.trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
            </div>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rate</p>
          </div>
        </div>

        {/* Chart */}
        <div className="p-4">
          <div className="flex items-end justify-between gap-2 h-32 mb-2">
            {weekData.map((day, index) => {
              const height = stats.maxCompleted > 0
                ? (day.completed / stats.maxCompleted) * 100
                : 0;
              const isToday = index === weekData.length - 1;

              return (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                  {/* Bar */}
                  <div className="w-full flex-1 flex flex-col justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 4)}%` }}
                      transition={{ delay: index * 0.05, duration: 0.4, ease: 'easeOut' }}
                      className={`w-full rounded-t-md ${
                        isToday
                          ? 'bg-[#0033A0]'
                          : day.completed > 0
                            ? 'bg-[#0033A0]/50'
                            : darkMode ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                  </div>

                  {/* Count label */}
                  <span className={`text-xs font-medium ${
                    day.completed > 0
                      ? 'text-[#0033A0]'
                      : darkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {day.completed}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day labels */}
          <div className="flex justify-between">
            {weekData.map((day, index) => {
              const isToday = index === weekData.length - 1;
              return (
                <div key={day.day} className="flex-1 text-center">
                  <span className={`text-xs font-medium ${
                    isToday
                      ? 'text-[#0033A0]'
                      : darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {day.shortDay}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer tip */}
        <div className={`px-4 py-3 text-center text-xs ${
          darkMode ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-50 text-slate-500'
        }`}>
          {stats.trend === 'up' && "Great job! You're completing more tasks than last week."}
          {stats.trend === 'down' && "Keep going! Consistency is key."}
          {stats.trend === 'stable' && "You're maintaining a steady pace!"}
        </div>
      </motion.div>
    </motion.div>
  );
}
