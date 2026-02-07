
import React, { useEffect, useState } from 'react';

const Petal = ({ delay, duration, left, size }: { delay: number; duration: number; left: number; size: number }) => (
  <div
    className="fixed pointer-events-none"
    style={{
      top: '-50px',
      left: `${left}%`,
      width: `${size}px`,
      height: `${size * 0.7}px`,
      backgroundColor: '#ffb7c5',
      borderRadius: '100% 0 100% 0',
      opacity: 0.6,
      filter: 'blur(1px)',
      animation: `fall ${duration}s linear ${delay}s infinite`,
      zIndex: 0,
    }}
  />
);

const SakuraBackground: React.FC = () => {
  const [petals, setPetals] = useState<any[]>([]);

  useEffect(() => {
    const newPetals = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      delay: Math.random() * 10,
      duration: 10 + Math.random() * 20,
      left: Math.random() * 100,
      size: 10 + Math.random() * 15,
    }));
    setPetals(newPetals);
  }, []);

  return (
    <>
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg) translateX(0);
          }
          25% {
            transform: translateY(25vh) rotate(90deg) translateX(20px);
          }
          50% {
            transform: translateY(50vh) rotate(180deg) translateX(-20px);
          }
          75% {
            transform: translateY(75vh) rotate(270deg) translateX(20px);
          }
          100% {
            transform: translateY(110vh) rotate(360deg) translateX(0);
          }
        }
      `}</style>
      <div className="fixed inset-0 z-0 overflow-hidden bg-gradient-to-br from-pink-50 to-white">
        {petals.map((p) => (
          <Petal key={p.id} {...p} />
        ))}
      </div>
    </>
  );
};

export default SakuraBackground;
