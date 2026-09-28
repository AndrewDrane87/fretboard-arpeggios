import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChevronDown, CircleDot, Info, Music2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ARPEGGIOS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  'Dominant 7': [0, 4, 7, 10],
  'Major 7': [0, 4, 7, 11],
  'Minor 7': [0, 3, 7, 10],
  Diminished: [0, 3, 6],
  Augmented: [0, 4, 8],
} as const;
type ArpeggioName = keyof typeof ARPEGGIOS;
type Family = 'guitar' | 'bass';
type Preset = { key: string; label: string; shortLabel: string; notes: string[] };

const TUNINGS: Record<Family, Record<string, Preset>> = {
  guitar: {
    standard: { key: 'standard', label: 'Standard', shortLabel: 'E A D G B E', notes: ['E', 'A', 'D', 'G', 'B', 'E'] },
    dropD: { key: 'dropD', label: 'Drop D', shortLabel: 'D A D G B E', notes: ['D', 'A', 'D', 'G', 'B', 'E'] },
    dStandard: { key: 'dStandard', label: 'D Standard', shortLabel: 'D G C F A D', notes: ['D', 'G', 'C', 'F', 'A', 'D'] },
    dropC: { key: 'dropC', label: 'Drop C', shortLabel: 'C G C F A D', notes: ['C', 'G', 'C', 'F', 'A', 'D'] },
    openG: { key: 'openG', label: 'Open G', shortLabel: 'D G D G B D', notes: ['D', 'G', 'D', 'G', 'B', 'D'] },
    standard7: { key: 'standard7', label: 'Standard 7-string', shortLabel: 'B E A D G B E', notes: ['B', 'E', 'A', 'D', 'G', 'B', 'E'] },
    dropA7: { key: 'dropA7', label: 'Drop A 7-string', shortLabel: 'A E A D G B E', notes: ['A', 'E', 'A', 'D', 'G', 'B', 'E'] },
    dStandard7: { key: 'dStandard7', label: 'D Standard 7-string', shortLabel: 'A D G C F A D', notes: ['A', 'D', 'G', 'C', 'F', 'A', 'D'] },
    dropG7: { key: 'dropG7', label: 'Drop G 7-string', shortLabel: 'G D G C F A D', notes: ['G', 'D', 'G', 'C', 'F', 'A', 'D'] },
  },
  bass: {
    standard: { key: 'standard', label: 'Standard', shortLabel: 'E A D G', notes: ['E', 'A', 'D', 'G'] },
    dropD4: { key: 'dropD4', label: 'Drop D', shortLabel: 'D A D G', notes: ['D', 'A', 'D', 'G'] },
    dStandard4: { key: 'dStandard4', label: 'D Standard', shortLabel: 'D G C F', notes: ['D', 'G', 'C', 'F'] },
    dropC4: { key: 'dropC4', label: 'Drop C', shortLabel: 'C G C F', notes: ['C', 'G', 'C', 'F'] },
    fiveString: { key: 'fiveString', label: '5-string standard', shortLabel: 'B E A D G', notes: ['B', 'E', 'A', 'D', 'G'] },
    dropD5: { key: 'dropD5', label: '5-string Drop D', shortLabel: 'A D A D G', notes: ['A', 'D', 'A', 'D', 'G'] },
    dStandard5: { key: 'dStandard5', label: '5-string D Standard', shortLabel: 'A D G C F', notes: ['A', 'D', 'G', 'C', 'F'] },
    dropC5: { key: 'dropC5', label: '5-string Drop C', shortLabel: 'G C G C F', notes: ['G', 'C', 'G', 'C', 'F'] },
  },
};
const INTERVAL_LABELS: Record<number, string> = { 0: 'R', 3: '♭3', 4: '3', 6: '♭5', 7: '5', 8: '♯5', 10: '♭7', 11: '7' };

function SelectField({ label, value, options, onChange, testId }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; testId: string }) {
  return (
    <label className="min-w-0">
      <span className="control-label">{label}</span>
      <span className="select-wrap block">
        <select data-testid={testId} className="control-select" value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={15} />
      </span>
    </label>
  );
}

