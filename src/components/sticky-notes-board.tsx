import React from 'react';

import { buildStickyNotes } from '@/lib/demo-runs';

export function StickyNotesBoard({
  inputText,
}: Readonly<{
  inputText: string;
}>) {
  const notes = buildStickyNotes(inputText);

  if (notes.length === 0) {
    return (
      <section className="note-board note-board--empty">
        <div className="note-board-empty">
          <p className="card-kicker">Messy notes preview</p>
          <h3>Paste raw notes to build the board.</h3>
          <p className="section-detail">
            The demo starts from pasted text, then spreads those notes into a
            visual workspace before the structured-brief step exists.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="note-board" aria-label="Sticky notes board">
      {notes.map((note) => (
        <article
          key={note.id}
          className={`sticky-note ${note.accentClassName} ${note.rotationClassName}`}
        >
          <p>{note.text}</p>
        </article>
      ))}
    </section>
  );
}
