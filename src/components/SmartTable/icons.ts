// Cache for SVG data URLs to avoid repeated encoding
const svgDataUrlCache = new Map<string, string>();

export const svgToDataUrl = (svgStr: string) => {
  if (svgDataUrlCache.has(svgStr)) {
    return svgDataUrlCache.get(svgStr)!;
  }
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
  svgDataUrlCache.set(svgStr, dataUrl);
  return dataUrl;
};

export const alignLeftOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="design-iconfont"><path d="M2,4.66666667 L2,3.33333333 L14,3.33333333 L14,4.66666667 L2,4.66666667 Z M2,8.66666667 L2,7.33333333 L14,7.33333333 L14,8.66666667 L2,8.66666667 Z M2,12.6666667 L2,11.3333333 L10,11.3333333 L10,12.6666667 L2,12.6666667 Z" fill="#9CA3AF" fill-rule="nonzero"/></svg>`;

export const userOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="design-iconfont"><path d="M13.4140625,11.93125 C13.11875,11.23125 12.69375,10.603125 12.1546875,10.0640625 C11.615625,9.525 10.9875,9.1015625 10.2875,8.8046875 C10.28125,8.8015625 10.275,8.8 10.26875,8.796875 C11.2421875,8.09375 11.875,6.9484375 11.875,5.65625 C11.875,3.515625 10.140625,1.78125 8,1.78125 C5.859375,1.78125 4.125,3.515625 4.125,5.65625 C4.125,6.9484375 4.7578125,8.09375 5.73125,8.7984375 C5.725,8.8015625 5.71875,8.803125 5.7125,8.80625 C5.0125,9.1015625 4.384375,9.525 3.8453125,10.065625 C3.30625,10.6046875 2.8828125,11.2328125 2.5859375,11.9328125 C2.2953125,12.6171875 2.140625,13.34375 2.12496822,14.090625 C2.1234375,14.1609375 2.1796875,14.21875 2.25,14.21875 L3.1875,14.21875 C3.25625,14.21875 3.3109375,14.1640625 3.3125,14.096875 C3.34375,12.890625 3.828125,11.7609375 4.684375,10.9046875 C5.5703125,10.01875 6.746875,9.53125 8,9.53125 C9.253125,9.53125 10.4296875,10.01875 11.315625,10.9046875 C12.171875,11.7609375 12.65625,12.890625 12.6875,14.096875 C12.6890625,14.165625 12.74375,14.21875 12.8125,14.21875 L13.75,14.21875 C13.8203125,14.21875 13.8765625,14.1609375 13.8750318,14.090625 C13.859375,13.34375 13.7046875,12.6171875 13.4140625,11.93125 Z M8,8.34375 C7.2828125,8.34375 6.6078125,8.0640625 6.1,7.55625 C5.5921875,7.0484375 5.3125,6.3734375 5.3125,5.65625 C5.3125,4.9390625 5.5921875,4.2640625 6.1,3.75625 C6.6078125,3.2484375 7.2828125,2.96875 8,2.96875 C8.7171875,2.96875 9.3921875,3.2484375 9.9,3.75625 C10.4078125,4.2640625 10.6875,4.9390625 10.6875,5.65625 C10.6875,6.3734375 10.4078125,7.0484375 9.9,7.55625 C9.3921875,8.0640625 8.7171875,8.34375 8,8.34375 Z" fill="#9CA3AF" fill-rule="nonzero"/></svg>`;

