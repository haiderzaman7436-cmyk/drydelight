import{c as r,j as t,k as p}from"./index-C2ilo5HK.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 9.9-1",key:"1mm8w8"}]],f=r("LockOpen",g);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]],N=r("TrendingUp",b);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]],j=r("Wallet",w),n={blue:"bg-gradient-to-br from-blue-600 to-blue-700 text-white",emerald:"bg-gradient-to-br from-emerald-500 to-green-600 text-white",amber:"bg-gradient-to-br from-amber-500 to-orange-600 text-white",red:"bg-gradient-to-br from-rose-600 to-red-700 text-white",indigo:"bg-gradient-to-br from-indigo-600 to-blue-700 text-white",purple:"bg-gradient-to-br from-violet-600 to-purple-700 text-white",slate:"bg-gradient-to-br from-[#0f2347] to-[#1e3a6e] text-white",locked:"bg-gradient-to-br from-amber-500 to-orange-600 text-white"};function k({title:c,value:d,subtitle:a,icon:x,tone:h="blue",locked:e=!1,onClick:i}){const o=e?p:x,s=e?n.locked:n[h]||n.blue,m=!!i,l=t.jsxs("div",{className:"flex items-center gap-3 w-full min-w-0",children:[o&&t.jsx("div",{className:"w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0",children:t.jsx(o,{className:"w-5 h-5 text-white"})}),t.jsxs("div",{className:"min-w-0 flex-1",children:[t.jsx("p",{className:"text-base sm:text-lg font-bold tracking-tight text-white truncate leading-tight",children:e?"Protected":d}),t.jsxs("p",{className:"text-[11px] font-medium text-white/90 truncate flex items-center gap-1.5 mt-0.5",children:[t.jsx("span",{className:"truncate",children:c}),e&&t.jsx("span",{className:"px-1.5 py-0.2 rounded bg-white/25 text-white text-[9px] font-bold tracking-normal",children:"LOCKED"})]}),(e||a)&&t.jsx("p",{className:"text-[10px] sm:text-[11px] text-white/80 mt-0.5 truncate leading-tight",children:e?"Click to unlock with PIN":a})]})]});return m?t.jsx("button",{type:"button",onClick:i,className:`w-full text-left rounded-xl p-3 sm:p-3.5 shadow-sm transition-all hover:brightness-105 cursor-pointer ${s}`,title:"Click to unlock profit view",children:l}):t.jsx("div",{className:`rounded-xl p-3 sm:p-3.5 shadow-sm ${s}`,children:l})}export{f as L,k as S,N as T,j as W};
