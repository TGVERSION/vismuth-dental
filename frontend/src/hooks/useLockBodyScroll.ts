// 'use client';

// import { useEffect } from 'react';

// let lockCounter = 0;
// let originalScrollY = 0;

// export const useLockBodyScroll = (isLocked: boolean) => {
//   useEffect(() => {
//     if (!isLocked) return;

//     lockCounter++;

//     if (lockCounter === 1) {
//       originalScrollY = window.scrollY;
//       document.body.style.overflow = 'hidden';
//       document.body.style.position = 'fixed';
//       document.body.style.top = `-${originalScrollY}px`;
//       document.body.style.width = '100%';
//     }

//     return () => {
//       lockCounter--;
//       if (lockCounter === 0) {
//         document.body.style.overflow = '';
//         document.body.style.position = '';
//         document.body.style.top = '';
//         document.body.style.width = '';
//         window.scrollTo(0, originalScrollY);
//       }
//     };
//   }, [isLocked]);
// };