function Home() {
  const [family, setFamily] = useState<Family>('guitar');
  const [stringCount, setStringCount] = useState(6);
  const [tuningKey, setTuningKey] = useState('standard');
  const [root, setRoot] = useState('C');
  const [arpeggio, setArpeggio] = useState<ArpeggioName>('Major 7');
  const [mode, setMode] = useState<'notes' | 'intervals'>('notes');
  const [maxFret, setMaxFret] = useState(17);

  const availableTunings = useMemo(() => {
    if (family === 'guitar') return stringCount === 7 ? [TUNINGS.guitar.standard7, TUNINGS.guitar.dropA7, TUNINGS.guitar.dStandard7, TUNINGS.guitar.dropG7] : [TUNINGS.guitar.standard, TUNINGS.guitar.dropD, TUNINGS.guitar.dStandard, TUNINGS.guitar.dropC, TUNINGS.guitar.openG];
    return stringCount === 5 ? [TUNINGS.bass.fiveString, TUNINGS.bass.dropD5, TUNINGS.bass.dStandard5, TUNINGS.bass.dropC5] : [TUNINGS.bass.standard, TUNINGS.bass.dropD4, TUNINGS.bass.dStandard4, TUNINGS.bass.dropC4];
  }, [family, stringCount]);
  const activeTuningKey = availableTunings.some((preset) => preset.key === tuningKey) ? tuningKey : availableTunings[0].key;
  const selectedTuning = availableTunings.find((preset) => preset.key === activeTuningKey) ?? availableTunings[0];
  const formula = ARPEGGIOS[arpeggio];
  const rootIndex = NOTES.indexOf(root);
  const activeNoteSet = useMemo(() => new Set(formula.map((interval) => (rootIndex + interval) % 12)), [formula, rootIndex]);
  const fretNumbers = Array.from({ length: maxFret + 1 }, (_, index) => index);
  const activePositions = useMemo(() => selectedTuning.notes.reduce((total, openNote) => {
    return total + fretNumbers.filter((fret) => activeNoteSet.has((NOTES.indexOf(openNote) + fret) % 12)).length;
  }, 0), [activeNoteSet, fretNumbers, selectedTuning]);

  const reset = () => {
    setFamily('guitar'); setStringCount(6); setTuningKey('standard'); setRoot('C'); setArpeggio('Major 7'); setMode('notes'); setMaxFret(17);
  };
  const setInstrument = (nextFamily: Family) => {
    setFamily(nextFamily);
    setStringCount(nextFamily === 'guitar' ? 6 : 4);
    setTuningKey('standard');
  };
  const setStrings = (count: number) => {
    setStringCount(count);
    setTuningKey('standard');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark" aria-hidden="true"><Music2 size={21} strokeWidth={2.4} /></div>
            <div>
              <p className="display-font m-0 text-[1.02rem] font-bold tracking-[-0.03em]">Fretboard <span className="text-[#d76542]">Arpeggio</span> Explorer</p>
              <p className="eyebrow m-0 mt-0.5">a visual practice workbench</p>
            </div>
          </div>
          <button data-testid="button-reset-selection" type="button" onClick={reset} className="flex items-center gap-2 rounded-lg border border-[#d9d0bd] bg-[#fbf9f3] px-3 py-2 text-xs font-bold text-[#53606a] transition hover:border-[#d76542] hover:text-[#c25132] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d76542]">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 pb-14 pt-8 md:px-8 md:pt-12">
        <section className="fade-up mb-8 max-w-3xl">
          <p className="eyebrow mb-3">Map the shape. Hear the harmony.</p>
          <h1 className="display-font m-0 text-4xl font-bold leading-[1.04] tracking-[-0.055em] text-[#222d37] md:text-6xl">See every note<br /><span className="text-[#d76542]">before you play it.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#5d6870] md:text-base">A whole-neck view for building instinct. Set a root, choose the color of the chord, and let the fretboard show you where it lives.</p>
        </section>

        <section className="control-card fade-up fade-up-delay mb-7 p-4 md:p-5" aria-label="Fretboard controls">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#e6dfd0] pb-4">
            <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-[#d76542]" /><p className="m-0 text-sm font-extrabold text-[#303c45]">Build your position</p></div>
            <p data-testid="text-selection-summary" className="eyebrow m-0 text-right">Showing {activePositions} tones across {maxFret} frets</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-[1.05fr_.85fr_1fr_1fr]">
            <div>
              <span className="control-label">Instrument</span>
              <div className="segmented">
                {(['guitar', 'bass'] as Family[]).map((item) => <button data-testid={`button-instrument-${item}`} type="button" key={item} data-active={family === item} onClick={() => setInstrument(item)}>{item === 'guitar' ? 'Guitar' : 'Bass'}</button>)}
              </div>
            </div>
            <div>
              <span className="control-label">Strings</span>
              <div className="segmented">
                {(family === 'guitar' ? [6, 7] : [4, 5]).map((count) => <button data-testid={`button-strings-${count}`} type="button" key={count} data-active={stringCount === count} onClick={() => setStrings(count)}>{count}</button>)}
              </div>
            </div>
            <SelectField label="Tuning preset" value={activeTuningKey} options={availableTunings.map((preset) => ({ value: preset.key, label: `${preset.label}  ·  ${preset.shortLabel}` }))} onChange={setTuningKey} testId="select-tuning" />
            <SelectField label="Root note" value={root} options={NOTES.map((note) => ({ value: note, label: note }))} onChange={setRoot} testId="select-root" />
            <SelectField label="Arpeggio" value={arpeggio} options={Object.keys(ARPEGGIOS).map((name) => ({ value: name, label: name }))} onChange={(value) => setArpeggio(value as ArpeggioName)} testId="select-arpeggio" />
            <div>
              <span className="control-label">Display</span>
              <div className="segmented">
                <button data-testid="button-display-notes" type="button" data-active={mode === 'notes'} onClick={() => setMode('notes')}>Note names</button>
                <button data-testid="button-display-intervals" type="button" data-active={mode === 'intervals'} onClick={() => setMode('intervals')}>Intervals</button>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between"><span className="control-label m-0">Fret range</span><span data-testid="text-fret-range" className="font-mono text-xs font-bold text-[#d76542]">0 — {maxFret}</span></div>
              <input data-testid="input-fret-range" className="range-input" type="range" min="5" max="24" value={maxFret} onChange={(event) => setMaxFret(Number(event.target.value))} />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[#899198]"><span>5</span><span>12</span><span>17</span><span>24</span></div>
            </div>
          </div>
        </section>

        <section className="fade-up" aria-label="Current arpeggio selection">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Current selection</p>
              <h2 data-testid="text-current-selection" className="display-font m-0 text-2xl font-bold tracking-[-0.04em] text-[#26333d] md:text-3xl">{root} {arpeggio}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span data-testid="text-formula" className="font-mono text-xs text-[#6b7478]">Formula: {formula.map((interval) => interval === 0 ? '1' : interval).join(' — ')}</span>
                <span className="note-legend"><i className="legend-dot root" /> root</span><span className="note-legend"><i className="legend-dot" /> chord tone</span>
              </div>
            </div>
            <div className="rounded-lg border border-[#e0d7c5] bg-[#f8f5ed] px-3 py-2 text-right">
              <p className="eyebrow m-0">Instrument / tuning</p>
              <p data-testid="text-current-tuning" className="m-0 mt-1 font-mono text-xs font-medium text-[#34434c]">{family} · {selectedTuning.label}</p>
            </div>
          </div>
          <div className="accent-rule mb-4" />
        </section>

        <section className="fretboard-wrap fade-up" aria-label={`${root} ${arpeggio} fretboard`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#40505b] bg-[#202b35] px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-[#b9c5c7]"><CircleDot size={14} className="text-[#f0b23e]" /><span>High string 1</span><span className="text-[#687881]">→</span><span>low string</span></div>
            <div className="flex items-center gap-2 text-xs text-[#b9c5c7]"><Info size={14} /><span>Scroll horizontally to explore the full neck</span></div>
          </div>
          <div className="fretboard-scroll">
            <div className="fretboard" style={{ '--frets': maxFret + 1 } as CSSProperties}>
              <div className="fret-grid fret-head">
                <div className="fret-number justify-start pl-1 text-left">STRING</div>
                {fretNumbers.map((fret) => <div data-testid={`text-fret-${fret}`} key={fret} className={`fret-number ${fret === 0 ? 'is-nut' : ''}`}>{fret === 0 ? 'OPEN' : fret}</div>)}
              </div>
              {selectedTuning.notes.slice().reverse().map((openNote, displayStringIndex) => (
                <div className="fret-grid" key={`${openNote}-${displayStringIndex}`}>
                  <div className="string-label"><span>{displayStringIndex + 1}</span> {openNote}</div>
                  {fretNumbers.map((fret) => {
                    const note = NOTES[(NOTES.indexOf(openNote) + fret) % 12];
                    const interval = (NOTES.indexOf(note) - rootIndex + 12) % 12;
                    const active = activeNoteSet.has(NOTES.indexOf(note));
                    const isRoot = active && interval === 0;
                    return <div className={`fret-cell ${fret === 0 ? 'is-nut' : ''}`} key={`${displayStringIndex}-${fret}`} data-testid={`cell-${displayStringIndex}-${fret}`}><span title={`${note}, fret ${fret}`} aria-label={`${note}, fret ${fret}${isRoot ? ', root' : ''}`} className={active ? `note-dot ${isRoot ? 'is-root' : 'is-note'}` : 'sr-only'}>{active ? (mode === 'notes' ? note : INTERVAL_LABELS[interval] ?? interval) : ''}</span></div>;
                  })}
                </div>
              ))}
              <div className="fret-grid marker-row" aria-hidden="true">
                <div />
                {fretNumbers.map((fret) => <div key={fret}>{[3, 5, 7, 9, 15, 17, 19, 21].includes(fret) ? <div className="marker" /> : [12, 24].includes(fret) ? <div className="marker double" /> : null}</div>)}
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7a817f]">
          <p className="m-0">Chromatic positions calculated locally from open-string pitch.</p>
          <p className="m-0 font-mono">12 notes · {formula.length} chord tones · {maxFret} frets</p>
        </footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;