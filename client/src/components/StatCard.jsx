
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const StatCard = ({ label, value, subtext, trend, icon, color, iconColor }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 transition-transform hover:scale-[1.02] duration-300">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${color} bg-opacity-10 shadow-inner`}>
                    <div className={iconColor || 'text-slate-600'}>
                        {icon}
                    </div>
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${trend === 'up' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' :
                            trend === 'down' ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' :
                                'text-amber-600 bg-amber-50 dark:bg-amber-500/10'
                        }`}>
                        {trend === 'up' ? <ArrowUpRight size={14} /> : trend === 'down' ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                        {trend === 'up' ? '+12%' : trend === 'down' ? '-4%' : 'Stable'}
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">{label}</h3>
                <div className="text-3xl font-extrabold tracking-tight mb-1 text-slate-900 dark:text-white">{value}</div>
                <p className="text-xs text-slate-400">{subtext}</p>
            </div>
        </div>
    );
};

export default StatCard;
