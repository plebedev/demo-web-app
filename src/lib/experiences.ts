export const experienceIds = ['messy-notes', 'rag-demo', 'voice-demo'] as const;

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
      'A retrieval-grounded demo workspace with persona configuration and scoped document setup.',
    route: '/rag-demo',
    available: true,
    invite_request_available: true,
  },
  {
    id: 'voice-demo',
    label: 'Voice Demo',
    description:
      'A real-time voice AI advisor that helps employers assess workforce development readiness.',
    route: '/voice-demo',
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