export const radioOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="design-iconfont"><path d="M8,13.3333333 C5.05448279,13.3333333 2.66666667,10.9455172 2.66666667,8 C2.66666667,5.05448279 5.05448279,2.66666667 8,2.66666667 C10.9455172,2.66666667 13.3333333,5.05448279 13.3333333,8 C13.3333333,10.9455172 10.9455172,13.3333333 8,13.3333333 Z M8,12 C10.209139,12 12,10.209139 12,8 C12,5.790861 10.209139,4 8,4 C5.790861,4 4,5.790861 4,8 C4,10.209139 5.790861,12 8,12 Z" fill="#9CA3AF" fill-rule="nonzero"/></svg>`;

export const checkSquareOutlinedSvg = `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    class="design-iconfont"
  >
    <path
      d="M6.7328125,7.68959391 C6.59086002,7.68970521 6.45546364,7.62985502 6.36,7.52479688 L4.08,5.02479688 C3.89410833,4.81892192 3.90951281,4.50153466 4.11446817,4.31462958 C4.31942353,4.1277245 4.63688293,4.14156297 4.82479687,4.34559375 L6.78559375,6.49520313 L12.1215937,2.196 C12.338805,2.03050168 12.6483084,2.06809479 12.8195845,2.28077981 C12.9908606,2.49346483 12.9615989,2.80386676 12.7535937,2.98079688 L7.04879687,7.57759375 C6.95939453,7.65000757 6.84784703,7.68959391 6.73279687,7.68959391 L6.7328125,7.68959391 Z M12.5392031,14.2615938 L5.90639062,14.2615938 C5.61699342,14.2615938 5.38239062,14.026991 5.38239062,13.7375938 C5.38239062,13.4481965 5.61699342,13.2135938 5.90639062,13.2135938 L12.5392031,13.2135938 C12.9176605,13.213146 13.2243492,12.9064574 13.2247969,12.528 L13.2247969,7.42720313 C13.2247969,7.13780592 13.4593997,6.90320313 13.7487969,6.90320313 C14.0381941,6.90320313 14.2727969,7.13780592 14.2727969,7.42720313 L14.2727969,12.528 C14.2714715,13.4848878 13.496091,14.2602683 12.5392031,14.2615938 L12.5392031,14.2615938 Z M9.616,11.3384063 L3.628,11.3384063 C2.67111215,11.3370808 1.89573166,10.5617003 1.89440625,9.6048125 L1.89440625,3.61678125 C1.89573166,2.6598934 2.67111215,1.88451291 3.628,1.8831875 L7.84,1.8831875 C8.12961726,1.8831875 8.36439844,2.11796868 8.36439844,2.40758594 C8.36439844,2.6972032 8.12961726,2.93198438 7.84,2.93198438 L3.628,2.93198438 C3.24954263,2.93243209 2.94285397,3.23912076 2.94240625,3.61757813 L2.94240625,9.60557813 C2.94284536,9.98404159 3.24953654,10.2907398 3.628,10.2911875 L9.616,10.2911875 C9.99446346,10.3011546,9.98404159 10.3015937,9.60557813 L10.3015937,7.42720313 C10.3015937,7.13758155 10.5363784,6.90279688 10.826,6.90279688 C11.1156216,6.90279688 11.3504062,7.13758155 11.3504062,7.42720313 L11.3504062,9.60479688 C11.3490799,10.5620015 10.5732051,11.3375128 9.616,11.3384063 L9.616,11.3384063 Z"
      fill="#9CA3AF"
      fill-rule="nonzero"
    />
  </svg>`;

export const squareOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2" ry="2" fill="none" stroke="#9CA3AF" stroke-width="1"/></svg>`;
export const minusSquareOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2" ry="2" fill="none" stroke="#9CA3AF" stroke-width="1"/><rect x="4" y="7.25" width="8" height="1.5" fill="#9CA3AF"/></svg>`;
export const checkSquareFilledSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="3" ry="3" fill="#2563EB"/><path d="M6.6 10.7L4.3 8.4a1 1 0 1 1 1.4-1.4l1.9 1.9 3.9-3.9a1 1 0 0 1 1.4 1.4l-4.6 4.6a1 1 0 0 1-1.4 0z" fill="#FFFFFF"/></svg>`;

export const triangleUpFilledSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 3L3.5 8h9L8 3z" fill="#9CA3AF"/></svg>`;
export const triangleDownFilledSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 13l4.5-5h-9L8 13z" fill="#9CA3AF"/></svg>`;
export const ellipsisOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-4.5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#9CA3AF"/></svg>`;
export const plusOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 3a.5.5 0 0 1 .5.5v4h4a.5.5 0 0 1 0 1h-4v4a.5.5 0 0 1-1 0v-4h-4a.5.5 0 0 1 0-1h4v-4A.5.5 0 0 1 8 3z" fill="#9CA3AF"/></svg>`;
export const caretRightFilledSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M5.81235 11.3501C5.48497 11.612 5 11.3789 5 10.9597L5 5.04031C5 4.62106 5.48497 4.38797 5.81235 4.64988L9.51196 7.60957C9.76216 7.80973 9.76216 8.19027 9.51196 8.39044L5.81235 11.3501Z" fill="#9CA3AF"/></svg>`;
export const caretDownFilledSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M4.64988 6.81235C4.38797 6.48497 4.62106 6 5.04031 6L10.9597 6C11.3789 6 11.612 6.48497 11.3501 6.81235L8.39043 10.512C8.19027 10.7622 7.80973 10.7622 7.60957 10.512L4.64988 6.81235Z" fill="#9CA3AF"/></svg>`;
export const gripDotsOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="4" r="1.2" fill="#9CA3AF"/><circle cx="11" cy="4" r="1.2" fill="#9CA3AF"/><circle cx="5" cy="8" r="1.2" fill="#9CA3AF"/><circle cx="11" cy="8" r="1.2" fill="#9CA3AF"/><circle cx="5" cy="12" r="1.2" fill="#9CA3AF"/><circle cx="11" cy="12" r="1.2" fill="#9CA3AF"/></svg>`;
export const expandDiagonalOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5H13.5V6.5"/><path d="M13.5 2.5L8.5 7.5"/><path d="M6.5 13.5H2.5V9.5"/><path d="M2.5 13.5L7.5 8.5"/></svg>`;
export const linkOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.5"><path d="M10 8.5C10 8.5 11.5 7 12.5 6C13.5 5 13.5 3.5 12.5 2.5C11.5 1.5 10 1.5 9 2.5L8 3.5M6 7.5C6 7.5 4.5 9 3.5 10C2.5 11 2.5 12.5 3.5 13.5C4.5 14.5 6 14.5 7 13.5L8 12.5"/></svg>`;

