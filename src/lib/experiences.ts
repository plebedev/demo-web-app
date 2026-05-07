export const experienceIds = ['messy-notes', 'rag-demo'] as const;

export type ExperienceId = (typeof experienceIds)[number];

export type Experience = {
  id: ExperienceId;
  label: string;
  description: string;
  route: string;
  available: boolean;
  invite_request_available: boolean;
};

export type ExperienceListResponse = {
  experiences: Experience[];
};

export const fallbackExperiences: Experience[] = [
  {
    id: 'messy-notes',
    label: 'Messy Notes',
    description:
      'Turn pasted text, text files, or extractable PDFs into a structured brief.',
    route: '/messy-notes',
    available: true,
    invite_request_available: true,
  },
  {
    id: 'rag-demo',
    label: 'RAG Demo',
    description:
      'A retrieval-grounded demo experience. The protected page is available now; the full workflow is coming soon.',
    route: '/rag-demo',
    available: true,
    invite_request_available: true,
  },
];

export function isExperienceId(value: string): value is ExperienceId {
  return experienceIds.includes(value as ExperienceId);
}

export function experiencePath(id: ExperienceId): string {
  return (
    fallbackExperiences.find((experience) => experience.id === id)?.route || '/'
  );
}
