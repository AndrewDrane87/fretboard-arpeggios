import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Check, ChevronDown, CircleDot, Info, KeyRound, ListMusic, Music2, Plus, Printer, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-react';
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
type ScaleMode = 'major' | 'natural-minor';
type KeySignature = { id: string; root: string; mode: ScaleMode; label: string; notes: string[]; noteIndices: Set<number> };
type ChordPlanEntry = {
  id: string;
  root: string;
  arpeggio: ArpeggioName;
  formula: readonly number[];
  family: Family;
  tuning: Preset;
  maxFret: number;
};

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
const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  'natural-minor': [0, 2, 3, 5, 7, 8, 10],
};
const ARPEGGIO_ENTRIES = Object.entries(ARPEGGIOS) as [ArpeggioName, readonly number[]][];
const KEY_SIGNATURES: KeySignature[] = NOTES.flatMap((keyRoot) => (['major', 'natural-minor'] as ScaleMode[]).map((mode) => {
  const noteIndices = new Set(SCALE_INTERVALS[mode].map((interval) => (NOTES.indexOf(keyRoot) + interval) % 12));
  return {
    id: `${keyRoot}-${mode}`,
    root: keyRoot,
    mode,
    label: `${keyRoot} ${mode === 'major' ? 'Major' : 'Natural Minor'}`,
    notes: [...noteIndices].map((index) => NOTES[index]),
    noteIndices,
  };
}));

function formulaLabel(formula: readonly number[]) {
  return formula.map((interval) => interval === 0 ? 'R' : INTERVAL_LABELS[interval] ?? interval).join(' — ');
}

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

