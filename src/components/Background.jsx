import { useEffect, useState } from 'react'
import meadow from '../assets/meadow.jpg'

// Foto is 2120 × 1414 en wordt gespiegeld, zodat het kalf (met ruimtehelm) rechts staat:
// in gespiegelde coördinaten zit de helm rond x=1135, y=760.
// Links ligt een niet-gespiegelde kopie tegen de naad, zodat we kunnen uitzoomen zonder lege rand.
// Per schermverhouding een uitsnede: desktop kalf rechts naast de tekst, smal scherm kalf in het midden.
function viewBoxFor(width, height) {
  const ratio = width / height
  if (ratio < 0.9) return '535 120 1200 1294' // telefoon (staand)
  if (ratio < 1.3) return '-260 0 2000 1414' // tablet
  return '-530 8 2250 1406' // desktop
}

// Twinkelende sterren in de lucht
const STARS = [
  [140, 330, 5, 0], [420, 290, 3.5, 1.2], [1180, 300, 4, 0.6], [1460, 360, 3, 2.1],
  [1700, 280, 5, 1.6], [1940, 340, 3.5, 0.3], [880, 280, 3, 2.6], [300, 420, 2.5, 1.9],
]

export default function Background() {
  const [box, setBox] = useState(() => viewBoxFor(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const on = () => setBox(viewBoxFor(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  return (
    <>
      <svg className="bg" viewBox={box} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="ds-glass" cx="36%" cy="28%" r="78%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="0.45" stopColor="#d6ecff" stopOpacity="0.06" />
            <stop offset="0.86" stopColor="#a6ceff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.5" />
          </radialGradient>
          <linearGradient id="ds-collar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6f8fa" />
            <stop offset="1" stopColor="#a9b2bc" />
          </linearGradient>
        </defs>
        <image href={meadow} x="-2120" width="2120" height="1414" />
        <g transform="translate(2120 0) scale(-1 1)">
        <image href={meadow} width="2120" height="1414" />
        {STARS.map(([x, y, r, delay], i) => (
          <path
            key={i}
            d={`M ${x} ${y - r * 4} Q ${x} ${y} ${x + r * 4} ${y} Q ${x} ${y} ${x} ${y + r * 4} Q ${x} ${y} ${x - r * 4} ${y} Q ${x} ${y} ${x} ${y - r * 4} Z`}
            fill="#fff"
          >
            <animate attributeName="opacity" values="0.15;1;0.15" dur="3.2s" begin={`${delay}s`} repeatCount="indefinite" />
          </path>
        ))}
        <g className="space-cow">
          {/* antenne */}
          <line x1="1160" y1="470" x2="1222" y2="335" stroke="#eef2f5" strokeWidth="9" strokeLinecap="round" />
          <circle cx="1226" cy="322" r="20" fill="#ff6a5c">
            <animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite" />
          </circle>
          {/* glazen helm */}
          <circle cx="985" cy="760" r="375" fill="url(#ds-glass)" stroke="#ffffff" strokeOpacity="0.88" strokeWidth="7" />
          <path d="M 755 565 A 300 300 0 0 1 985 440" fill="none" stroke="#fff" strokeOpacity="0.78" strokeWidth="16" strokeLinecap="round" />
          <path d="M 718 645 A 300 300 0 0 1 732 612" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="12" strokeLinecap="round" />
          {/* kraag, volgt de onderkant van de helm */}
          <path d="M 678 975 A 375 375 0 0 0 1292 975" fill="none" stroke="url(#ds-collar)" strokeWidth="46" strokeLinecap="round" />
          <path d="M 678 975 A 375 375 0 0 0 1292 975" fill="none" stroke="#8d97a1" strokeOpacity="0.6" strokeWidth="3" transform="translate(0 -21)" />
          <circle cx="985" cy="1135" r="13" fill="#5fd0ff" />
          <circle cx="925" cy="1129" r="8" fill="#ffd36a" />
          <circle cx="1045" cy="1129" r="8" fill="#ff6a5c" />
        </g>
        </g>
      </svg>
      <div className="bg-shade" />
    </>
  )
}
