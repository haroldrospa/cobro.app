import React from 'react';
import { motion } from 'framer-motion';
import { Home, Search, ShoppingBag, User } from 'lucide-react';

export type TabId = 'home' | 'search' | 'cart' | 'profile';

interface MobileDockProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  cartItemCount: number;
}

export const MobileDock: React.FC<MobileDockProps> = ({ activeTab, setActiveTab, cartItemCount }) => {
  const tabs = [
    { id: 'profile' as TabId, icon: User },
    { id: 'home' as TabId, icon: Home },
    { id: 'cart' as TabId, icon: ShoppingBag, badge: cartItemCount },
    { id: 'search' as TabId, icon: Search },
  ];

  return (
    <div className="fixed bottom-6 left-6 right-6 md:hidden z-50">
      <div className="bg-[#1c1c1e]/90 backdrop-blur-2xl rounded-full px-2 py-1.5 flex items-center justify-between shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] border border-white/10 relative overflow-hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex-1 flex flex-col items-center justify-center h-10"
              aria-label={tab.id}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 flex flex-col items-center z-0 pointer-events-none">
                  {/* The top pill (light source) */}
                  <motion.div
                    layoutId="dock-pill"
                    className="w-8 h-1 bg-primary rounded-full shadow-[0_0_12px] shadow-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                  {/* The light beam */}
                  <motion.div
                    layoutId="dock-beam"
                    className="w-12 h-10 bg-gradient-to-b from-primary/30 to-transparent -mt-1"
                    style={{ clipPath: 'polygon(30% 0, 70% 0, 100% 100%, 0% 100%)' }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                </div>
              )}
              
              <div className="relative z-10">
                <Icon
                  className={`w-5 h-5 transition-all duration-300 ${
                    isActive ? 'text-primary scale-110 drop-shadow-md' : 'text-white/40 scale-100'
                  }`}
                  fill={isActive ? (tab.id === 'search' ? 'none' : 'currentColor') : 'none'}
                  strokeWidth={isActive && tab.id === 'search' ? 3 : 2}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 w-3.5 bg-rose-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center border border-[#1c1c1e]">
                    {tab.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
