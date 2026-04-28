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
          <h3>Paste notes or load sample chaos.</h3>
          <p className="section-detail">
            The board is quiet because there is nothing to organize yet. A rare
            moment. Enjoy it briefly.
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