export const pictureOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#9CA3AF"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm1 0v10h10V3H3zm2.5 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-1 5l2-3 2 3h-4zm5-1l1.5-2 1.5 2h-3z"/></svg>`;

export const starFilledSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#FBBF24"><path d="M8 1.5l2.12 4.29 4.74.69-3.43 3.34.81 4.72L8 12.31l-4.24 2.23.81-4.72-3.43-3.34 4.74-.69L8 1.5z"/></svg>`;
export const starOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#E5E7EB"><path d="M8 1.5l2.12 4.29 4.74.69-3.43 3.34.81 4.72L8 12.31l-4.24 2.23.81-4.72-3.43-3.34 4.74-.69L8 1.5z"/></svg>`;
export const calendarOutlinedSvg = `<svg t="1777289972413" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3064" width="200" height="200"><path d="M128 384v512h768V192h-128v32a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96 31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04V192h-384v32a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96 31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04V192H128v128h768V384H128z m192-256h384v-32a31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96 31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04V128h160a31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04v768a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96H96a31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04v-768a31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96H256v-32a31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96 31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04V128z m-32 384h64a31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96h-64a31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04 31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96z m0 192h64a31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96h-64a31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04 31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96z m192-192h64a31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96h-64a31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04 31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96z m0 192h64a31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96h-64a31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04 31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96z m192-192h64a31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96h-64a31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04 31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96z m0 192h64a31.146667 31.146667 0 0 1 23.04 8.96c5.973333 6.016 8.96 13.696 8.96 23.04a31.146667 31.146667 0 0 1-8.96 23.04 31.146667 31.146667 0 0 1-23.04 8.96h-64a31.146667 31.146667 0 0 1-23.04-8.96 31.146667 31.146667 0 0 1-8.96-23.04 31.146667 31.146667 0 0 1 8.96-23.04 31.146667 31.146667 0 0 1 23.04-8.96z" fill="#9CA3AF" fill-opacity=".96" p-id="3065"></path></svg>`;

export const numberOutlinedSvg = `<svg t="1777289915668" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2032" width="200" height="200"><path d="M508 280h-63.3c-3.3 0-6 2.7-6 6v340.2H433L197.4 282.6c-1.1-1.6-3-2.6-4.9-2.6H126c-3.3 0-6 2.7-6 6v464c0 3.3 2.7 6 6 6h62.7c3.3 0 6-2.7 6-6V405.1h5.7l238.2 348.3c1.1 1.6 3 2.6 5 2.6H508c3.3 0 6-2.7 6-6V286c0-3.3-2.7-6-6-6zM886 693H582c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h304c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zM733.8 630c52.9 0 95.2-17.2 126.2-51.7 29.4-32.9 44-75.8 44-128.8 0-53.1-14.6-96.5-44-129.3-30.9-34.8-73.2-52.2-126.2-52.2-53.7 0-95.9 17.5-126.3 52.8-29.2 33.1-43.4 75.9-43.4 128.7 0 52.4 14.3 95.2 43.5 128.3 30.6 34.7 73 52.2 126.2 52.2z m-71.5-263.7c16.9-20.6 40.3-30.9 71.4-30.9 31.5 0 54.8 9.6 71 29.1 16.4 20.3 24.9 48.6 24.9 84.9 0 36.3-8.4 64.1-24.8 83.9-16.5 19.4-40 29.2-71.1 29.2-31.2 0-55-10.3-71.4-30.4-16.3-20.1-24.5-47.3-24.5-82.6 0.1-35.8 8.2-63 24.5-83.2z" p-id="2033" fill="#9CA3AF"></path></svg>`;

