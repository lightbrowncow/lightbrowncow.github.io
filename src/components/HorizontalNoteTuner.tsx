import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface HorizontalNoteTunerProps {
  measuredHz: number | null;
  started: boolean;
  onStart: () => void;
}

interface NoteItem {
  midi: number;
  name: string;
  frequency: number;
}

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const ITEM_WIDTH = 112;
const SCROLL_SETTLE_MS = 180;
const INDICATOR_TRAVEL_VW = 34;

const midiToFreq = (midi: number): number =>
  440 * Math.pow(2, (midi - 69) / 12);

const freqToMidi = (freq: number): number =>
  Math.round(12 * Math.log2(freq / 440) + 69);

const midiToName = (midi: number): string => {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
};

const centsFromFreq = (freq: number, targetFreq: number): number =>
  1200 * Math.log2(freq / targetFreq);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const createNoteRange = (): NoteItem[] => {
  const notes: NoteItem[] = [];

  for (let midi = 12; midi <= 119; midi += 1) {
    notes.push({
      midi,
      name: midiToName(midi),
      frequency: midiToFreq(midi),
    });
  }

  return notes;
};

export const HorizontalNoteTuner: React.FC<HorizontalNoteTunerProps> = ({
  measuredHz,
  started,
  onStart,
}) => {
  const notes = useMemo(createNoteRange, []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  const [selectedMidi, setSelectedMidi] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const detectedMidi =
    measuredHz && measuredHz > 0
      ? clamp(freqToMidi(measuredHz), 12, 119)
      : null;
  const activeMidi = selectedMidi ?? detectedMidi;
  const activeNote = activeMidi ? notes[activeMidi - 12] : null;
  const hasPitch = measuredHz !== null && measuredHz > 0 && activeNote !== null;
  const cents = hasPitch
    ? centsFromFreq(measuredHz, activeNote.frequency)
    : null;
  const clampedCents = cents === null ? null : clamp(cents, -50, 50);
  const indicatorOffsetVw =
    clampedCents === null ? 0 : (clampedCents / 50) * INDICATOR_TRAVEL_VW;
  const outOfRangeDirection =
    cents === null || Math.abs(cents) <= 50
      ? null
      : cents < 0
        ? "left"
        : "right";
  const isInTune = cents !== null && Math.abs(cents) <= 3;
  const sidePadding = Math.max((viewportWidth - ITEM_WIDTH) / 2, 0);

  const centerNote = (midi: number, behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const noteIndex = midi - 12;
    const targetLeft = noteIndex * ITEM_WIDTH;

    autoScrollRef.current = true;
    container.scrollTo({
      left: targetLeft,
      behavior,
    });

    window.setTimeout(() => {
      autoScrollRef.current = false;
    }, 240);
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateViewport = () => {
      setViewportWidth(container.clientWidth);
    };

    updateViewport();

    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    centerNote(69, "auto");
  }, []);

  useEffect(() => {
    if (
      !started ||
      selectedMidi !== null ||
      detectedMidi === null ||
      isUserScrolling
    ) {
      return;
    }

    centerNote(detectedMidi, "smooth");
  }, [detectedMidi, isUserScrolling, selectedMidi, started]);

  useEffect(() => {
    if (selectedMidi === null) {
      return;
    }

    centerNote(selectedMidi, "smooth");
  }, [selectedMidi]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    if (autoScrollRef.current) {
      return;
    }

    setIsUserScrolling(true);

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsUserScrolling(false);
      if (selectedMidi !== null && containerRef.current) {
        const nearestIndex = clamp(
          Math.round(containerRef.current.scrollLeft / ITEM_WIDTH),
          0,
          notes.length - 1,
        );
        const nextMidi = notes[nearestIndex]?.midi ?? selectedMidi;
        setSelectedMidi(nextMidi);
        centerNote(nextMidi, "smooth");
      }
      scrollTimeoutRef.current = null;
    }, SCROLL_SETTLE_MS);
  };

  const listeningLabel = !started
    ? "Microphone disabled"
    : hasPitch
      ? selectedMidi === null
        ? "Auto-detecting pitch"
        : "Locked tuning mode"
      : "Listening for pitch";

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        position: "relative",
        background:
          "radial-gradient(circle at top, rgba(59, 91, 138, 0.24), transparent 34%), linear-gradient(180deg, #071018 0%, #091722 48%, #04090f 100%)",
        color: "#f5f7fa",
        fontFamily:
          '"Avenir Next", "Segoe UI Variable", "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.015) 0, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 112px)",
          backgroundSize: `${ITEM_WIDTH}px 100%`,
          opacity: 0.18,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100dvh",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          padding:
            "max(10px, env(safe-area-inset-top)) 0 max(8px, env(safe-area-inset-bottom))",
        }}
      >
        {started ? (
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.15rem 1rem 0",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.76rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(235, 242, 250, 0.58)",
                }}
              >
                Guitar Tuner
              </div>
              <div
                style={{
                  marginTop: "0.3rem",
                  fontSize: "clamp(1.2rem, 3vw, 2rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                }}
              >
                {activeNote?.name ?? "Swipe Through Notes"}
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              {selectedMidi !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedMidi(null)}
                  style={{
                    pointerEvents: "auto",
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#f5f7fa",
                    borderRadius: "999px",
                    padding: "0.68rem 0.92rem",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Auto Detect
                </button>
              )}
            </div>
          </header>
        ) : (
          <div />
        )}

        <main
          style={{
            position: "relative",
            display: "grid",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "14%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "2px",
              height: "34vh",
              background: isInTune
                ? "linear-gradient(180deg, rgba(120,255,196,0.85), rgba(120,255,196,0.25))"
                : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.22))",
              boxShadow: isInTune ? "0 0 16px rgba(120,255,196,0.35)" : "none",
              pointerEvents: "none",
              zIndex: 3,
            }}
          />

          {hasPitch && (
            <div
              style={{
                position: "absolute",
                top: "17%",
                left: `calc(50% + ${indicatorOffsetVw}vw)`,
                transform: "translateX(-50%)",
                width: "3px",
                height: "28vh",
                borderRadius: "999px",
                background: isInTune
                  ? "linear-gradient(180deg, #7cffc0, rgba(124,255,192,0.35))"
                  : "linear-gradient(180deg, #f59e0b, rgba(245,158,11,0.35))",
                boxShadow: isInTune
                  ? "0 0 18px rgba(124,255,192,0.45)"
                  : "0 0 12px rgba(245,158,11,0.28)",
                transition: "transform 100ms linear, background 160ms ease",
                pointerEvents: "none",
                zIndex: 4,
              }}
            />
          )}

          {hasPitch && outOfRangeDirection !== null && (
            <div
              style={{
                position: "absolute",
                top: "14%",
                [outOfRangeDirection === "left" ? "left" : "right"]: "1rem",
                color: "#f59e0b",
                fontSize: "1.8rem",
                fontWeight: 800,
                letterSpacing: "-0.06em",
                textShadow: "0 0 14px rgba(245,158,11,0.35)",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              {outOfRangeDirection === "left" ? "←" : "→"}
            </div>
          )}

          <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              touchAction: "pan-x",
              scrollSnapType: "x proximity",
              padding: "8vh 0 13.5vh",
              cursor: "grab",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingLeft: sidePadding,
                paddingRight: sidePadding,
              }}
            >
              {notes.map((note) => {
                const isSelected = selectedMidi === note.midi;
                const isDetected =
                  selectedMidi === null && detectedMidi === note.midi;

                return (
                  <button
                    key={note.midi}
                    type="button"
                    onClick={() => setSelectedMidi(note.midi)}
                    style={{
                      width: `${ITEM_WIDTH}px`,
                      flex: `0 0 ${ITEM_WIDTH}px`,
                      scrollSnapAlign: "center",
                      border: 0,
                      background: "transparent",
                      color: isSelected
                        ? "#ffffff"
                        : isDetected
                          ? "#b8f6ff"
                          : "rgba(232,240,247,0.52)",
                      padding: "0.75rem 0",
                      display: "grid",
                      gap: "0.55rem",
                      justifyItems: "center",
                      cursor: "pointer",
                      pointerEvents: "auto",
                      transform:
                        isSelected || isDetected ? "scale(1.08)" : "scale(1)",
                      transition:
                        "color 180ms ease, transform 180ms ease, opacity 180ms ease",
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Tune to ${note.name}`}
                  >
                    <span
                      style={{
                        fontSize: "clamp(1.9rem, 6.8vw, 3.8rem)",
                        lineHeight: 1,
                        letterSpacing: "-0.05em",
                        fontWeight: isSelected ? 800 : isDetected ? 700 : 500,
                        textShadow:
                          isSelected || isDetected
                            ? "0 0 26px rgba(96, 212, 255, 0.18)"
                            : "none",
                      }}
                    >
                      {note.name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.82rem",
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color:
                          isSelected || isDetected
                            ? "rgba(237,246,252,0.86)"
                            : "rgba(232,240,247,0.35)",
                      }}
                    >
                      {note.frequency.toFixed(1)} Hz
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "max(8px, env(safe-area-inset-bottom))",
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            <div
              style={{
                width: "min(94vw, 520px)",
                padding: "0.82rem 0.95rem",
                borderRadius: "20px",
                background: "rgba(6, 16, 25, 0.76)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.9rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "rgba(232,240,247,0.48)",
                  }}
                >
                  Status
                </div>
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "rgba(245,247,250,0.96)",
                  }}
                >
                  {listeningLabel}
                </div>
              </div>

              <div style={{ textAlign: "right", marginLeft: "auto" }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "rgba(232,240,247,0.48)",
                  }}
                >
                  Deviation
                </div>
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: isInTune ? "#7cffc0" : "rgba(245,247,250,0.96)",
                  }}
                >
                  {cents === null
                    ? "Waiting"
                    : `${cents > 0 ? "+" : ""}${cents.toFixed(1)} cents`}
                </div>
              </div>
            </div>
          </div>

          {!started && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(3, 8, 12, 0.55)",
                backdropFilter: "blur(8px)",
                display: "grid",
                placeItems: "center",
                padding:
                  "max(10px, env(safe-area-inset-top)) 1rem max(10px, env(safe-area-inset-bottom))",
                zIndex: 6,
              }}
            >
              <div
                style={{
                  width: "min(82vw, 300px)",
                  maxWidth: "300px",
                  padding: "0.9rem 0.75rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    marginBottom: "0.7rem",
                    fontSize: "0.82rem",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(235, 242, 250, 0.64)",
                  }}
                >
                  Guitar Tuner
                </div>
                <p
                  style={{
                    margin: "0 0 1rem",
                    color: "rgba(232,240,247,0.7)",
                    lineHeight: 1.45,
                    fontSize: "clamp(0.88rem, 3.7vw, 0.98rem)",
                  }}
                >
                  Swipe the note ruler or tap a note to lock it in the center.
                </p>
                <button
                  type="button"
                  onClick={onStart}
                  style={{
                    width: "100%",
                    border: 0,
                    borderRadius: "999px",
                    padding: "0.9rem 1rem",
                    background: "linear-gradient(135deg, #7dd3fc, #38bdf8)",
                    color: "#04131d",
                    fontWeight: 800,
                    fontSize: "0.98rem",
                    cursor: "pointer",
                  }}
                >
                  Enable Microphone
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
