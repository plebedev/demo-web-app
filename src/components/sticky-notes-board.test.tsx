import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StickyNotesBoard } from '@/components/sticky-notes-board';

describe('StickyNotesBoard', () => {
  it('renders one sticky note per non-empty line', () => {
    render(
      <StickyNotesBoard
        inputText={'First note\n\nSecond note\n  \nThird note'}
      />,
    );

    expect(screen.getByText('First note')).toBeInTheDocument();
    expect(screen.getByText('Second note')).toBeInTheDocument();
    expect(screen.getByText('Third note')).toBeInTheDocument();
    expect(screen.getByLabelText('Sticky notes board')).toBeInTheDocument();
    expect(screen.getByText('First note').closest('article')).toHaveClass(
      'sticky-note--butter',
      'sticky-note--tilt-left',
    );
  });
});
