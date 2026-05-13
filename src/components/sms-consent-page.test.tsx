import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SmsConsentPage } from '@/components/sms-consent-page';

describe('SmsConsentPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the exact SMS consent copy and sample messages', () => {
    render(<SmsConsentPage />);

    expect(
      screen.getByText('SMS consent for demo notifications'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Text me when it is done')).toHaveLength(3);
    expect(
      screen.getAllByText(
        'By checking this box, you agree to receive SMS notifications related to your demo run. Message frequency varies. Message and data rates may apply. Reply STOP to opt out.',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Your messy-notes run is complete: Vendor launch brief. Open the demo app to review the brief and audit summary.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Understood - we won't send future messages to this number.",
      ),
    ).toBeInTheDocument();
  });

  it('explains phone-call consent boundaries', () => {
    render(<SmsConsentPage />);

    expect(screen.getByText('Phone-Call Consent')).toBeInTheDocument();
    expect(
      screen.getByText(/does not authorize marketing texts, marketing calls/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not opt the user into outbound phone calls/),
    ).toBeInTheDocument();
  });
});