function PrintFretboard({ chord }: { chord: ChordPlanEntry }) {
  const fretNumbers = Array.from({ length: chord.maxFret + 1 }, (_, index) => index);
  const rootIndex = NOTES.indexOf(chord.root);
  const activeNoteSet = new Set(chord.formula.map((interval) => (rootIndex + interval) % 12));
  return (
    <div className="print-chart" style={{ '--print-frets': chord.maxFret + 1 } as CSSProperties} data-testid={`print-chart-${chord.id}`}>
      <div className="print-chart-row print-chart-header"><div>STR</div>{fretNumbers.map((fret) => <div key={fret}>{fret === 0 ? 'O' : fret}</div>)}</div>
      {chord.tuning.notes.slice().reverse().map((openNote, displayStringIndex) => (
        <div className="print-chart-row" key={`${openNote}-${displayStringIndex}`}>
          <div className="print-string-label">{displayStringIndex + 1} {openNote}</div>
          {fretNumbers.map((fret) => {
            const note = NOTES[(NOTES.indexOf(openNote) + fret) % 12];
            const interval = (NOTES.indexOf(note) - rootIndex + 12) % 12;
            const active = activeNoteSet.has(NOTES.indexOf(note));
            const isRoot = active && interval === 0;
            return <div className={`print-chart-cell ${fret === 0 ? 'print-nut' : ''}`} key={`${displayStringIndex}-${fret}`}>{active ? <span className={isRoot ? 'print-root' : ''}>{isRoot ? 'R' : INTERVAL_LABELS[interval] ?? interval}</span> : null}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

function PrintSurface({ chords }: { chords: ChordPlanEntry[] }) {
  return (
    <div className="print-surface" data-testid="print-surface">
      <div className="print-heading">
        <p className="print-kicker">Fretboard Arpeggio Explorer</p>
        <h1>Song chord plan</h1>
        <p>{chords.length} selected chord{chords.length === 1 ? '' : 's'} · compact fretboard reference</p>
      </div>
      {chords.map((chord, index) => (
        <article className="print-chord" key={chord.id} data-testid={`print-chord-${chord.id}`}>
          <div className="print-chord-heading">
            <div><span className="print-index">{String(index + 1).padStart(2, '0')}</span><h2>{chord.root} {chord.arpeggio}</h2></div>
            <div className="print-meta"><span>Formula: {formulaLabel(chord.formula)}</span><span>Tuning: {chord.family} · {chord.tuning.label} · {chord.tuning.shortLabel}</span></div>
          </div>
          <PrintFretboard chord={chord} />
        </article>
      ))}
    </div>
  );
}

function Home() {
  const [family, setFamily] = useState<Family>('guitar');
  const [stringCount, setStringCount] = useState(6);
  const [tuningKey, setTuningKey] = useState('standard');
  const [root, setRoot] = useState('C');
  const [arpeggio, setArpeggio] = useState<ArpeggioName>('Major 7');
  const [mode, setMode] = useState<'notes' | 'intervals'>('notes');
  const [maxFret, setMaxFret] = useState(12);
  const [songChords, setSongChords] = useState<ChordPlanEntry[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');

  const availableTunings = useMemo(() => {
    if (family === 'guitar') return stringCount === 7 ? [TUNINGS.guitar.standard7, TUNINGS.guitar.dropA7, TUNINGS.guitar.dStandard7, TUNINGS.guitar.dropG7] : [TUNINGS.guitar.standard, TUNINGS.guitar.dropD, TUNINGS.guitar.dStandard, TUNINGS.guitar.dropC, TUNINGS.guitar.openG];
    return stringCount === 5 ? [TUNINGS.bass.fiveString, TUNINGS.bass.dropD5, TUNINGS.bass.dStandard5, TUNINGS.bass.dropC5] : [TUNINGS.bass.standard, TUNINGS.bass.dropD4, TUNINGS.bass.dStandard4, TUNINGS.bass.dropC4];
  }, [family, stringCount]);
  const activeTuningKey = availableTunings.some((preset) => preset.key === tuningKey) ? tuningKey : availableTunings[0].key;
  const selectedTuning = availableTunings.find((preset) => preset.key === activeTuningKey) ?? availableTunings[0];
  const selectedChordTones = useMemo(() => new Set(songChords.flatMap((chord) => chord.formula.map((interval) => (NOTES.indexOf(chord.root) + interval) % 12))), [songChords]);
  const potentialKeys = useMemo(() => songChords.length ? KEY_SIGNATURES.filter((key) => [...selectedChordTones].every((tone) => key.noteIndices.has(tone))) : [], [selectedChordTones, songChords.length]);
  const selectedKey = potentialKeys.find((key) => key.id === selectedKeyId);
  const rootOptions = useMemo(() => selectedKey ? NOTES.filter((note) => selectedKey.noteIndices.has(NOTES.indexOf(note))) : NOTES, [selectedKey]);
  const compatibleArpeggios = useMemo(() => {
    const rootIndex = NOTES.indexOf(root);
    return ARPEGGIO_ENTRIES.filter(([, formula]) => !selectedKey || formula.every((interval) => selectedKey.noteIndices.has((rootIndex + interval) % 12))).map(([name]) => name);
  }, [root, selectedKey]);
  const formula = ARPEGGIOS[arpeggio];
  const rootIndex = NOTES.indexOf(root);
  const activeNoteSet = useMemo(() => new Set(formula.map((interval) => (rootIndex + interval) % 12)), [formula, rootIndex]);
  const fretNumbers = Array.from({ length: maxFret + 1 }, (_, index) => index);
  const activePositions = useMemo(() => selectedTuning.notes.reduce((total, openNote) => total + fretNumbers.filter((fret) => activeNoteSet.has((NOTES.indexOf(openNote) + fret) % 12)).length, 0), [activeNoteSet, fretNumbers, selectedTuning]);
  const currentChordId = `${root}-${arpeggio}`;
  const currentChordAdded = songChords.some((chord) => chord.id === currentChordId);

  useEffect(() => {
    if (selectedKeyId && !potentialKeys.some((key) => key.id === selectedKeyId)) setSelectedKeyId('');
  }, [potentialKeys, selectedKeyId]);
  useEffect(() => {
    if (!rootOptions.includes(root)) setRoot(rootOptions[0] ?? 'C');
  }, [root, rootOptions]);
  useEffect(() => {
    if (!compatibleArpeggios.includes(arpeggio)) setArpeggio(compatibleArpeggios[0] ?? 'Major');
  }, [arpeggio, compatibleArpeggios]);

  const reset = () => {
    setFamily('guitar'); setStringCount(6); setTuningKey('standard'); setRoot('C'); setArpeggio('Major 7'); setMode('notes'); setMaxFret(12); setSelectedKeyId('');
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
  const addCurrentChord = () => {
    if (currentChordAdded) return;
    setSongChords((current) => [...current, { id: currentChordId, root, arpeggio, formula: [...formula], family, tuning: { ...selectedTuning, notes: [...selectedTuning.notes] }, maxFret }]);
  };
  const removeChord = (id: string) => setSongChords((current) => current.filter((chord) => chord.id !== id));
  const clearPlan = () => {
    setSongChords([]);
    setSelectedKeyId('');
  };

  return (
    <>
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
          <section className="control-card fade-up fade-up-delay mb-7 p-4 md:p-5" aria-label="Fretboard controls">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#e6dfd0] pb-4">
              <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-[#d76542]" /><p className="m-0 text-sm font-extrabold text-[#303c45]">Build your position</p></div>
              <p data-testid="text-selection-summary" className="eyebrow m-0 text-right">Showing {activePositions} tones across frets 0–{maxFret}</p>
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
              <SelectField label="Root note" value={root} options={rootOptions.map((note) => ({ value: note, label: note }))} onChange={setRoot} testId="select-root" />
              <SelectField label="Arpeggio" value={arpeggio} options={compatibleArpeggios.map((name) => ({ value: name, label: name }))} onChange={(value) => setArpeggio(value as ArpeggioName)} testId="select-arpeggio" />
              <SelectField label="Key filter" value={selectedKeyId} options={[{ value: '', label: 'No key filter' }, ...potentialKeys.map((key) => ({ value: key.id, label: key.label }))]} onChange={setSelectedKeyId} testId="select-key-filter" />
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

          <section className="planner-card fade-up mb-8" aria-label="Song chord planner">
            <div className="planner-header">
              <div className="flex items-start gap-3">
                <div className="planner-icon"><ListMusic size={18} /></div>
                <div>
                  <p className="eyebrow m-0">Song chord planner</p>
                  <h2 className="display-font m-0 mt-1 text-xl font-bold tracking-[-0.04em] text-[#26333d]">Turn the fretboard into a playable plan</h2>
                  <p data-testid="text-song-plan-count" className="m-0 mt-1 text-xs text-[#69757a]">{songChords.length} chord{songChords.length === 1 ? '' : 's'} saved for this session</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button data-testid="button-print-song-plan" type="button" disabled={!songChords.length} onClick={() => window.print()} className="planner-secondary-button"><Printer size={14} /> Print charts</button>
                {songChords.length > 0 && <button data-testid="button-clear-song-plan" type="button" onClick={clearPlan} className="planner-quiet-button"><Trash2 size={14} /> Clear all</button>}
              </div>
            </div>
            <div className="planner-body">
              <div className="plan-column">
                <div className="planner-subhead"><span>Selected chords</span><span data-testid="text-selected-chord-count" className="planner-count">{songChords.length}</span></div>
                {songChords.length ? (
                  <div className="song-chord-list">
                    {songChords.map((chord, index) => (
                      <div className="song-chord-row" key={chord.id} data-testid={`row-song-chord-${chord.id}`}>
                        <span className="song-chord-index">{String(index + 1).padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <p data-testid={`text-song-chord-name-${chord.id}`} className="m-0 truncate text-sm font-extrabold text-[#2d3b43]">{chord.root} {chord.arpeggio}</p>
                          <p data-testid={`text-song-chord-details-${chord.id}`} className="m-0 mt-1 truncate font-mono text-[10px] text-[#778287]">{formulaLabel(chord.formula)} · {chord.tuning.shortLabel}</p>
                        </div>
                        <button data-testid={`button-remove-song-chord-${chord.id}`} type="button" aria-label={`Remove ${chord.root} ${chord.arpeggio}`} onClick={() => removeChord(chord.id)} className="icon-button"><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="planner-empty" data-testid="status-song-plan-empty"><Plus size={16} /><span>Add a root and arpeggio below to sketch your progression.</span></div>
                )}
              </div>
              <div className="key-column">
                <div className="planner-subhead"><span><KeyRound size={14} /> Potential keys</span><span data-testid="text-potential-key-count" className="planner-count">{potentialKeys.length}</span></div>
                {potentialKeys.length ? (
                  <div className="key-list">
                    {potentialKeys.map((key) => <button data-testid={`button-key-${key.id}`} type="button" key={key.id} data-active={selectedKeyId === key.id} aria-pressed={selectedKeyId === key.id} onClick={() => setSelectedKeyId(key.id)} className="key-chip"><span>{key.label}</span><small>{key.notes.join(' · ')}</small></button>)}
                  </div>
                ) : (
                  <div className="planner-empty key-empty" data-testid="status-key-signatures-empty"><KeyRound size={16} /><span>Compatible major and natural-minor keys appear once chords are added.</span></div>
                )}
                {selectedKey && <button data-testid="button-clear-key-filter" type="button" onClick={() => setSelectedKeyId('')} className="clear-key-button">Clear {selectedKey.label} filter</button>}
              </div>
            </div>
          </section>

          <section className="fade-up" aria-label="Current arpeggio selection">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-2">Current selection</p>
                <h2 data-testid="text-current-selection" className="display-font m-0 text-2xl font-bold tracking-[-0.04em] text-[#26333d] md:text-3xl">{root} {arpeggio}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span data-testid="text-formula" className="font-mono text-xs text-[#6b7478]">Formula: {formulaLabel(formula)}</span>
                  <span className="note-legend"><i className="legend-dot root" /> root</span><span className="note-legend"><i className="legend-dot" /> chord tone</span>
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-end gap-2">
                <div className="rounded-lg border border-[#e0d7c5] bg-[#f8f5ed] px-3 py-2 text-right">
                  <p className="eyebrow m-0">Instrument / tuning</p>
                  <p data-testid="text-current-tuning" className="m-0 mt-1 font-mono text-xs font-medium text-[#34434c]">{family} · {selectedTuning.label}</p>
                </div>
                <button data-testid="button-add-current-chord" type="button" disabled={currentChordAdded} onClick={addCurrentChord} className="add-chord-button">
                  {currentChordAdded ? <Check size={15} /> : <Plus size={15} />}<span data-testid="text-add-chord-state">{currentChordAdded ? 'Added to plan' : 'Add to song plan'}</span>
                </button>
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
            <p data-testid="text-fretboard-stats" className="m-0 font-mono">12 notes · {formula.length} chord tones · frets 0–{maxFret}</p>
          </footer>
        </div>
      </main>
      <PrintSurface chords={songChords} />
    </>
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