export const fileOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.5"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z"/><path d="M9 2v4h4"/></svg>`;

export const pdfOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" fill="#EF4444"/><path d="M9 2v4h4" stroke="#EF4444" stroke-width="1.5"/><text x="5" y="12" font-size="4" fill="#fff" font-weight="bold">PDF</text></svg>`;

export const docOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" fill="#3B82F6"/><path d="M9 2v4h4" stroke="#3B82F6" stroke-width="1.5"/><text x="5.5" y="12" font-size="3.5" fill="#fff" font-weight="bold">DOC</text></svg>`;

export const xlsOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" fill="#10B981"/><path d="M9 2v4h4" stroke="#10B981" stroke-width="1.5"/><text x="5" y="12" font-size="4" fill="#fff" font-weight="bold">XLS</text></svg>`;

export const zipOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" fill="#8B5CF6"/><path d="M9 2v4h4" stroke="#8B5CF6" stroke-width="1.5"/><text x="5.5" y="12" font-size="3.5" fill="#fff" font-weight="bold">ZIP</text></svg>`;

export const videoOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" fill="#F59E0B"/><path d="M9 2v4h4" stroke="#F59E0B" stroke-width="1.5"/><path d="M6.5 7.5l2 1.5-2 1.5V7.5z" fill="#fff"/></svg>`;

// 延迟注册图标到 IconManager，避免初始化顺序问题
import { iconManager } from './IconManager';

const initializeIconManager = () => {
  iconManager.registerIcon('alignLeftOutlined', alignLeftOutlinedSvg);
  iconManager.registerIcon('userOutlined', userOutlinedSvg);
  iconManager.registerIcon('radioOutlined', radioOutlinedSvg);
  iconManager.registerIcon('checkSquareOutlined', checkSquareOutlinedSvg);
  iconManager.registerIcon('squareOutlined', squareOutlinedSvg);
  iconManager.registerIcon('minusSquareOutlined', minusSquareOutlinedSvg);
  iconManager.registerIcon('checkSquareFilled', checkSquareFilledSvg);
  iconManager.registerIcon('triangleUpFilled', triangleUpFilledSvg);
  iconManager.registerIcon('triangleDownFilled', triangleDownFilledSvg);
  iconManager.registerIcon('ellipsisOutlined', ellipsisOutlinedSvg);
  iconManager.registerIcon('plusOutlined', plusOutlinedSvg);
  iconManager.registerIcon('caretRightFilled', caretRightFilledSvg);
  iconManager.registerIcon('caretDownFilled', caretDownFilledSvg);
  iconManager.registerIcon('gripDotsOutlined', gripDotsOutlinedSvg);
  iconManager.registerIcon('expandDiagonalOutlined', expandDiagonalOutlinedSvg);
  iconManager.registerIcon('linkOutlined', linkOutlinedSvg);
  iconManager.registerIcon('pictureOutlined', pictureOutlinedSvg);
  iconManager.registerIcon('starFilled', starFilledSvg);
  iconManager.registerIcon('starOutlined', starOutlinedSvg);
  iconManager.registerIcon('calendarOutlined', calendarOutlinedSvg);
  iconManager.registerIcon('numberOutlined', numberOutlinedSvg);
  iconManager.registerIcon('fileOutlined', fileOutlinedSvg);
  iconManager.registerIcon('pdfOutlined', pdfOutlinedSvg);
  iconManager.registerIcon('docOutlined', docOutlinedSvg);
  iconManager.registerIcon('xlsOutlined', xlsOutlinedSvg);
  iconManager.registerIcon('zipOutlined', zipOutlinedSvg);
  iconManager.registerIcon('videoOutlined', videoOutlinedSvg);
};

// 使用 requestAnimationFrame 延迟初始化，确保所有变量都已定义
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    initializeIconManager();
  });
}
