import { lazy } from 'react'

// Alle tools werken zelfstandig (Quick Tools) én binnen een project.
export const TOOLS = [
  {
    id: 'compare',
    name: 'Bestanden vergelijken',
    category: 'Vergelijken',
    desc: 'Sleep V1 en V2 erin en zie direct wat er veranderd is: visueel én in de tekst.',
    accepts: 'PDF, PNG, JPG',
    component: lazy(() => import('./tools/Compare.jsx')),
  },
  {
    id: 'pdf-check',
    name: 'PDF-check',
    category: 'Preflight',
    desc: 'Formaat, afloop, lettertypen, beeldresolutie en kleurruimte in één overzicht.',
    accepts: 'PDF',
    component: lazy(() => import('./tools/PdfCheck.jsx')),
  },
  {
    id: 'feedback',
    name: 'Feedback naar checklist',
    category: 'Correcties',
    desc: 'Plak een mail of appje van de klant en krijg een afvinkbare correctielijst.',
    accepts: 'Tekst, PDF',
    component: lazy(() => import('./tools/Feedback.jsx')),
  },
  {
    id: 'spelling',
    name: 'Spellingcontrole',
    category: 'Tekst',
    desc: 'Controleer teksten of een PDF op spelling, typografie en dubbele woorden.',
    accepts: 'Tekst, PDF',
    component: lazy(() => import('./tools/Spelling.jsx')),
  },
  {
    id: 'rename',
    name: 'Bestanden hernoemen',
    category: 'Bestanden',
    desc: 'Hernoem een hele set bestanden volgens een vast patroon en download als ZIP.',
    accepts: 'Alle bestanden',
    component: lazy(() => import('./tools/Rename.jsx')),
  },
  {
    id: 'export',
    name: 'Exportpakket',
    category: 'Oplevering',
    desc: 'Bundel eindbestanden in een nette mappenstructuur met leesmij, klaar om te versturen.',
    accepts: 'Alle bestanden',
    component: lazy(() => import('./tools/ExportPackage.jsx')),
  },
  {
    id: 'summary',
    name: 'Briefing samenvatten',
    category: 'Briefing',
    desc: 'Haal de kern, deadlines en eisen uit een lange briefing.',
    soon: true,
  },
  {
    id: 'pdf-table',
    name: 'PDF naar tabel',
    category: 'Data',
    desc: 'Zet prijslijsten en tabellen uit een PDF om naar Excel/CSV.',
    soon: true,
  },
]

export const getTool = (id) => TOOLS.find((t) => t.id === id)
